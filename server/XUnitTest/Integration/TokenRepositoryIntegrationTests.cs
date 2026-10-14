using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.TokenStore;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.TestDoubles;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class TokenRepositoryIntegrationTests : IDisposable
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IBlocksSecret> _secret = new();
        private readonly FakeSecretValueStore _store = new();
        private readonly ListLogger<TokenRepository> _logger = new();

        public TokenRepositoryIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
        }

        public void Dispose() => BlocksContext.ClearContext();

        private TokenRepository CreateRepo() =>
            GithubTokenStoreTestSupport.CreateRepository(_fixture.DbContextProvider, _secret.Object, _logger, _store);

        private IMongoCollection<BsonDocument> RawTokens => _fixture.Collection<BsonDocument>("RepositoryTokens");

        private Task<BsonDocument> RawRowAsync(string userId) =>
            RawTokens.Find(new BsonDocument(nameof(RepositoryToken.BlocksUserId), userId)).FirstOrDefaultAsync();

        private static string NewSecretId() => "github-token-" + Guid.NewGuid().ToString("N");

        /// <summary>A row written before this change: plaintext token, no pointer.</summary>
        private Task InsertLegacyRowAsync(string userId, string token) =>
            RawTokens.InsertOneAsync(new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), userId },
                { nameof(RepositoryToken.AccessToken), token },
                { nameof(RepositoryToken.UserName), "octo" }
            });

        private Task InsertVaultRowAsync(string userId, string secretId, string? strayAccessToken = null)
        {
            var doc = new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), userId },
                { nameof(RepositoryToken.TokenSecretId), secretId },
                { nameof(RepositoryToken.UserName), "octo" }
            };
            if (strayAccessToken is not null)
            {
                doc[nameof(RepositoryToken.AccessToken)] = strayAccessToken;
            }

            return RawTokens.InsertOneAsync(doc);
        }

        private static void SetUser(string userId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));

        private static RepositoryToken NewToken(string userId) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            BlocksUserId = userId,
            AccessToken = "tok-" + userId,
            Source = "Github",
            UserName = "octo"
        };

        [Fact]
        public async Task SaveToken_ThenGetToken_RoundTrips()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            (await sut.saveToken(NewToken(userId))).Should().BeTrue();

            var fetched = await sut.getToken();
            fetched.Should().NotBeNull();
            fetched.AccessToken.Should().Be("tok-" + userId);
        }

        [Fact]
        public async Task SaveToken_Upsert_UpdatesExisting()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            var original = NewToken(userId);
            await sut.saveToken(original);

            var updated = NewToken(userId);
            updated.ItemId = original.ItemId;
            updated.AccessToken = "updated-token";
            (await sut.saveToken(updated)).Should().BeTrue();

            (await sut.getToken()).AccessToken.Should().Be("updated-token");
        }

        [Fact]
        public async Task GetToken_NotFound_ReturnsNull()
        {
            SetUser(Guid.NewGuid().ToString("N"));
            (await CreateRepo().getToken()).Should().BeNull();
        }

        [Fact]
        public async Task GetTokenByUserId_ReturnsAccessToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.getToken(userId)).Should().Be("tok-" + userId);
        }

        [Fact]
        public async Task GetTokenByUserId_NotFound_ReturnsNull()
        {
            (await CreateRepo().getToken(Guid.NewGuid().ToString("N"))).Should().BeNull();
        }

        [Fact]
        public async Task GetTokens_ReturnsAll()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.getTokens()).Should().Contain(t => t.BlocksUserId == userId);
        }

        [Fact]
        public async Task UpdateUsernameAsync_SetsOrganizations()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            var token = NewToken(userId);
            await sut.saveToken(token);

            var orgs = new List<UserOrganizations> { new() { OrgUserName = "acme" } };
            await sut.UpdateUsernameAsync(token.ItemId, orgs);

            var fetched = await sut.getToken();
            fetched.Organizations.Should().ContainSingle(o => o.OrgUserName == "acme");
        }

        [Fact]
        public async Task DeleteTokenAsync_ByContext_RemovesToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.DeleteTokenAsync()).Should().BeTrue();
            (await sut.getToken()).Should().BeNull();
        }

        [Fact]
        public async Task DeleteTokenAsync_ByUserId_RemovesToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.DeleteTokenAsync(userId)).Should().BeTrue();
        }

        [Fact]
        public async Task DeleteTokenAsync_NothingToDelete_ReturnsFalse()
        {
            (await CreateRepo().DeleteTokenAsync(Guid.NewGuid().ToString("N"))).Should().BeFalse();
        }

        [Fact]
        public async Task GetUserByIdAsync_ReturnsUser()
        {
            var itemId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<User>("Users").InsertOneAsync(new User { ItemId = itemId, UserName = "bob" });

            var fetched = await CreateRepo().GetUserByIdAsync(itemId);
            fetched.Should().NotBeNull();
            fetched.UserName.Should().Be("bob");
        }
    
        // ---- Key Vault storage (spec #230) ----

        [Fact]
        public async Task SaveTokenStoresNewRowWithPointerAndNoAccessTokenField()
        {
            // H1 + raw-BSON assertion
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);

            (await CreateRepo().saveToken(NewToken(userId))).Should().BeTrue();

            var raw = await RawRowAsync(userId);
            raw.Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
            var secretId = raw[nameof(RepositoryToken.TokenSecretId)].AsString;
            secretId.Should().MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Values[secretId].Should().Be("tok-" + userId);
        }

        [Fact]
        public async Task SaveTokenOverLegacyRowSetsPointerAndRemovesPlaintextField()
        {
            // H3: the connect flow loads the legacy row, sets the new token and saves it.
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            await InsertLegacyRowAsync(userId, "gho_old");
            var sut = CreateRepo();

            var row = await sut.getToken();
            row.AccessToken = "gho_renewed";
            (await sut.saveToken(row)).Should().BeTrue();

            var raw = await RawRowAsync(userId);
            raw.Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
            var secretId = raw[nameof(RepositoryToken.TokenSecretId)].AsString;
            secretId.Should().MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Values[secretId].Should().Be("gho_renewed");
            (await RawTokens.CountDocumentsAsync(new BsonDocument(nameof(RepositoryToken.BlocksUserId), userId)))
                .Should().Be(1);
        }

        [Fact]
        public async Task SaveTokenReconnectKeepsThePointer()
        {
            // H2 against MongoDB.
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));
            var firstPointer = (await RawRowAsync(userId))[nameof(RepositoryToken.TokenSecretId)].AsString;

            var row = await sut.getToken();
            row.AccessToken = "gho_second";
            await sut.saveToken(row);

            (await RawRowAsync(userId))[nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(firstPointer);
            _store.Values[firstPointer].Should().Be("gho_second");
            _store.CallsTo("set").Should().Equal(firstPointer, firstPointer);
        }

        [Fact]
        public async Task GetTokenOnLegacyRowReturnsPlaintextWithoutVaultCall()
        {
            // H4
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            await InsertLegacyRowAsync(userId, "gho_legacy");
            var provider = new GithubTokenStoreTestSupport.StoreProvider(_store);
            var sut = GithubTokenStoreTestSupport.CreateRepository(_fixture.DbContextProvider, _secret.Object, _logger, provider);

            (await sut.getToken()).AccessToken.Should().Be("gho_legacy");
            (await sut.getToken(userId)).Should().Be("gho_legacy");

            provider.Resolutions.Should().Be(0);
            _store.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task GetTokenOnVaultRowReturnsVaultValueAndIgnoresStrayAccessToken()
        {
            // H5
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var secretId = NewSecretId();
            _store.Values[secretId] = "gho_from_vault";
            await InsertVaultRowAsync(userId, secretId, strayAccessToken: "bogus");
            var sut = CreateRepo();

            (await sut.getToken()).AccessToken.Should().Be("gho_from_vault");
            (await sut.getToken(userId)).Should().Be("gho_from_vault");
            _store.CallsTo("get").Should().Equal(secretId, secretId);
        }

        [Fact]
        public async Task GetTokenOnVaultRowWithMissingVaultValueReadsAsNoToken()
        {
            // C8
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            await InsertVaultRowAsync(userId, NewSecretId(), strayAccessToken: "bogus");
            var sut = CreateRepo();

            var row = await sut.getToken();
            row.Should().NotBeNull();
            row.AccessToken.Should().BeNull();
            (await sut.getToken(userId)).Should().BeNull();
        }

        [Fact]
        public async Task GetTokenOnVaultRowThrowsTokenStoreExceptionWhenVaultFails()
        {
            // C10 at the repository: throttling beyond the SDK's retries is "unavailable".
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            await InsertVaultRowAsync(userId, NewSecretId());
            _store.Fail("get", status: 429);
            var sut = CreateRepo();

            await sut.Invoking(r => r.getToken()).Should().ThrowAsync<GithubTokenStoreException>();
            await sut.Invoking(r => r.getToken(userId)).Should().ThrowAsync<GithubTokenStoreException>();
        }

        [Fact]
        public async Task NonKeyVaultStoreKeepsLegacyRowsReadableAndRefusesVaultRows()
        {
            // C11
            var legacyUser = Guid.NewGuid().ToString("N");
            var vaultUser = Guid.NewGuid().ToString("N");
            await InsertLegacyRowAsync(legacyUser, "gho_legacy");
            await InsertVaultRowAsync(vaultUser, NewSecretId());
            var sut = GithubTokenStoreTestSupport.CreateRepository(
                _fixture.DbContextProvider, _secret.Object, _logger, _store, acceptAsKeyVault: false);

            (await sut.getToken(legacyUser)).Should().Be("gho_legacy");
            await sut.Invoking(r => r.getToken(vaultUser)).Should().ThrowAsync<GithubTokenStoreException>();
            _store.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task UnconstructibleStoreKeepsLegacyRowsReadableAndRefusesVaultRows()
        {
            // C15
            var legacyUser = Guid.NewGuid().ToString("N");
            var vaultUser = Guid.NewGuid().ToString("N");
            await InsertLegacyRowAsync(legacyUser, "gho_legacy");
            await InsertVaultRowAsync(vaultUser, NewSecretId());
            var provider = new GithubTokenStoreTestSupport.StoreProvider(
                new InvalidOperationException("Required Azure config value 'KeyVault:KeyVaultUrl' is missing."));
            var sut = GithubTokenStoreTestSupport.CreateRepository(_fixture.DbContextProvider, _secret.Object, _logger, provider);

            (await sut.getToken(legacyUser)).Should().Be("gho_legacy");
            await sut.Invoking(r => r.getToken(vaultUser)).Should().ThrowAsync<GithubTokenStoreException>();
        }

        [Fact]
        public async Task DeleteTokenOnVaultRowDeletesRowAndSoftDeletesVaultValue()
        {
            // H12: DeleteAsync only (ISecretValueStore 4.0.3 exposes no purge at all).
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var secretId = NewSecretId();
            _store.Values[secretId] = "gho_x";
            await InsertVaultRowAsync(userId, secretId);

            (await CreateRepo().DeleteTokenAsync()).Should().BeTrue();

            (await RawRowAsync(userId)).Should().BeNull();
            _store.Calls.Should().Equal(("delete", secretId));
            _store.SoftDeleted.Should().ContainKey(secretId);
        }

        [Fact]
        public async Task DeleteTokenByUserIdOnVaultRowSoftDeletesVaultValue()
        {
            var userId = Guid.NewGuid().ToString("N");
            var secretId = NewSecretId();
            _store.Values[secretId] = "gho_x";
            await InsertVaultRowAsync(userId, secretId);

            (await CreateRepo().DeleteTokenAsync(userId)).Should().BeTrue();

            (await RawRowAsync(userId)).Should().BeNull();
            _store.CallsTo("delete").Should().Equal(secretId);
        }

        [Fact]
        public async Task DeleteTokenOnLegacyRowMakesNoVaultCall()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            await InsertLegacyRowAsync(userId, "gho_legacy");
            var provider = new GithubTokenStoreTestSupport.StoreProvider(_store);
            var sut = GithubTokenStoreTestSupport.CreateRepository(_fixture.DbContextProvider, _secret.Object, _logger, provider);

            (await sut.DeleteTokenAsync()).Should().BeTrue();

            (await RawRowAsync(userId)).Should().BeNull();
            provider.Resolutions.Should().Be(0);
            _store.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task DeleteTokenVaultFailureIsLoggedAndDoesNotFailTheCall()
        {
            // C7 at the repository.
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var secretId = NewSecretId();
            _store.Values[secretId] = "gho_never_logged";
            await InsertVaultRowAsync(userId, secretId);
            _store.Fail("delete");

            (await CreateRepo().DeleteTokenAsync()).Should().BeTrue();

            (await RawRowAsync(userId)).Should().BeNull();
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error
                && e.Message.Contains(userId, StringComparison.Ordinal)
                && e.Message.Contains(secretId, StringComparison.Ordinal));
            _logger.AllText.Should().NotContain("gho_never_logged");
        }

        [Fact]
        public async Task SecondFirstTimeSaveForSameUserReusesThePointerAndKeepsOneRow()
        {
            // C13: two connects that each loaded "no row" and built a fresh document (new ItemId,
            // no pointer), saved one after the other. The second save finds the first one's row,
            // reuses its pointer (writing its token there), and its replace is refused by MongoDB
            // because the replacement carries a different _id. One row remains and its pointer
            // resolves to a stored token.
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            var first = NewToken(userId);
            first.AccessToken = "gho_first";
            var second = NewToken(userId);
            second.AccessToken = "gho_second";

            var firstSaved = await sut.saveToken(first);
            var secondSaved = await sut.saveToken(second);

            firstSaved.Should().BeTrue();
            secondSaved.Should().BeFalse();
            (await RawTokens.CountDocumentsAsync(new BsonDocument(nameof(RepositoryToken.BlocksUserId), userId)))
                .Should().Be(1);
            var pointer = (await RawRowAsync(userId))[nameof(RepositoryToken.TokenSecretId)].AsString;
            pointer.Should().Be(first.TokenSecretId);
            _store.Values.Should().ContainSingle().Which.Key.Should().Be(pointer);
            (await sut.getToken(userId)).Should().Be("gho_second");
        }

        [Fact]
        public async Task ReconnectWhenVaultValueIsMissingCreatesANewPointer()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var staleId = NewSecretId();
            await InsertVaultRowAsync(userId, staleId);
            var sut = CreateRepo();

            var row = await sut.getToken();
            row.AccessToken = "gho_new";
            (await sut.saveToken(row)).Should().BeTrue();

            var pointer = (await RawRowAsync(userId))[nameof(RepositoryToken.TokenSecretId)].AsString;
            pointer.Should().NotBe(staleId).And.MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.CallsTo("set").Should().Equal(pointer);
            (await sut.getToken(userId)).Should().Be("gho_new");
        }
    }
}
