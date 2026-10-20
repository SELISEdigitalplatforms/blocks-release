using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Response;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.TestDoubles;

namespace XUnitTest.Integration
{
    /// <summary>
    /// <see cref="AuthService"/> over the real <see cref="TokenRepository"/> on local MongoDB, with
    /// a test double for the Key Vault value store and GitHub mocked. This proves the whole path:
    /// the stored document, the vault calls, and the response body blocks-os receives.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class AuthServiceTokenStoreIntegrationTests : IDisposable
    {
        private const string MValidate = "Could not validate your GitHub connection. Please try again later.";
        private const string MReauth = "Your GitHub authorization is no longer valid. Please re-authenticate.";
        private const string MUnavailable = "This operation is not possible right now. Please try again later.";

        private static readonly string[] Roles = ["role"];
        private static readonly string[] Permissions = ["perm"];

        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<IVersionControlService> _github = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _cloudBuildSecret = new();
        private readonly FakeSecretValueStore _store = new();
        private readonly ListLogger<TokenRepository> _repoLogger = new();
        private readonly ListLogger<AuthService> _authLogger = new();
        private readonly string _userId = Guid.NewGuid().ToString("N");

        public AuthServiceTokenStoreIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            _cloudBuildSecret.SetupGet(s => s.GithubClientId).Returns("cid");
            _cloudBuildSecret.SetupGet(s => s.GithubClientSecret).Returns("csecret");
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", Roles, _userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", Permissions, "octo",
                "phone", "display", "oauth", "tenant"));
        }

        private readonly HttpResponseMessage _ok = new(HttpStatusCode.OK);

        public void Dispose()
        {
            BlocksContext.ClearContext();
            _ok.Dispose();
        }

        private IMongoCollection<BsonDocument> RawTokens => _fixture.Collection<BsonDocument>("RepositoryTokens");

        private Task<BsonDocument> RawRowAsync() =>
            RawTokens.Find(new BsonDocument(nameof(RepositoryToken.BlocksUserId), _userId)).FirstOrDefaultAsync();

        private AuthService CreateService(bool acceptAsKeyVault = true)
        {
            var repository = GithubTokenStoreTestSupport.CreateRepository(
                _fixture.DbContextProvider, _blocksSecret.Object, _repoLogger, _store, acceptAsKeyVault);
            return new AuthService(repository, new ConfigurationBuilder().Build(), _github.Object, _http.Object,
                _authLogger, _cloudBuildSecret.Object);
        }

        private static string NewSecretId() => "github-token-" + Guid.NewGuid().ToString("N");

        private string SeedVaultRow(string token)
        {
            var secretId = NewSecretId();
            _store.Values[secretId] = token;
            RawTokens.InsertOne(new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), _userId },
                { nameof(RepositoryToken.TokenSecretId), secretId },
                { nameof(RepositoryToken.UserName), "octo" }
            });
            return secretId;
        }

        private void SeedLegacyRow(string token) =>
            RawTokens.InsertOne(new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), _userId },
                { nameof(RepositoryToken.AccessToken), token },
                { nameof(RepositoryToken.UserName), "octo" }
            });

        private void GithubCodeExchangeReturns(string token)
        {
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(),
                        It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new GithubAccessTokenResponse { AccessToken = token, Scope = "repo" },
                     _ok));
            _github.Setup(g => g.GetUser(token)).ReturnsAsync(new GithubUserResponse { login = "octo" });
            _github.Setup(g => g.GetUserOrganizations(token)).ReturnsAsync(new List<GithubUserOrgResponse>());
        }

        private static void ShouldBeFailure(BaseApiResponse result, string message, string errorKey)
        {
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be(message);
            result.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { [errorKey] = message });
        }

        private void LogsShouldNotContain(string token)
        {
            _repoLogger.AllText.Should().NotContain(token);
            _authLogger.AllText.Should().NotContain(token);
        }

        // ---- Connect ----

        [Fact]
        public async Task ConnectFirstTimeStoresTokenInVaultAndRowWithoutAccessToken()
        {
            // H1 end to end, C12 (no token in logs or in the stored row).
            GithubCodeExchangeReturns("gho_abc");

            var result = await CreateService().GetAccessToken("code");

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            var raw = await RawRowAsync();
            raw.Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
            var secretId = raw[nameof(RepositoryToken.TokenSecretId)].AsString;
            secretId.Should().MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Values[secretId].Should().Be("gho_abc");
            raw.ToJson().Should().NotContain("gho_abc");
            LogsShouldNotContain("gho_abc");
        }

        [Fact]
        public async Task ConnectFromLegacyRowMovesTokenToVault()
        {
            // H3 end to end.
            SeedLegacyRow("gho_old");
            GithubCodeExchangeReturns("gho_new");

            (await CreateService().GetAccessToken("code")).IsSuccess.Should().BeTrue();

            var raw = await RawRowAsync();
            raw.Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
            _store.Values[raw[nameof(RepositoryToken.TokenSecretId)].AsString].Should().Be("gho_new");
        }

        [Fact]
        public async Task ConnectAgainReusesThePointer()
        {
            // H2 end to end.
            var secretId = SeedVaultRow("gho_old");
            GithubCodeExchangeReturns("gho_new");

            (await CreateService().GetAccessToken("code")).IsSuccess.Should().BeTrue();

            (await RawRowAsync())[nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(secretId);
            _store.Values[secretId].Should().Be("gho_new");
        }

        [Fact]
        public async Task ConnectVaultWriteFailureLeavesRowAndVaultUnchanged()
        {
            // C2
            var secretId = SeedVaultRow("gho_old");
            var before = await RawRowAsync();
            GithubCodeExchangeReturns("gho_new");
            _store.Fail("set");

            var result = await CreateService().GetAccessToken("code");

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            (await RawRowAsync()).Should().BeEquivalentTo(before);
            _store.Values[secretId].Should().Be("gho_old");
        }

        [Fact]
        public async Task ConnectVaultWriteFailureForNewUserWritesNoRow()
        {
            // C2, first-time variant.
            GithubCodeExchangeReturns("gho_new");
            _store.Fail("set");

            ShouldBeFailure(await CreateService().GetAccessToken("code"), MUnavailable, "TokenStore");
            (await RawRowAsync()).Should().BeNull();
            _store.Values.Should().BeEmpty();
        }

        [Fact]
        public async Task ConnectVaultReadFailureOnExistingRowWritesNothing()
        {
            // C3
            var secretId = SeedVaultRow("gho_old");
            var before = await RawRowAsync();
            GithubCodeExchangeReturns("gho_new");
            _store.Fail("get");

            ShouldBeFailure(await CreateService().GetAccessToken("code"), MUnavailable, "TokenStore");

            _store.CallsTo("set").Should().BeEmpty();
            _store.Values[secretId].Should().Be("gho_old");
            (await RawRowAsync()).Should().BeEquivalentTo(before);
        }

        [Fact]
        public async Task ConnectWithNonKeyVaultStoreIsRefusedAndLogged()
        {
            // C11 (connect)
            GithubCodeExchangeReturns("gho_new");

            var result = await CreateService(acceptAsKeyVault: false).GetAccessToken("code");

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            (await RawRowAsync()).Should().BeNull();
            _store.Calls.Should().BeEmpty();
            _repoLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error
                && e.Message.Contains("KeyVault__KeyVaultUrl", StringComparison.Ordinal)
                && e.Message.Contains("Secrets__ValueStore=KeyVault", StringComparison.Ordinal));
        }

        [Fact]
        public async Task StoreErrorsCarryingTheTokenNeverReachLogsOrResponses()
        {
            // C12: a store exception whose message contains the token value.
            GithubCodeExchangeReturns("gho_leaky");
            _store.Fail("set", _ => FakeSecretValueStore.VaultFailureWithMessage("set", "rejected value gho_leaky"));

            var result = await CreateService().GetAccessToken("code");

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            LogsShouldNotContain("gho_leaky");
        }

        [Fact]
        public async Task VaultReadErrorsCarryingTheTokenNeverReachLogs()
        {
            SeedVaultRow("gho_leaky_read");
            _store.Fail("get", _ => new ArgumentException("bad value gho_leaky_read"));

            ShouldBeFailure(await CreateService().isAuthorized(), MValidate, "TokenStore");
            ShouldBeFailure(await CreateService().RevokeOauthAccess(), MUnavailable, "TokenStore");
            LogsShouldNotContain("gho_leaky_read");
        }

        // ---- isAuthorized ----

        [Fact]
        public async Task IsAuthorizedVaultRowValidatesTheVaultValue()
        {
            // H6, H5
            SeedVaultRow("gho_vault");
            _github.Setup(g => g.ValidateAccessToken(It.Is<RepositoryToken>(t => t.AccessToken == "gho_vault")))
                   .ReturnsAsync(true);

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            result.Message.Should().BeNull();
            result.Errors.Should().BeNull();
        }

        [Fact]
        public async Task IsAuthorizedLegacyRowValidatesWithoutVaultCall()
        {
            // H4 + H6 (spec example 2)
            SeedLegacyRow("gho_old");
            _github.Setup(g => g.ValidateAccessToken(It.Is<RepositoryToken>(t => t.AccessToken == "gho_old")))
                   .ReturnsAsync(true);

            (await CreateService().isAuthorized()).IsSuccess.Should().BeTrue();
            _store.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task IsAuthorizedNoRowReturnsReauthenticate()
        {
            // H7
            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
        }

        [Fact]
        public async Task IsAuthorizedMissingVaultValueReturnsReauthenticate()
        {
            // H7 / C8
            var secretId = SeedVaultRow("gho_gone");
            _store.Values.TryRemove(secretId, out _);

            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
            _github.Verify(g => g.ValidateAccessToken(It.IsAny<RepositoryToken>()), Times.Never);
        }

        [Fact]
        public async Task IsAuthorizedGithubRejectsTokenReturnsReauthenticate()
        {
            // H7 (spec example 4)
            SeedVaultRow("gho_revoked");
            _github.Setup(g => g.ValidateAccessToken(It.IsAny<RepositoryToken>())).ReturnsAsync(false);

            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
        }

        [Theory]
        [InlineData(503)]
        [InlineData(429)]
        public async Task IsAuthorizedVaultFailureReturnsValidateAndChangesNothing(int status)
        {
            // C1, and C10 with a throttled (429) vault: never reported as an invalid token.
            var secretId = SeedVaultRow("gho_vault");
            var before = await RawRowAsync();
            _store.Fail("get", status);

            var result = await CreateService().isAuthorized();

            ShouldBeFailure(result, MValidate, "TokenStore");
            result.Errors.Should().NotContainKey("Authorization");
            (await RawRowAsync()).Should().BeEquivalentTo(before);
            _store.Values[secretId].Should().Be("gho_vault");
            _github.Verify(g => g.ValidateAccessToken(It.IsAny<RepositoryToken>()), Times.Never);
        }

        [Fact]
        public async Task IsAuthorizedWithNonKeyVaultStoreValidatesForVaultRows()
        {
            // C11 (isAuthorized on a vault-format row)
            SeedVaultRow("gho_vault");

            ShouldBeFailure(await CreateService(acceptAsKeyVault: false).isAuthorized(), MValidate, "TokenStore");
        }

        [Fact]
        public async Task IsAuthorizedWithNonKeyVaultStoreKeepsLegacyRowsWorking()
        {
            // C11 (legacy rows stay readable)
            SeedLegacyRow("gho_old");
            _github.Setup(g => g.ValidateAccessToken(It.IsAny<RepositoryToken>())).ReturnsAsync(true);

            (await CreateService(acceptAsKeyVault: false).isAuthorized()).IsSuccess.Should().BeTrue();
        }

        // ---- Revoke / delete ----

        [Fact]
        public async Task RevokeAcceptedDeletesRowAndSoftDeletesVaultValue()
        {
            // H9
            var secretId = SeedVaultRow("gho_x");
            _github.Setup(g => g.RevokeOauthAccess(It.Is<RepositoryToken>(t => t.AccessToken == "gho_x")))
                   .ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            (await RawRowAsync()).Should().BeNull();
            _store.CallsTo("delete").Should().Equal(secretId);
            _store.SoftDeleted.Should().ContainKey(secretId);
            LogsShouldNotContain("gho_x");
        }

        [Fact]
        public async Task RevokeRejectedStillDeletesRowAndSoftDeletesVaultValue()
        {
            // H10 (spec example 6)
            var secretId = SeedVaultRow("gho_x");
            _github.Setup(g => g.RevokeOauthAccess(It.IsAny<RepositoryToken>())).ReturnsAsync(false);

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, "Authorization removal failed.", "Authorization");
            (await RawRowAsync()).Should().BeNull();
            _store.CallsTo("delete").Should().Equal(secretId);
        }

        [Fact]
        public async Task RevokeLegacyRowUsesPlaintextTokenAndMakesNoVaultCall()
        {
            // H11
            SeedLegacyRow("gho_old");
            _github.Setup(g => g.RevokeOauthAccess(It.Is<RepositoryToken>(t => t.AccessToken == "gho_old")))
                   .ReturnsAsync(true);

            (await CreateService().RevokeOauthAccess()).IsSuccess.Should().BeTrue();

            (await RawRowAsync()).Should().BeNull();
            _store.Calls.Should().BeEmpty();
        }

        [Theory]
        [InlineData(503)]
        [InlineData(429)]
        public async Task RevokeVaultReadFailureCallsNothingAndDeletesNothing(int status)
        {
            // C6 (spec example 5), C10
            var secretId = SeedVaultRow("gho_x");
            _store.Fail("get", status);

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            (await RawRowAsync()).Should().NotBeNull();
            _store.CallsTo("delete").Should().BeEmpty();
            _store.Values.Should().ContainKey(secretId);
            _github.Verify(g => g.RevokeOauthAccess(It.IsAny<RepositoryToken>()), Times.Never);
        }

        [Fact]
        public async Task RevokeVaultDeleteFailureIsLoggedAndResponseIsUnchanged()
        {
            // C7 (revoke)
            var secretId = SeedVaultRow("gho_x");
            _github.Setup(g => g.RevokeOauthAccess(It.IsAny<RepositoryToken>())).ReturnsAsync(true);
            _store.Fail("delete");

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            (await RawRowAsync()).Should().BeNull();
            _repoLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error
                && e.Message.Contains(_userId, StringComparison.Ordinal)
                && e.Message.Contains(secretId, StringComparison.Ordinal));
            LogsShouldNotContain("gho_x");
        }

        [Fact]
        public async Task DeleteAuthorizationOnVaultRowDeletesRowAndSoftDeletesVaultValue()
        {
            // H12
            var secretId = SeedVaultRow("gho_x");

            var result = await CreateService().DeleteToken();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            (await RawRowAsync()).Should().BeNull();
            _store.Calls.Should().Equal(("delete", secretId));
        }

        [Fact]
        public async Task DeleteAuthorizationVaultDeleteFailureKeepsTheSuccessResponse()
        {
            // C7 (delete authorization)
            var secretId = SeedVaultRow("gho_x");
            _store.Fail("delete");

            var result = await CreateService().DeleteToken();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            _repoLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error
                && e.Message.Contains(_userId, StringComparison.Ordinal)
                && e.Message.Contains(secretId, StringComparison.Ordinal));
        }
    }
}
