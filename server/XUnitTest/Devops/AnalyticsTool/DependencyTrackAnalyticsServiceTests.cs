using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Devops.AnalyticsTool
{
    public class DependencyTrackAnalyticsServiceTests
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IBuildRepository> _buildRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config;

        public DependencyTrackAnalyticsServiceTests()
        {
            _secret.SetupGet(s => s.DependencyTrackApiKey).Returns("api-key");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["ScaToolsApiBaseUri"] = "https://sca.example.com"
                })
                .Build();
        }

        private DependencyTrackAnalyticsService CreateService() =>
            new(new Mock<ILogger<DependencyTrackAnalyticsService>>().Object,
                _http.Object, _buildRepo.Object, _repoRepo.Object, null, _secret.Object, _config);

        [Fact]
        public void ConvertAliasesToLinkAliases_BuildsAdvisoryLinks()
        {
            var input = new List<Alias>
            {
                new() { cveId = "CVE-2021-1", ghsaId = "GHSA-abc", osvId = "OSV-1" },
                new() { cveId = null, ghsaId = "", osvId = null }
            };

            var result = DependencyTrackAnalyticsService.ConvertAliasesToLinkAliases(input);

            result.Should().HaveCount(2);
            result[0].cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-1");
            result[0].ghsaId.Should().Be("https://github.com/advisories/GHSA-abc");
            result[0].osvId.Should().Be("https://osv.dev/vulnerability/OSV-1");
            result[1].cveId.Should().BeNull();
            result[1].ghsaId.Should().BeNull();
            result[1].osvId.Should().BeNull();
        }

        [Fact]
        public async Task GetInfo_PopulatesMetricsDetailsAndVulnerabilities()
        {
            var lookup = new ScaLookupResponse
            {
                uuid = "proj-uuid",
                metrics = new Metrics { critical = 3, high = 4 },
                versions = new List<VersionInfo>
                {
                    new() { uuid = "v-uuid", version = "1.0.0", active = true }
                }
            };
            var vulns = new[]
            {
                new SCAVulnerability
                {
                    component = new MyComponent { name = "comp", version = "1.0", latestVersion = "2.0", group = "g" },
                    vulnerability = new Vulnerability
                    {
                        vulnId = "CVE-1",
                        cvssV3BaseScore = 9.1,
                        severity = "CRITICAL",
                        epssScore = 0.5,
                        epssPercentile = 0.9,
                        description = "bad",
                        cweName = "XSS",
                        aliases = new List<Alias> { new() { cveId = "CVE-1" } }
                    }
                }
            };

            _http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(
                    It.Is<string>(u => u.Contains("project/lookup")), null,
                    It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((lookup, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SCAVulnerability[]>(
                    It.Is<string>(u => u.Contains("finding/project")), null,
                    It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((vulns, ""));

            var service = CreateService();

            var report = await service.getInfo("My Repo", "1.0");

            report.Type.Should().Be("Sca");
            report.Details.Should().ContainKey("critical").WhoseValue.Should().Be("3");
            report.Details.Should().ContainKey("high").WhoseValue.Should().Be("4");
            report.Vulnerabilities.Should().ContainSingle();
            var v = report.Vulnerabilities[0];
            v.Name.Should().Be("comp");
            v.Id.Should().Be("CVE-1");
            v.Score.Should().Be("9.1");
            v.Severity.Should().Be("CRITICAL");
            v.Aliases[0].cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-1");
        }

        [Fact]
        public async Task GetInfo_WhenHttpThrows_ReturnsReportWithoutDetails()
        {
            _http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new HttpRequestException("network down"));

            var service = CreateService();

            var report = await service.getInfo("repo", "1.0");

            report.Type.Should().Be("Sca");
            report.Details.Should().BeNull();
            report.Vulnerabilities.Should().BeNull();
        }

        [Fact]
        public async Task RetrieveScaProjectUuid_NotFound_ReturnsNull()
        {
            var response = new HttpResponseMessage(HttpStatusCode.NotFound);
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((new ScaLookupResponse { uuid = "x" }, response));

            var service = CreateService();

            var result = await service.RetrieveScaProjectUuid(new Build { RepoName = "repo", Branch = "main" });

            result.Should().BeNull();
        }

        [Fact]
        public async Task EnsureRepoProjectEntry_NullResult_ReturnsFalse()
        {
            var service = CreateService();

            var result = await service.EnsureRepoProjectEntry(new Build { ProjectId = "p1" }, null);

            result.Should().BeFalse();
        }
    }
}
