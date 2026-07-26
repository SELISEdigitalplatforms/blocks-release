using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.VersionControlSystems
{
    public class GithubWebhookServiceTests : IDisposable
    {
        private readonly Mock<ILogger<GithubWebhookService>> _logger = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ITokenRepository> _tokenRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config;

        public GithubWebhookServiceTests()
        {
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["GithubWebhookUrl"] = "https://hook/" })
                .Build();
            _secret.SetupGet(s => s.GithubWebhookSecret).Returns("whsecret");
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-9", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-9"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private GithubWebhookService CreateService() =>
            new(_logger.Object, _config, _http.Object, _tokenRepo.Object, _repoRepo.Object, _secret.Object);

        private static Repo Repo() => new()
        {
            RepoName = "org/repo",
            RepoUrl = "https://github.com/org/repo",
            DeploymentType = RepoDeploymentType.Auto
        };

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        private void SetupToken() =>
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(new RepositoryToken { AccessToken = "tok" });

        // ---- CreateWebhook ----

        [Fact]
        public async Task CreateWebhook_NullRepo_ReturnsNull()
        {
            var result = await CreateService().CreateWebhook(null);
            result.Should().BeNull();
        }

        [Fact]
        public async Task CreateWebhook_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().CreateWebhook(Repo());
            result.Should().BeNull();
        }

        [Fact]
        public async Task CreateWebhook_Created_ReturnsMappedWebhook()
        {
            SetupToken();
            var success = new GithubWebhookSuccessResponse { id = 42, name = "web", active = true };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((success, null, Resp(HttpStatusCode.Created)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().NotBeNull();
            result.Id.Should().Be(42);
        }

        [Fact]
        public async Task CreateWebhook_NonCreated_ReturnsNull()
        {
            SetupToken();
            var error = new GithubWebhookErrorResponse { errors = new List<GithubWebhookError> { new() { message = "boom" } } };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, error, Resp(HttpStatusCode.UnprocessableEntity)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().BeNull();
        }

        [Fact]
        public async Task CreateWebhook_ManualDeployment_SetsInactive()
        {
            SetupToken();
            var repo = Repo();
            repo.DeploymentType = RepoDeploymentType.Manual;
            var success = new GithubWebhookSuccessResponse { id = 7 };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((success, null, Resp(HttpStatusCode.Created)));

            var result = await CreateService().CreateWebhook(repo);

            result.Id.Should().Be(7);
        }

        [Fact]
        public async Task CreateWebhook_Exception_ReturnsNull()
        {
            SetupToken();
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().BeNull();
        }

        // ---- UpdateWebhookStatus ----

        [Fact]
        public async Task UpdateWebhookStatus_NoToken_ReturnsFalse()
        {
            var repo = Repo();
            repo.GithubWebhook = new GithubWebhook { Id = 1 };
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateWebhookStatus_Ok_ReturnsFalse()
        {
            SetupToken();
            var repo = Repo();
            repo.GithubWebhook = new GithubWebhook { Id = 1 };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new GithubWebhookSuccessResponse(), null, Resp(HttpStatusCode.OK)));

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateWebhookStatus_NotFound_RecreatesWebhook()
        {
            SetupToken();
            var repo = Repo();
            repo.GithubWebhook = new GithubWebhook { Id = 1 };
            var call = 0;
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(() =>
                 {
                     call++;
                     return call == 1
                         ? ((GithubWebhookSuccessResponse)null, (GithubWebhookErrorResponse)null, Resp(HttpStatusCode.NotFound))
                         : (new GithubWebhookSuccessResponse { id = 2 }, null, Resp(HttpStatusCode.Created));
                 });
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>())).ReturnsAsync(true);

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
            _repoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>()), Times.Once);
        }

        [Fact]
        public async Task UpdateWebhookStatus_OtherError_ReturnsFalse()
        {
            SetupToken();
            var repo = Repo();
            repo.GithubWebhook = new GithubWebhook { Id = 1 };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubWebhookErrorResponse { message = "nope" }, Resp(HttpStatusCode.InternalServerError)));

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateWebhookStatus_NullWebhook_CreatesNewFirst()
        {
            SetupToken();
            var repo = Repo();
            repo.GithubWebhook = null;
            // First CreateWebhook call (from CreateNewWebhook) returns Created, then the update request returns OK.
            var call = 0;
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(() =>
                 {
                     call++;
                     return call == 1
                         ? (new GithubWebhookSuccessResponse { id = 3 }, (GithubWebhookErrorResponse)null, Resp(HttpStatusCode.Created))
                         : (new GithubWebhookSuccessResponse(), null, Resp(HttpStatusCode.OK));
                 });
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>())).ReturnsAsync(true);

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateWebhookStatus_Exception_ReturnsFalse()
        {
            SetupToken();
            var repo = Repo();
            repo.GithubWebhook = new GithubWebhook { Id = 1 };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().UpdateWebhookStatus(repo, true);

            result.Should().BeFalse();
        }

        // ---- CreateNewWebhook ----

        [Fact]
        public async Task CreateNewWebhook_WebhookCreated_UpdatesRepo()
        {
            SetupToken();
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new GithubWebhookSuccessResponse { id = 9 }, null, Resp(HttpStatusCode.Created)));
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>())).ReturnsAsync(true);

            var result = await CreateService().CreateNewWebhook(Repo());

            result.Should().BeTrue();
            _repoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>()), Times.Once);
        }

        [Fact]
        public async Task CreateNewWebhook_WebhookNull_ReturnsFalse()
        {
            SetupToken();
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubWebhookErrorResponse { errors = new List<GithubWebhookError> { new() { message = "x" } } }, Resp(HttpStatusCode.UnprocessableEntity)));

            var result = await CreateService().CreateNewWebhook(Repo());

            result.Should().BeFalse();
        }
    }
}
