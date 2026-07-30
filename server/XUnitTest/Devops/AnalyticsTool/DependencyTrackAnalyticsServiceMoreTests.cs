using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.TestingTools.Models;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    public class DependencyTrackAnalyticsServiceMoreTests
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IBuildRepository> _buildRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<IDbContextProvider> _dbProvider = new();
        private readonly IConfiguration _config;

        public DependencyTrackAnalyticsServiceMoreTests()
        {
            _secret.SetupGet(s => s.DependencyTrackApiKey).Returns("key");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["ScaToolsApiBaseUri"] = "https://sca.example.com" })
                .Build();
        }

        private DependencyTrackAnalyticsService CreateService()
        {
            var repoService = new DependencyTrackRepositoryService(_dbProvider.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);
            return new DependencyTrackAnalyticsService(
                new Mock<ILogger<DependencyTrackAnalyticsService>>().Object,
                _http.Object, _buildRepo.Object, _repoRepo.Object, repoService, _secret.Object, _config);
        }

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        [Fact]
        public async Task GetInfo_NoData_ReturnsScaReport()
        {
            // MakeHttpGetRequest returns default (null) -> handled by the catch, still returns a Sca report.
            var result = await CreateService().getInfo("org/repo", "main");
            result.Should().NotBeNull();
            result.Type.Should().Be("Sca");
        }

        [Fact]
        public async Task GetInfo_WithMetricsNoVersions_PopulatesDetails()
        {
            _http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new ScaLookupResponse { uuid = "u", metrics = new Metrics { critical = 2 }, versions = new List<VersionInfo>() }, ""));

            var result = await CreateService().getInfo("org/repo", "main");
            result.Type.Should().Be("Sca");
            result.Details.Should().ContainKey("critical");
        }

        [Fact]
        public async Task RetrieveScaProjectUuid_Success_ReturnsUuidAndUpdates()
        {
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new ScaLookupResponse { uuid = "uuid-1" }, Resp(HttpStatusCode.OK)));
            _repoRepo.Setup(r => r.UpdateRepoDependencyTrackProjectUuid(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(true);
            _buildRepo.Setup(b => b.UpdateBuildDependencyTrackProjectId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(true);

            var build = new Build { RepoName = "org/repo", Branch = "main", RepoId = "r1", ItemId = "b1", ProjectId = "p1" };
            var result = await CreateService().RetrieveScaProjectUuid(build);

            result.Should().Be("uuid-1");
            _repoRepo.Verify(r => r.UpdateRepoDependencyTrackProjectUuid("r1", "uuid-1", "p1"), Times.Once);
        }

        [Fact]
        public async Task RetrieveScaProjectUuid_NotFound_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new ScaLookupResponse(), Resp(HttpStatusCode.NotFound)));

            var build = new Build { RepoName = "org/repo", Branch = "main", RepoId = "r1", ItemId = "b1", ProjectId = "p1" };
            (await CreateService().RetrieveScaProjectUuid(build)).Should().BeNull();
        }

        [Fact]
        public async Task EnsureRepoProjectEntry_NullApiResult_ReturnsFalse()
        {
            var build = new Build { RepoId = "r1", ProjectId = "p1" };
            (await CreateService().EnsureRepoProjectEntry(build, null)).Should().BeFalse();
        }

        [Fact]
        public async Task EnsureRepoProjectEntry_NewEntry_ReturnsTrue()
        {
            // GetDependencyTrackProject falls back to null (no DB), so a fresh project + repo entry is created.
            var build = new Build { RepoId = "r1", ProjectId = "p1" };
            var apiResult = new ScaLookupResponse { uuid = "uuid-1" };
            (await CreateService().EnsureRepoProjectEntry(build, apiResult)).Should().BeTrue();
        }
    }
}
