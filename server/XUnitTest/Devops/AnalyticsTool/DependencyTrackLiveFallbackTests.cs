using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
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
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    /// <summary>
    /// #255 Dependency-Track: the live fallback for legacy builds (C10 exact version, C11 null aliases, C16 encoded alias
    /// links, null EPSS) and the calls the capture uses.
    /// </summary>
    public class DependencyTrackLiveFallbackTests
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IBuildRepository> _builds = new();
        private readonly Mock<IRepoRepository> _repos = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly IConfiguration _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string> { ["ScaToolsApiBaseUri"] = "https://dt.example.com" }).Build();

        public DependencyTrackLiveFallbackTests() => _secret.SetupGet(s => s.DependencyTrackApiKey).Returns("dt-key");

        private DependencyTrackAnalyticsService Create(DependencyTrackRepositoryService repoService = null) =>
            new(new Mock<ILogger<DependencyTrackAnalyticsService>>().Object, _http.Object, new BuildAndRepoRepositories(_builds.Object, _repos.Object),
                repoService, _secret.Object, _config, _notifications.Object);

        private void GivenLookup(params (string Uuid, string Version)[] versions) =>
            _http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.Is<string>(u => u.Contains("/api/v1/project/lookup")), null, It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new ScaLookupResponse
                {
                    uuid = "project", metrics = new Metrics { critical = 1, high = 2 },
                    versions = versions.Select(v => new VersionInfo { uuid = v.Uuid, version = v.Version }).ToList(),
                }, ""));

        private void GivenFindings(string uuid, params SCAVulnerability[] findings) =>
            _http.Setup(h => h.MakeHttpGetRequest<SCAVulnerability[]>(It.Is<string>(u => u.Contains($"/finding/project/{uuid}?")), null, It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((findings, ""));

        private static SCAVulnerability Finding(string id, List<Alias> aliases, double? epss = 0.1) => new()
        {
            component = new MyComponent { name = "lib-" + id, version = "1.0" },
            vulnerability = new Vulnerability { vulnId = id, severity = "HIGH", cvssV3BaseScore = 7.5, epssScore = epss, epssPercentile = epss, aliases = aliases },
        };

        // ---- C10 ----

        [Fact]
        public async Task C10_OnlyTheVersionEqualToTheBranchIsRead()
        {
            GivenLookup(("v-dev", "dev"), ("v-devx", "dev-x"), ("v-DEV", "DEV"), ("v-feature-dev", "feature/dev"), ("v-null", null));
            GivenFindings("v-dev", Finding("CVE-DEV", new()));
            GivenFindings("v-devx", Finding("CVE-DEVX", new()));

            var report = await Create().getInfo("org/repo", "dev");

            report.Vulnerabilities.Select(v => v.Id).Should().Equal("CVE-DEV");
            _http.Verify(h => h.MakeHttpGetRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()), Times.Once);
            _http.Verify(h => h.MakeHttpGetRequest<SCAVulnerability[]>("https://dt.example.com/api/v1/finding/project/v-dev?suppressed=false", null, It.IsAny<Dictionary<string, string>>()), Times.Once);
        }

        [Fact]
        public async Task C10_NoExactVersion_ReturnsMetricsAndNoFindings()
        {
            GivenLookup(("v-devx", "dev-x"));

            var report = await Create().getInfo("org/repo", "dev");

            report.Vulnerabilities.Should().BeEmpty();
            report.Details["critical"].Should().Be("1");
            _http.Verify(h => h.MakeHttpGetRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()), Times.Never);
        }

        // ---- C11 / null EPSS ----

        [Fact]
        public async Task C11_NullAliases_GiveAnEmptyListAndTheRestOfTheReport()
        {
            GivenLookup(("v-dev", "dev"));
            GivenFindings("v-dev",
                Finding("CVE-1", null, epss: null),
                Finding("CVE-2", new() { new() { cveId = "CVE-2" } }),
                new SCAVulnerability { component = new MyComponent { name = "no-vuln" }, vulnerability = null });

            var report = await Create().getInfo("org/repo", "dev");

            report.Details.Should().NotBeEmpty();
            report.Vulnerabilities.Should().HaveCount(3);
            var first = report.Vulnerabilities[0];
            first.Aliases.Should().NotBeNull().And.BeEmpty();
            first.EpssScore.Should().Be(0, "a null EPSS reads as 0");
            first.EpssPercentile.Should().Be(0);
            first.Score.Should().Be(7.5.ToString());
            report.Vulnerabilities[1].Aliases.Should().ContainSingle().Which.cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2");
            report.Vulnerabilities[2].Id.Should().BeNull();
            report.Vulnerabilities[2].Aliases.Should().BeEmpty();
        }

        // ---- C16 ----

        [Fact]
        public void C16_AliasIdentifiersAreUrlEncoded()
        {
            var links = DependencyTrackAnalyticsService.ConvertAliasesToLinkAliases(new List<Alias>
            {
                new() { cveId = "CVE-1&x=<script>", ghsaId = "GHSA-x/../y?z", osvId = "OSV 1#frag" },
            });

            var alias = links.Should().ContainSingle().Subject;
            alias.cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-1%26x%3D%3Cscript%3E");
            alias.ghsaId.Should().Be("https://github.com/advisories/GHSA-x%2F..%2Fy%3Fz");
            alias.osvId.Should().Be("https://osv.dev/vulnerability/OSV%201%23frag");
        }

        [Fact]
        public async Task C16_LiveFallbackLinksAreEncoded()
        {
            GivenLookup(("v-dev", "dev"));
            GivenFindings("v-dev", Finding("GHSA-x", new() { new() { ghsaId = "GHSA-x/../y?z" } }));

            var report = await Create().getInfo("org/repo", "dev");

            report.Vulnerabilities.Single().Aliases.Single().ghsaId.Should().Be("https://github.com/advisories/GHSA-x%2F..%2Fy%3Fz");
        }

        [Fact]
        public void C11_ConvertAliases_NullListOrNullEntries()
        {
            DependencyTrackAnalyticsService.ConvertAliasesToLinkAliases(null).Should().NotBeNull().And.BeEmpty();
            DependencyTrackAnalyticsService.ConvertAliasesToLinkAliases(new List<Alias> { null, new() { osvId = "PYSEC-1" } })
                .Should().ContainSingle().Which.osvId.Should().Be("https://osv.dev/vulnerability/PYSEC-1");
        }

        // ---- helpers ----

        [Theory]
        [InlineData("org/My_Repo", "org-my-repo")]
        [InlineData("--Org.Repo--", "org-repo")]
        [InlineData("plain", "plain")]
        public void FormatProjectName_IsTheBomProjectName(string repoName, string expected) =>
            DependencyTrackAnalyticsService.FormatProjectName(repoName).Should().Be(expected);

        [Fact]
        public void MetricsToDetails_HasEveryMetricsPropertyFormattedWithToString()
        {
            var details = DependencyTrackAnalyticsService.MetricsToDetails(new Metrics { critical = 4, inheritedRiskScore = 1.5, collectionLogic = null });

            details.Keys.Should().BeEquivalentTo(typeof(Metrics).GetProperties().Select(p => p.Name));
            details["critical"].Should().Be("4");
            details["inheritedRiskScore"].Should().Be(1.5.ToString());
            details["collectionLogic"].Should().Be("null");
            details.Should().NotContainKey("kev");
        }

        // ---- capture calls ----

        private void GivenRequest<T>(string urlPart, T body, HttpResponseMessage response) where T : class =>
            _http.Setup(h => h.MakeHttpRequest<T>(It.IsAny<string>(), It.Is<string>(u => u.Contains(urlPart)), HttpMethod.Get, It.IsAny<object>(),
                    It.Is<Dictionary<string, string>>(d => d["X-Api-Key"] == "dt-key"), It.IsAny<string>()))
                .ReturnsAsync((body, response));

        [Fact]
        public async Task LookupProjectAsync_EncodesNameAndBranch_AndDropsTheBodyOnFailure()
        {
            var build = new Build { RepoName = "org/My Repo", Branch = "feature/a&b" };
            GivenRequest("/api/v1/project/lookup?name=org-my-repo&version=feature%2Fa%26b", new ScaLookupResponse { uuid = "u" }, new HttpResponseMessage(HttpStatusCode.OK));

            var (project, status) = await Create().LookupProjectAsync(build);
            project.uuid.Should().Be("u");
            status.Should().Be(HttpStatusCode.OK);

            GivenRequest("/api/v1/project/lookup", new ScaLookupResponse { uuid = "u" }, new HttpResponseMessage(HttpStatusCode.Unauthorized));
            (project, status) = await Create().LookupProjectAsync(build);
            project.Should().BeNull();
            status.Should().Be(HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task RequestMetricsRefreshAsync_ReturnsTheStatus()
        {
            GivenRequest<object>("/api/v1/metrics/project/p%2F1/refresh", null, new HttpResponseMessage(HttpStatusCode.Forbidden));

            (await Create().RequestMetricsRefreshAsync("p/1")).Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task GetCurrentMetricsAsync_NullUnlessSuccessful()
        {
            GivenRequest("/api/v1/metrics/project/p1/current", new DependencyTrackProjectMetrics { kev = 2 }, new HttpResponseMessage(HttpStatusCode.OK));
            (await Create().GetCurrentMetricsAsync("p1")).kev.Should().Be(2);

            GivenRequest("/api/v1/metrics/project/p1/current", new DependencyTrackProjectMetrics { kev = 2 }, new HttpResponseMessage(HttpStatusCode.NotFound));
            (await Create().GetCurrentMetricsAsync("p1")).Should().BeNull();
        }

        [Fact]
        public async Task GetFindingsPageAsync_ReadsTheTotalHeader()
        {
            var ok = new HttpResponseMessage(HttpStatusCode.OK);
            ok.Headers.TryAddWithoutValidation("X-Total-Count", "250");
            GivenRequest("/api/v1/finding/project/p1?suppressed=false&pageSize=100&pageNumber=3", new[] { new SCAVulnerability() }, ok);

            var (items, total) = await Create().GetFindingsPageAsync("p1", 3, 100);

            items.Should().ContainSingle();
            total.Should().Be(250);
        }

        [Fact]
        public async Task GetFindingsPageAsync_MissingOrInvalidTotal_IsNull()
        {
            var bad = new HttpResponseMessage(HttpStatusCode.OK);
            bad.Headers.TryAddWithoutValidation("X-Total-Count", "lots");
            GivenRequest("pageNumber=1", Array.Empty<SCAVulnerability>(), bad);
            (await Create().GetFindingsPageAsync("p1", 1, 100)).Total.Should().BeNull();

            GivenRequest("pageNumber=2", Array.Empty<SCAVulnerability>(), new HttpResponseMessage(HttpStatusCode.OK));
            (await Create().GetFindingsPageAsync("p1", 2, 100)).Total.Should().BeNull();
        }

        [Fact]
        public async Task GetFindingsPageAsync_FailureOrNoBody_IsNull()
        {
            GivenRequest("pageNumber=1", new[] { new SCAVulnerability() }, new HttpResponseMessage(HttpStatusCode.InternalServerError));
            (await Create().GetFindingsPageAsync("p1", 1, 100)).Findings.Should().BeNull();

            GivenRequest<SCAVulnerability[]>("pageNumber=2", null, new HttpResponseMessage());
            (await Create().GetFindingsPageAsync("p1", 2, 100)).Findings.Should().BeNull();
        }

        [Fact]
        public async Task RecordProjectAsync_DoesTodaysBookkeepingWithoutANotification()
        {
            var kv = new Mock<IKeyValueStore>();
            kv.Setup(k => k.GetAsync<DependencyTrackProjects>(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<System.Threading.CancellationToken>()))
                .ReturnsAsync(new DependencyTrackProjects { ProjectId = "t1", RepoProjects = new() { new() { RepoId = "r1", ProjectUuid = "u1" } } });
            var repoService = new DependencyTrackRepositoryService(new Mock<IDbContextProvider>().Object, kv.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);
            BlocksContext.SetContext(BlocksContext.Create("t1", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo", "phone", "display", "oauth", "t1"));
            try
            {
                await Create(repoService).RecordProjectAsync(new Build { ItemId = "b1", RepoId = "r1", ProjectId = "t1" }, new ScaLookupResponse { uuid = "u1" });
            }
            finally
            {
                BlocksContext.ClearContext();
            }

            _repos.Verify(r => r.UpdateRepoDependencyTrackProjectUuid("r1", "u1", "t1"), Times.Once);
            _builds.Verify(b => b.UpdateBuildDependencyTrackProjectId("b1", "u1", "t1"), Times.Once);
            kv.Verify(k => k.GetAsync<DependencyTrackProjects>(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
            _notifications.Invocations.Should().BeEmpty();
        }
    }
}
