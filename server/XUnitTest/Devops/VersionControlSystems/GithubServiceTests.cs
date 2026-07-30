using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Models;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Models.Request;
using Devops.DomainService.VersionControlSystems.Models.Response;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace XUnitTest.Devops.VersionControlSystems
{
    public class GithubServiceTests
    {
        private readonly Mock<ITokenRepository> _tokenRepo = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config = new ConfigurationBuilder().Build();

        private GithubService CreateService() =>
            new(_tokenRepo.Object, _http.Object, _config, _secret.Object);

        private static RepositoryToken Token() => new()
        {
            AccessToken = "tok",
            UserName = "octo",
            Source = "Github",
            Organizations = new List<UserOrganizations> { new() { OrgUserName = "myorg" } }
        };

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        // ---- GetUser() ----

        [Fact]
        public async Task GetUser_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().GetUser();
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetUser_WithToken_ReturnsUser()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            var user = new GithubUserResponse { login = "octo" };
            _http.Setup(h => h.MakeHttpGetRequest<GithubUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((user, ""));
            var result = await CreateService().GetUser();
            result.Should().NotBeNull();
            result.login.Should().Be("octo");
        }

        [Fact]
        public async Task GetUser_NullUserFromHttp_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpGetRequest<GithubUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync(((GithubUserResponse)null, ""));
            var result = await CreateService().GetUser();
            result.Should().BeNull();
        }

        // ---- GetUser(accessToken) ----

        [Fact]
        public async Task GetUserByToken_NullToken_ReturnsNull()
        {
            var result = await CreateService().GetUser((string)null);
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetUserByToken_ReturnsUser()
        {
            var user = new GithubUserResponse { login = "octo" };
            _http.Setup(h => h.MakeHttpGetRequest<GithubUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((user, ""));
            var result = await CreateService().GetUser("abc");
            result.login.Should().Be("octo");
        }

        [Fact]
        public async Task GetUserByToken_NullUser_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpGetRequest<GithubUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync(((GithubUserResponse)null, ""));
            var result = await CreateService().GetUser("abc");
            result.Should().BeNull();
        }

        // ---- ValidateAccessToken ----

        [Fact]
        public async Task ValidateAccessToken_Success_ReturnsTrue()
        {
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            var result = await CreateService().ValidateAccessToken(Token());
            result.Should().BeTrue();
        }

        [Fact]
        public async Task ValidateAccessToken_Failure_ReturnsFalse()
        {
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.Unauthorized)));
            var result = await CreateService().ValidateAccessToken(Token());
            result.Should().BeFalse();
        }

        // ---- RevokeOauthAccess ----

        [Fact]
        public async Task RevokeOauthAccess_Success_ReturnsTrue()
        {
            _secret.SetupGet(s => s.GithubClientId).Returns("cid");
            _secret.SetupGet(s => s.GithubClientSecret).Returns("csecret");
            _http.Setup(h => h.MakeHttpDeleteRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.NoContent)));
            var result = await CreateService().RevokeOauthAccess(Token());
            result.Should().BeTrue();
        }

        [Fact]
        public async Task RevokeOauthAccess_Failure_ReturnsFalse()
        {
            _secret.SetupGet(s => s.GithubClientId).Returns("cid");
            _secret.SetupGet(s => s.GithubClientSecret).Returns("csecret");
            _http.Setup(h => h.MakeHttpDeleteRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.BadRequest)));
            var result = await CreateService().RevokeOauthAccess(Token());
            result.Should().BeFalse();
        }

        // ---- GetUserOrganizations ----

        [Fact]
        public async Task GetUserOrganizations_NullToken_ReturnsNull()
        {
            var result = await CreateService().GetUserOrganizations(null);
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetUserOrganizations_ReturnsList()
        {
            var orgs = new List<GithubUserOrgResponse> { new() { login = "myorg" } };
            _http.Setup(h => h.MakeHttpGetRequest<List<GithubUserOrgResponse>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((orgs, ""));
            var result = await CreateService().GetUserOrganizations("abc");
            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetUserOrganizations_NullList_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpGetRequest<List<GithubUserOrgResponse>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync(((List<GithubUserOrgResponse>)null, ""));
            var result = await CreateService().GetUserOrganizations("abc");
            result.Should().BeNull();
        }

        // ---- GetRepositories ----

        [Fact]
        public async Task GetRepositories_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().GetRepositories(new SearchRepositoryListRequest { PageNumber = 1, PageSize = 10 });
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetRepositories_WithLinkHeader_UsesLastPageCount()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            var repos = new List<GithubRepositoryResponse> { new() { name = "r1" } };
            var resp = Resp(HttpStatusCode.OK);
            resp.Headers.Add("Link", "<https://api.github.com/user/repos?page=5>; rel=\"last\"");
            _http.Setup(h => h.MakeHttpRequest<List<GithubRepositoryResponse>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((repos, resp));
            var result = await CreateService().GetRepositories(new SearchRepositoryListRequest { PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeTrue();
            var data = result.Data;
            data.GetType().GetProperty("TotalCount").GetValue(data).Should().Be(5);
        }

        [Fact]
        public async Task GetRepositories_NoLinkHeader_DefaultsToSinglePage()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            var repos = new List<GithubRepositoryResponse> { new() { name = "r1" } };
            _http.Setup(h => h.MakeHttpRequest<List<GithubRepositoryResponse>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((repos, Resp(HttpStatusCode.OK)));
            var result = await CreateService().GetRepositories(new SearchRepositoryListRequest { PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeTrue();
            var data = result.Data;
            data.GetType().GetProperty("TotalCount").GetValue(data).Should().Be(1);
        }

        [Fact]
        public async Task GetRepositories_NullRepos_ReturnsFailure()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<List<GithubRepositoryResponse>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((List<GithubRepositoryResponse>)null, Resp(HttpStatusCode.OK)));
            var result = await CreateService().GetRepositories(new SearchRepositoryListRequest { PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeFalse();
        }

        // ---- SearchUserRepositories ----

        [Fact]
        public async Task SearchUserRepositories_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().SearchUserRepositories(new SearchRepositoryListRequest { Search = "x", PageNumber = 1, PageSize = 10 });
            result.Should().BeNull();
        }

        [Fact]
        public async Task SearchUserRepositories_Success_ReturnsData()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            var search = new GithubSearchResponse { TotalCount = 2 };
            _http.Setup(h => h.MakeHttpRequest<GithubSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((search, Resp(HttpStatusCode.OK)));
            var result = await CreateService().SearchUserRepositories(new SearchRepositoryListRequest { Search = "x", PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().Be(search);
        }

        [Fact]
        public async Task SearchUserRepositories_Unauthorized_ReturnsAuthFailure()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((GithubSearchResponse)null, Resp(HttpStatusCode.Unauthorized)));
            var result = await CreateService().SearchUserRepositories(new SearchRepositoryListRequest { Search = "x", PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Authentication Failed.");
        }

        [Fact]
        public async Task SearchUserRepositories_OtherError_ReturnsFailure()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((GithubSearchResponse)null, Resp(HttpStatusCode.InternalServerError)));
            var result = await CreateService().SearchUserRepositories(new SearchRepositoryListRequest { Search = "x", PageNumber = 1, PageSize = 10 });
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Failed to get repositories.");
        }

        // ---- GetBranches ----

        [Fact]
        public async Task GetBranches_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().GetBranches("org/repo");
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetBranches_ReturnsList()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            var branches = new List<Branch> { new() { name = "main" } };
            _http.Setup(h => h.MakeHttpGetRequest<List<Branch>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((branches, ""));
            var result = await CreateService().GetBranches("org/repo");
            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetBranches_NullBranches_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpGetRequest<List<Branch>>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync(((List<Branch>)null, ""));
            var result = await CreateService().GetBranches("org/repo");
            result.Should().BeNull();
        }

        // ---- GetRepoBranchByName ----

        [Fact]
        public async Task GetRepoBranchByName_NoToken_ReturnsFalseWithMessage()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var (ok, msg) = await CreateService().GetRepoBranchByName("org/repo", "main");
            ok.Should().BeFalse();
            msg.Should().Be("Access token not found. Please authorize again.");
        }

        [Fact]
        public async Task GetRepoBranchByName_Ok_ReturnsTrue()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubRepoBranchResponse, GithubRepoBranchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new GithubRepoBranchResponse(), null, Resp(HttpStatusCode.OK)));
            var (ok, msg) = await CreateService().GetRepoBranchByName("org/repo", "main");
            ok.Should().BeTrue();
            msg.Should().BeNull();
        }

        [Fact]
        public async Task GetRepoBranchByName_Unauthorized_ReturnsFalse()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubRepoBranchResponse, GithubRepoBranchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubRepoBranchResponse(), Resp(HttpStatusCode.Unauthorized)));
            var (ok, msg) = await CreateService().GetRepoBranchByName("org/repo", "main");
            ok.Should().BeFalse();
            msg.Should().Be("Failed to access repository.");
        }

        [Fact]
        public async Task GetRepoBranchByName_NotFound_ReturnsFalseWithBranchMessage()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubRepoBranchResponse, GithubRepoBranchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubRepoBranchResponse(), Resp(HttpStatusCode.NotFound)));
            var (ok, msg) = await CreateService().GetRepoBranchByName("org/repo", "dev");
            ok.Should().BeFalse();
            msg.Should().Contain("does not have a branch named 'dev'");
        }

        [Fact]
        public async Task GetRepoBranchByName_OtherStatus_ReturnsFalseNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(Token());
            _http.Setup(h => h.MakeHttpRequest<GithubRepoBranchResponse, GithubRepoBranchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubRepoBranchResponse(), Resp(HttpStatusCode.InternalServerError)));
            var (ok, msg) = await CreateService().GetRepoBranchByName("org/repo", "dev");
            ok.Should().BeFalse();
            msg.Should().BeNull();
        }

        // ---- Clone ----

        [Fact]
        public async Task Clone_ReturnsTrue()
        {
            var result = await CreateService().Clone("org/repo");
            result.Should().BeTrue();
        }
    }
}
