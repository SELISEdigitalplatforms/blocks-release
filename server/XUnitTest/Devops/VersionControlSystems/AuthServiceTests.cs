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
using Devops.DomainService.VersionControlSystems.Services;
using Devops.DomainService.VersionControlSystems.TokenStore;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.VersionControlSystems
{
    public class AuthServiceTests : IDisposable
    {
        private readonly Mock<ITokenRepository> _tokenRepo = new();
        private readonly Mock<IVersionControlService> _vcs = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<ILogger<AuthService>> _logger = new();
        private readonly IConfiguration _config = new ConfigurationBuilder().Build();

        public AuthServiceTests()
        {
            _secret.SetupGet(s => s.GithubClientId).Returns("cid");
            _secret.SetupGet(s => s.GithubClientSecret).Returns("csecret");
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));
        }

        private readonly HttpResponseMessage _ok = new(HttpStatusCode.OK);

        public void Dispose()
        {
            BlocksContext.ClearContext();
            _ok.Dispose();
        }

        private AuthService CreateService() =>
            new(_tokenRepo.Object, _config, _vcs.Object, _http.Object, _logger.Object, _secret.Object);

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        // ---- GetAccessToken ----

        [Fact]
        public async Task GetAccessToken_Success_SavesTokenAndReturnsSuccess()
        {
            var tokenResp = new GithubAccessTokenResponse { AccessToken = "abc", Scope = "repo" };
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((tokenResp, Resp(HttpStatusCode.OK)));
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            _vcs.Setup(v => v.GetUser("abc")).ReturnsAsync(new GithubUserResponse { login = "octo" });
            _vcs.Setup(v => v.GetUserOrganizations("abc")).ReturnsAsync(new List<GithubUserOrgResponse>());
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>())).ReturnsAsync(true);

            var result = await CreateService().GetAccessToken("code");

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task GetAccessToken_ErrorResponse_ReturnsBadRequest()
        {
            var tokenResp = new GithubAccessTokenResponse { AccessToken = null, Error = "bad_verification_code", ErrorDescription = "expired" };
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((tokenResp, Resp(HttpStatusCode.OK)));

            var result = await CreateService().GetAccessToken("code");

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Errors.Should().ContainKey("Error");
        }

        [Fact]
        public async Task GetAccessToken_Exception_ReturnsBadRequest()
        {
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().GetAccessToken("code");

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Errors.Should().ContainKey("Exception");
        }

        // ---- isAuthorized ----

        [Fact]
        public async Task IsAuthorized_ValidToken_ReturnsSuccess()
        {
            var token = new RepositoryToken { AccessToken = "abc" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.ValidateAccessToken(token)).ReturnsAsync(true);

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task IsAuthorized_InvalidValidation_ReturnsBadRequest()
        {
            var token = new RepositoryToken { AccessToken = "abc" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.ValidateAccessToken(token)).ReturnsAsync(false);

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task IsAuthorized_NoToken_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Authorization");
        }

        [Fact]
        public async Task IsAuthorized_Exception_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Exception");
        }

        // ---- DeleteToken ----

        [Fact]
        public async Task DeleteToken_Success_ReturnsOk()
        {
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().DeleteToken();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task DeleteToken_Failure_ReturnsFailureMessage()
        {
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(false);

            var result = await CreateService().DeleteToken();

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Failed to remove access token.");
        }

        [Fact]
        public async Task DeleteToken_Exception_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().DeleteToken();

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        // ---- SaveAccessToken ----

        [Fact]
        public async Task SaveAccessToken_NewToken_MapsOrganizationsAndSaves()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            _vcs.Setup(v => v.GetUser("abc")).ReturnsAsync(new GithubUserResponse { login = "octo" });
            _vcs.Setup(v => v.GetUserOrganizations("abc")).ReturnsAsync(new List<GithubUserOrgResponse>
            {
                new() { id = 5, node_id = "n", login = "myorg", avatar_url = "a", description = "d" }
            });
            RepositoryToken saved = null;
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>()))
                      .Callback<RepositoryToken>(t => saved = t)
                      .ReturnsAsync(true);

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "abc", Scope = "repo" });

            result.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved.AccessToken.Should().Be("abc");
            saved.UserName.Should().Be("octo");
            saved.Organizations.Should().HaveCount(1);
            saved.Organizations[0].OrgUserName.Should().Be("myorg");
        }

        [Fact]
        public async Task SaveAccessToken_ExistingToken_UpdatesInPlace()
        {
            var existing = new RepositoryToken { ItemId = "keep", AccessToken = "old", UserName = "old" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(existing);
            _vcs.Setup(v => v.GetUser("new")).ReturnsAsync(new GithubUserResponse { login = "newlogin" });
            _vcs.Setup(v => v.GetUserOrganizations("new")).ReturnsAsync((List<GithubUserOrgResponse>)null);
            RepositoryToken saved = null;
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>()))
                      .Callback<RepositoryToken>(t => saved = t)
                      .ReturnsAsync(true);

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "new", Scope = "s" });

            result.IsSuccess.Should().BeTrue();
            saved.ItemId.Should().Be("keep");
            saved.AccessToken.Should().Be("new");
            saved.UserName.Should().Be("newlogin");
            saved.Organizations.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveAccessToken_NullUser_StillSaves()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            _vcs.Setup(v => v.GetUser("abc")).ReturnsAsync((GithubUserResponse)null);
            _vcs.Setup(v => v.GetUserOrganizations("abc")).ReturnsAsync(new List<GithubUserOrgResponse>());
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>())).ReturnsAsync(true);

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "abc" });

            result.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task SaveAccessToken_SaveFails_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            _vcs.Setup(v => v.GetUser(It.IsAny<string>())).ReturnsAsync(new GithubUserResponse { login = "octo" });
            _vcs.Setup(v => v.GetUserOrganizations(It.IsAny<string>())).ReturnsAsync(new List<GithubUserOrgResponse>());
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>())).ReturnsAsync(false);

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "abc" });

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Failed to save access token.");
        }

        [Fact]
        public async Task SaveAccessToken_Exception_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "abc" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Exception");
        }

        // ---- RevokeOauthAccess ----

        [Fact]
        public async Task RevokeOauthAccess_Success_ReturnsOk()
        {
            var token = new RepositoryToken { AccessToken = "abc" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.RevokeOauthAccess(token)).ReturnsAsync(true);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task RevokeOauthAccess_RevokeFails_DeletesTokenAndReturnsBadRequest()
        {
            var token = new RepositoryToken { AccessToken = "abc" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.RevokeOauthAccess(token)).ReturnsAsync(false);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Authorization");
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Once);
        }

        [Fact]
        public async Task RevokeOauthAccess_NoToken_DeletesAndReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task RevokeOauthAccess_Exception_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Exception");
        }
    
        // ---- Token store responses (spec #230) ----

        private const string MValidate = "Could not validate your GitHub connection. Please try again later.";
        private const string MReauth = "Your GitHub authorization is no longer valid. Please re-authenticate.";
        private const string MUnavailable = "This operation is not possible right now. Please try again later.";

        private static GithubTokenStoreException StoreDown() => new("The GitHub token store is unavailable.");

        private static void ShouldBeFailure(BaseApiResponse result, string message, string errorKey)
        {
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be(message);
            result.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { [errorKey] = message });
        }

        [Fact]
        public void ResponseMessagesMatchTheContract()
        {
            GithubTokenMessages.Validate.Should().Be(MValidate);
            GithubTokenMessages.Reauthenticate.Should().Be(MReauth);
            GithubTokenMessages.Unavailable.Should().Be(MUnavailable);
        }

        [Fact]
        public async Task IsAuthorizedGithubAcceptsTokenReturnsSuccessWithNoMessage()
        {
            // H6
            var token = new RepositoryToken { AccessToken = "abc", TokenSecretId = "github-token-x" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.ValidateAccessToken(token)).ReturnsAsync(true);

            var result = await CreateService().isAuthorized();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            result.Message.Should().BeNull();
            result.Errors.Should().BeNull();
        }

        [Fact]
        public async Task IsAuthorizedNoRowReturnsReauthenticate()
        {
            // H7
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null!);

            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
        }

        [Fact]
        public async Task IsAuthorizedMissingVaultValueReturnsReauthenticateWithoutCallingGithub()
        {
            // H7 / C8: the vault answered 404, so the row carries no token.
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(new RepositoryToken { TokenSecretId = "github-token-x" });

            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
            _vcs.Verify(v => v.ValidateAccessToken(It.IsAny<RepositoryToken>()), Times.Never);
        }

        [Fact]
        public async Task IsAuthorizedGithubRejectsTokenReturnsReauthenticate()
        {
            // H7
            var token = new RepositoryToken { AccessToken = "gho_revoked" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.ValidateAccessToken(token)).ReturnsAsync(false);

            ShouldBeFailure(await CreateService().isAuthorized(), MReauth, "Authorization");
        }

        [Fact]
        public async Task IsAuthorizedTokenStoreFailureReturnsValidateUnderTokenStoreKeyOnly()
        {
            // C1
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(StoreDown());

            var result = await CreateService().isAuthorized();

            ShouldBeFailure(result, MValidate, "TokenStore");
            result.Errors.Should().NotContainKey("Authorization");
            _vcs.Verify(v => v.ValidateAccessToken(It.IsAny<RepositoryToken>()), Times.Never);
            _tokenRepo.Verify(t => t.saveToken(It.IsAny<RepositoryToken>()), Times.Never);
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Never);
        }

        [Fact]
        public async Task SaveAccessTokenStoreFailureLoadingExistingRowAbortsWithUnavailable()
        {
            // C3
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(StoreDown());

            var result = await CreateService().SaveAccessToken(new GithubAccessTokenResponse { AccessToken = "abc" });

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            _tokenRepo.Verify(t => t.saveToken(It.IsAny<RepositoryToken>()), Times.Never);
        }

        [Fact]
        public async Task GetAccessTokenVaultWriteFailureReturnsUnavailable()
        {
            // C2 response mapping through the connect entry point.
            var tokenResp = new GithubAccessTokenResponse { AccessToken = "abc", Scope = "repo" };
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((tokenResp, _ok));
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null!);
            _vcs.Setup(v => v.GetUser("abc")).ReturnsAsync(new GithubUserResponse { login = "octo" });
            _vcs.Setup(v => v.GetUserOrganizations("abc")).ReturnsAsync(new List<GithubUserOrgResponse>());
            _tokenRepo.Setup(t => t.saveToken(It.IsAny<RepositoryToken>())).ThrowsAsync(StoreDown());

            ShouldBeFailure(await CreateService().GetAccessToken("code"), MUnavailable, "TokenStore");
        }

        [Fact]
        public async Task GetAccessTokenCodeExchangeFailureKeepsErrorAndTouchesNoStorage()
        {
            // C14
            var tokenResp = new GithubAccessTokenResponse { AccessToken = null!, Error = "bad_verification_code", ErrorDescription = "expired" };
            _http.Setup(h => h.MakeHttpRequest<GithubAccessTokenResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((tokenResp, _ok));

            var result = await CreateService().GetAccessToken("code");

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("bad_verification_codeexpired");
            result.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { ["Error"] = "expired" });
            _tokenRepo.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task RevokeGithubAcceptsDeletesTheStoredTokenAndReturnsSuccess()
        {
            // H9: the stored token is removed on success too (it was not before).
            var token = new RepositoryToken { AccessToken = "abc", TokenSecretId = "github-token-x" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.RevokeOauthAccess(token)).ReturnsAsync(true);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Once);
        }

        [Fact]
        public async Task RevokeGithubAcceptsButRowDeleteFailsDoesNotReportSuccess()
        {
            var token = new RepositoryToken { AccessToken = "abc", TokenSecretId = "github-token-x" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.RevokeOauthAccess(token)).ReturnsAsync(true);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(false);

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, "Authorization removal failed.", "Authorization");
        }

        [Fact]
        public async Task RevokeGithubRejectsStillDeletesAndReturnsRemovalFailed()
        {
            // H10
            var token = new RepositoryToken { AccessToken = "abc", TokenSecretId = "github-token-x" };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(token);
            _vcs.Setup(v => v.RevokeOauthAccess(token)).ReturnsAsync(false);
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, "Authorization removal failed.", "Authorization");
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Once);
        }

        [Fact]
        public async Task RevokeTokenStoreFailureCallsNeitherGithubNorDelete()
        {
            // C6
            _tokenRepo.Setup(t => t.getToken()).ThrowsAsync(StoreDown());

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, MUnavailable, "TokenStore");
            _vcs.Verify(v => v.RevokeOauthAccess(It.IsAny<RepositoryToken>()), Times.Never);
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Never);
        }

        [Fact]
        public async Task RevokeMissingVaultValueSkipsGithubAndDeletesTheRow()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(new RepositoryToken { TokenSecretId = "github-token-x" });
            _tokenRepo.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);

            var result = await CreateService().RevokeOauthAccess();

            ShouldBeFailure(result, "Authorization removal failed.", "Authorization");
            _vcs.Verify(v => v.RevokeOauthAccess(It.IsAny<RepositoryToken>()), Times.Never);
            _tokenRepo.Verify(t => t.DeleteTokenAsync(), Times.Once);
        }
    }
}
