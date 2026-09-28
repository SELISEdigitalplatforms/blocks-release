using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Devops.DomainService.TestingTools.Models;
using Devops.DomainService.AnalyticsTool.Services.Sast;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers
{
    public class AnalyticsToolControllerTests : IDisposable
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IBuildRepository> _buildRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<ISonarQubeAuthService> _sonar = new();
        private readonly Mock<ITokenRepository> _tokenRepo = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<IDbContextProvider> _dbProvider = new();
        private readonly IConfiguration _config;

        public AnalyticsToolControllerTests()
        {
            _secret.SetupGet(s => s.DependencyTrackApiKey).Returns("key");
            _secret.SetupGet(s => s.DependencyTrackDefaultTeamId).Returns("team");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["DependencyTrackBaseUrl"] = "https://dt.example.com",
                    ["ScaToolsApiBaseUri"] = "https://sca.example.com"
                })
                .Build();
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-at", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-at"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private AnalyticsToolController CreateController()
        {
            var repoService = new DependencyTrackRepositoryService(_dbProvider.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);
            var dtAuth = new DependencyTrackAuthService(new Mock<ILogger<DependencyTrackAuthService>>().Object, _http.Object, _config, repoService, _secret.Object);
            var sca = new DependencyTrackAnalyticsService(new Mock<ILogger<DependencyTrackAnalyticsService>>().Object, _http.Object, _buildRepo.Object, _repoRepo.Object, repoService, _secret.Object, _config);
            return new AnalyticsToolController(dtAuth, sca, _buildRepo.Object, _sonar.Object, _tokenRepo.Object);
        }

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code) { Content = new StringContent(string.Empty) };

        // ---- ProcessSonarQubeUser ----

        [Fact]
        public async Task ProcessSonarQubeUser_ValidBuild_ReturnsOk()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = "org/repo", ProjectId = "p1" });
            _sonar.Setup(s => s.ProcessSonarQubeUser("bob", "org/repo", "p1")).ReturnsAsync(true);

            var result = await CreateController().ProcessSonarQubeUser("bid");

            result.Should().BeOfType<OkObjectResult>();
            (((OkObjectResult)result).Value as BaseResponse).IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_ValidBuild_ReturnsSonarProjectKeyAndBranch()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = "org/repo", Branch = "feature/x", ProjectId = "p1" });
            _sonar.Setup(s => s.ProcessSonarQubeUser("bob", "org/repo", "p1")).ReturnsAsync(true);

            var data = DataOf(await CreateController().ProcessSonarQubeUser("bid"));

            data.GetProperty("projectKey").GetString().Should().Be("org-repo");
            data.GetProperty("branch").GetString().Should().Be("feature/x");
        }

        [Fact]
        public async Task ProcessSonarQubeUser_NullRepoName_ReturnsNullProjectKey()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = null, Branch = "dev", ProjectId = "p1" });

            var result = await CreateController().ProcessSonarQubeUser("bid");

            result.Should().BeOfType<OkObjectResult>();
            DataOf(result).GetProperty("projectKey").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task ProcessSonarQubeUser_NullBuild_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync((Build)null);

            var result = await CreateController().ProcessSonarQubeUser("bid");

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_EmptyUserName_ReturnsBadRequest()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = null });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = "org/repo" });

            var result = await CreateController().ProcessSonarQubeUser("bid");

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        // ---- ProcessDependencyTrackUser ----

        [Fact]
        public async Task ProcessDependencyTrackUser_NoBuild_ReturnsOk()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild(It.IsAny<string>())).ReturnsAsync((Build)null);
            // Underlying DependencyTrackAuthService HTTP calls
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.Created)));
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateController().ProcessDependencyTrackUser("bid");

            result.Should().BeOfType<OkObjectResult>();
            DataOf(result).GetProperty("projectUuid").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task ProcessDependencyTrackUser_WithBuild_ReturnsDependencyTrackProjectUuid()
        {
            _tokenRepo.Setup(t => t.GetUserByIdAsync(It.IsAny<string>())).ReturnsAsync(new User { UserName = "bob" });
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = "org/repo", Branch = "dev", RepoId = "r1", ItemId = "bid", ProjectId = "p1" });
            // Moq matches the <object> setup for every type argument and the last matching setup wins,
            // so the typed setups must be registered after it.
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.Created)));
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new ScaLookupResponse { uuid = "dt-uuid-1" }, Resp(HttpStatusCode.OK)));
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateController().ProcessDependencyTrackUser("bid");

            result.Should().BeOfType<OkObjectResult>();
            DataOf(result).GetProperty("projectUuid").GetString().Should().Be("dt-uuid-1");
        }

        // Data is an anonymous object; round-trip it through JSON the way the client receives it.
        private static JsonElement DataOf(IActionResult result)
        {
            var body = ((OkObjectResult)result).Value.Should().BeOfType<BaseApiResponse>().Subject;
            return JsonSerializer.SerializeToElement(body.Data);
        }
    }
}
