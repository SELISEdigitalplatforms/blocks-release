using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Api.Controllers;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Models.Request;
using Devops.DomainService.VersionControlSystems.Models.Response;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers
{
    public class GithubControllerTests
    {
        private readonly Mock<IVersionControlService> _github = new();
        private readonly Mock<IGithubWebhookService> _webhook = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<IBuildService> _buildService = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config = new ConfigurationBuilder().Build();

        public GithubControllerTests() => _secret.SetupGet(s => s.GithubWebhookSecret).Returns("wh-secret");

        private GithubController CreateController() =>
            new(_config, new Mock<ILogger<GithubController>>().Object, _github.Object, _webhook.Object, _repoRepo.Object, _buildService.Object, _secret.Object);

        // ---- GetUser ----

        [Fact]
        public async Task GetUser_Found_ReturnsOk()
        {
            _github.Setup(g => g.GetUser()).ReturnsAsync(new GithubUserResponse { login = "octo" });
            (await CreateController().GetUser()).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetUser_NotFound_ReturnsBadRequest()
        {
            _github.Setup(g => g.GetUser()).ReturnsAsync((GithubUserResponse)null);
            (await CreateController().GetUser()).Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- GetRepos ----

        [Fact]
        public async Task GetRepos_Ok_ReturnsOk()
        {
            _github.Setup(g => g.SearchUserRepositories(It.IsAny<SearchRepositoryListRequest>()))
                   .ReturnsAsync(new BaseApiResponse { StatusCode = HttpStatusCode.OK });
            (await CreateController().GetRepos("q", 1, 30)).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetRepos_NonOk_ReturnsBadRequest()
        {
            _github.Setup(g => g.SearchUserRepositories(It.IsAny<SearchRepositoryListRequest>()))
                   .ReturnsAsync(new BaseApiResponse { StatusCode = HttpStatusCode.BadRequest });
            (await CreateController().GetRepos("q", 1, 30)).Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- GetBranches ----

        [Fact]
        public async Task GetBranches_Found_ReturnsOk()
        {
            _github.Setup(g => g.GetBranches("repo")).ReturnsAsync(new List<Branch> { new() { name = "main" } });
            (await CreateController().GetBranches("repo")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetBranches_Null_ReturnsBadRequest()
        {
            _github.Setup(g => g.GetBranches("repo")).ReturnsAsync((List<Branch>)null);
            (await CreateController().GetBranches("repo")).Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- GithubBranchExists ----

        [Fact]
        public async Task GithubBranchExists_RepoNull_ReturnsOkWithFailure()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            var result = await CreateController().GithubBranchExists("id");
            result.Should().BeOfType<OkObjectResult>();
            var body = ((OkObjectResult)result).Value as BaseApiResponse;
            body.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task GithubBranchExists_RepoFound_ReturnsBranchResult()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { RepoName = "org/repo", Branch = "main" });
            _github.Setup(g => g.GetRepoBranchByName("org/repo", "main")).ReturnsAsync((true, null));
            var result = await CreateController().GithubBranchExists("id");
            var body = ((OkObjectResult)result).Value as BaseApiResponse;
            body.IsSuccess.Should().BeTrue();
        }

        // ---- Clone ----

        [Fact]
        public async Task Clone_Success_ReturnsOk()
        {
            _github.Setup(g => g.Clone("repo")).ReturnsAsync(true);
            (await CreateController().Clone("repo")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Clone_Failure_ReturnsBadRequest()
        {
            _github.Setup(g => g.Clone("repo")).ReturnsAsync(false);
            (await CreateController().Clone("repo")).Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- CreateWebhook ----

        [Fact]
        public async Task CreateWebhook_RepoNull_ReturnsBadRequest()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            (await CreateController().CreateWebhook("id")).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task CreateWebhook_Success_ReturnsOk()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { RepoName = "org/repo" });
            _webhook.Setup(w => w.CreateWebhook(It.IsAny<Repo>())).ReturnsAsync(new GithubWebhook { Id = 1 });
            (await CreateController().CreateWebhook("id")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task CreateWebhook_WebhookNull_ReturnsBadRequest()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { RepoName = "org/repo" });
            _webhook.Setup(w => w.CreateWebhook(It.IsAny<Repo>())).ReturnsAsync((GithubWebhook)null);
            (await CreateController().CreateWebhook("id")).Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- Webhook ----

        private GithubController CreateControllerWithHttp(string body, string signature, string eventType)
        {
            var controller = CreateController();
            var httpContext = new DefaultHttpContext();
            httpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
            if (signature != null)
                httpContext.Request.Headers["X-Hub-Signature-256"] = signature;
            if (eventType != null)
                httpContext.Request.Headers["X-GitHub-Event"] = eventType;
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
            return controller;
        }

        [Fact]
        public async Task Webhook_MissingSignature_ReturnsBadRequest()
        {
            var controller = CreateControllerWithHttp("{}", null, "push");
            (await controller.Webhook("tenant")).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Webhook_WithSignature_ReturnsOk()
        {
            _buildService.Setup(b => b.HandleWebhookEventAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                         .ReturnsAsync(new BuildResponse());
            var controller = CreateControllerWithHttp("{\"ref\":\"main\"}", "sha256=deadbeef", "push");
            (await controller.Webhook("tenant")).Should().BeOfType<OkObjectResult>();
        }
    }
}
