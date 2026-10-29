using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool.Capture
{
    /// <summary>
    /// #255 SCA capture: readiness through the exact-version lookup (H5, C10), the first-ready bookkeeping and metrics
    /// refresh (H13, C9), findings paging and bounding (H6, C11, C12), the schedule (H12), giving up (C2),
    /// idempotency (C3), tool errors (C4) and log redaction (C17).
    /// </summary>
    public class ScaCaptureServiceTests : IDisposable
    {
        internal const string ApiKey = "dt-secret-api-key-456";
        internal const string Uuid = "11111111-2222-3333-4444-555555555555";
        private static readonly DateTime Created = new(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc);
        private static readonly DateTimeOffset Now = new(2026, 10, 28, 10, 15, 0, TimeSpan.Zero);
        private static readonly DateTimeOffset BomAt = new(2026, 10, 28, 10, 5, 0, TimeSpan.Zero);
        private static readonly DateTimeOffset AnalysedAt = new(2026, 10, 28, 10, 6, 30, TimeSpan.Zero);

        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<IBuildRepository> _builds = new();
        private readonly Mock<IRepoRepository> _repos = new();
        private readonly Mock<IKeyValueStore> _kv = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly ListLogger<ScaCaptureService> _logger = new();
        private readonly ListLogger<DependencyTrackAnalyticsService> _dtLogger = new();
        private readonly FakeTimeProvider _clock = new(Now);
        private readonly IConfiguration _config;

        private readonly List<(int Expected, ScaReport Report)> _saved = new();
        private readonly List<ConsumerMessage<PostBuildQueue>> _sent = new();
        private readonly List<IDictionary<string, object>> _notified = new();
        private readonly List<string> _findingUrls = new();
        private bool _saveResult = true;

        public ScaCaptureServiceTests()
        {
            _secret.SetupGet(s => s.DependencyTrackApiKey).Returns(ApiKey);
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["ScaToolsApiBaseUri"] = "https://dt.example.com" })
                .Build();

            _builds.Setup(b => b.TrySaveScaReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<ScaReport>(), It.IsAny<string>()))
                .Callback<string, int, ScaReport, string>((_, expected, report, _) => _saved.Add((expected, report)))
                .ReturnsAsync(() => _saveResult);
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .Callback<ConsumerMessage<PostBuildQueue>>(_sent.Add)
                .Returns(Task.CompletedTask);
            _notifications.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .Callback<string, string, IEnumerable<string>, IDictionary<string, object>>((_, _, _, p) => _notified.Add(p))
                .ReturnsAsync(true);
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new DependencyTrackProjects { ItemId = "dtp-1", ProjectId = "tenant-1", RepoProjects = new List<RepoProject>() });

            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-1", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-1"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private DependencyTrackAnalyticsService DependencyTrack() =>
            new(_dtLogger, _http.Object, new BuildAndRepoRepositories(_builds.Object, _repos.Object),
                new DependencyTrackRepositoryService(new Mock<IDbContextProvider>().Object, _kv.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object),
                _secret.Object, _config, _notifications.Object);

        private ScaCaptureService Create() => new(DependencyTrack(), _builds.Object, _messages.Object, _logger, _notifications.Object, _clock);

        /// <summary>A build whose refresh was already requested (DependencyTrackProjectId set) unless <paramref name="refreshed"/> is false.</summary>
        private static Build NewBuild(int attempts = 0, bool refreshed = true) => new()
        {
            ItemId = "build-1",
            RepoId = "repo-1",
            ProjectId = "tenant-1",
            RepoName = "org/repo",
            Branch = "dev",
            PipelineRunName = "run-1",
            CreatedBy = "user-1",
            CreatedDate = Created,
            DependencyTrackProjectId = refreshed ? Uuid : null,
            ScaReport = new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = attempts },
        };

        private static ScaLookupResponse Project(string version = "dev", DateTimeOffset? bom = null, DateTimeOffset? analysed = null, bool nullTimes = false) => new()
        {
            uuid = Uuid,
            name = "org-repo",
            version = version,
            lastBomImport = nullTimes ? null : (bom ?? BomAt).ToUnixTimeMilliseconds(),
            lastVulnerabilityAnalysis = nullTimes ? null : (analysed ?? AnalysedAt).ToUnixTimeMilliseconds(),
        };

        internal static HttpResponseMessage Response(HttpStatusCode code, long? total = null)
        {
            var response = new HttpResponseMessage(code);
            if (total is not null) response.Headers.TryAddWithoutValidation("X-Total-Count", total.ToString());
            return response;
        }

        private void GivenLookup(ScaLookupResponse project, HttpStatusCode code = HttpStatusCode.OK) =>
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.Is<string>(u => u.Contains("/api/v1/project/lookup")), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((project, Response(code)));

        private void GivenRefresh(HttpStatusCode code) =>
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.Is<string>(u => u.EndsWith("/refresh")), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((null, Response(code)));

        private static DependencyTrackProjectMetrics Metrics() =>
            JsonSerializer.Deserialize<DependencyTrackProjectMetrics>("""
                { "critical": 1, "high": 2, "medium": 3, "low": 4, "unassigned": 0, "vulnerabilities": 10, "vulnerableComponents": 5,
                  "components": 120, "suppressed": 1, "findingsTotal": 10, "findingsAudited": 2, "findingsUnaudited": 8,
                  "inheritedRiskScore": 31.5, "kev": 2, "policyViolationsFail": 1, "policyViolationsTotal": 3,
                  "collectionLogic": "NONE", "collectionLogicChanged": false,
                  "firstOccurrence": 1761645600000, "lastOccurrence": 1761646000000 }
                """);

        private void GivenMetrics(DependencyTrackProjectMetrics metrics = null, HttpStatusCode code = HttpStatusCode.OK) =>
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackProjectMetrics>(It.IsAny<string>(), It.Is<string>(u => u.EndsWith("/current")), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((code == HttpStatusCode.OK ? metrics ?? Metrics() : null, Response(code)));

        /// <summary>Serves findings pages from <paramref name="page"/> (page number to items and optional total).</summary>
        private void GivenFindings(Func<int, (SCAVulnerability[] Items, long? Total, HttpStatusCode Code)> page) =>
            _http.Setup(h => h.MakeHttpRequest<SCAVulnerability[]>(It.IsAny<string>(), It.Is<string>(u => u.Contains("/api/v1/finding/project/")), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .Returns((string _, string url, HttpMethod _, object _, Dictionary<string, string> _, string _) =>
                {
                    _findingUrls.Add(url);
                    var number = int.Parse(url[(url.IndexOf("pageNumber=", StringComparison.Ordinal) + "pageNumber=".Length)..]);
                    var (items, total, code) = page(number);
                    return Task.FromResult<(SCAVulnerability[], HttpResponseMessage)>((items, Response(code, total)));
                });

        private void GivenFindings(params SCAVulnerability[] items) => GivenFindings(n => (n == 1 ? items : Array.Empty<SCAVulnerability>(), items.Length, HttpStatusCode.OK));

        private static SCAVulnerability Finding(string id, string severity = "HIGH", double? v3 = 7.5, string componentUuid = null) => new()
        {
            component = new MyComponent { uuid = componentUuid ?? "c-" + id, name = "lib-" + id, group = "org.example", version = "1.0.0", latestVersion = "1.2.0" },
            vulnerability = new Vulnerability
            {
                uuid = "v-" + id, vulnId = id, source = "NVD", severity = severity, cvssV3BaseScore = v3, description = "desc " + id,
                aliases = new List<Alias>(),
            },
        };

        private static SCAVulnerability[] Page(int page, int count) =>
            Enumerable.Range(0, count).Select(i => Finding($"CVE-{page}-{i}")).ToArray();

        private void GivenReadyProject()
        {
            GivenLookup(Project());
            GivenMetrics();
        }

        private void VerifyNoCaptureCalls()
        {
            _http.Verify(h => h.MakeHttpRequest<DependencyTrackProjectMetrics>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
            _http.Verify(h => h.MakeHttpRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
        }

        private void VerifyNoBookkeeping()
        {
            _repos.Verify(r => r.UpdateRepoDependencyTrackProjectUuid(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _builds.Verify(b => b.UpdateBuildDependencyTrackProjectId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            // Moq matches MakeHttpRequest<object> for every type argument, so the refresh is told apart by its URL.
            _http.Verify(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.Is<string>(u => u.EndsWith("/refresh")), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
        }

        private (int Expected, ScaReport Report) SingleSave() => _saved.Should().ContainSingle().Subject;

        private void ShouldBePendingAndScheduled(int attempt, int delayMinutes)
        {
            var (expected, report) = SingleSave();
            expected.Should().Be(attempt - 1);
            report.Status.Should().Be(AnalysisReportStatus.Pending);
            report.Attempts.Should().Be(attempt);
            report.Findings.Should().BeNullOrEmpty();
            var message = _sent.Should().ContainSingle().Subject;
            message.ConsumerName.Should().Be(CloudBuildConstants.POST_BUILD_LISTENER);
            message.Payload.PipelineEventType.Should().Be(PipelineEventTypes.CaptureScaReport);
            message.Payload.Attempt.Should().Be(attempt + 1);
            message.Payload.ProjectKey.Should().Be("tenant-1");
            message.Payload.PipelineRunName.Should().Be("run-1");
            message.ScheduledEnqueueTimeUtc.Should().Be(Now + TimeSpan.FromMinutes(delayMinutes));
            _notified.Should().BeEmpty();
        }

        // ---- H5 / H6 ----

        [Fact]
        public async Task H5_AnalysedBomSinceTheBuildStarted_SavesReadyWithThatProjectsData()
        {
            GivenReadyProject();
            GivenFindings(Finding("CVE-1", "CRITICAL", 9.8), Finding("CVE-2", "LOW", 3.1));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            var (expected, report) = SingleSave();
            expected.Should().Be(1);
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Attempts.Should().Be(2);
            report.CapturedAt.Should().Be(Now.UtcDateTime);
            report.Message.Should().BeNull();
            report.ProjectUuid.Should().Be(Uuid);
            report.ProjectName.Should().Be("org-repo");
            report.ProjectVersion.Should().Be("dev");
            report.BomImportedAt.Should().Be(BomAt.UtcDateTime);
            report.AnalyzedAt.Should().Be(AnalysedAt.UtcDateTime);
            report.FindingsTruncated.Should().BeFalse();
            report.Findings.Select(f => f.VulnId).Should().Equal("CVE-1", "CVE-2");

            report.Metrics.Critical.Should().Be(1);
            report.Metrics.High.Should().Be(2);
            report.Metrics.Medium.Should().Be(3);
            report.Metrics.Low.Should().Be(4);
            report.Metrics.Components.Should().Be(120);
            report.Metrics.InheritedRiskScore.Should().Be(31.5);
            report.Metrics.Kev.Should().Be(2);
            report.Metrics.PolicyViolationsFail.Should().Be(1);
            report.Metrics.CollectionLogic.Should().Be("NONE");
            report.Metrics.FirstOccurrence.Should().Be(1761645600000);
            report.Metrics.LastOccurrence.Should().Be(1761646000000);

            // The capture reads only this project (uuid) and never refreshes again.
            _findingUrls.Should().OnlyContain(u => u.Contains($"/api/v1/finding/project/{Uuid}?suppressed=false&pageSize=100&pageNumber="));
            VerifyNoBookkeeping();
            _sent.Should().BeEmpty();
        }

        [Fact]
        public async Task H5_LookupAsksForTheFormattedNameAndTheExactBranch()
        {
            string url = null;
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), HttpMethod.Get,
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .Callback<string, string, HttpMethod, object, Dictionary<string, string>, string>((_, u, _, _, _, _) => url = u)
                .ReturnsAsync((null, Response(HttpStatusCode.NotFound)));
            var build = NewBuild();
            build.Branch = "feature/x y";

            await Create().CaptureAsync(build, 1);

            url.Should().Be("https://dt.example.com/api/v1/project/lookup?name=org-repo&version=feature%2Fx%20y");
        }

        [Fact]
        public async Task H6_EveryFindingFieldIsStored()
        {
            var description = new string('d', 6000);
            GivenReadyProject();
            GivenFindings(new SCAVulnerability
            {
                component = new MyComponent { uuid = "c1", name = "lodash", group = "npm", version = "4.17.20", latestVersion = "4.17.21" },
                vulnerability = new Vulnerability
                {
                    uuid = "v1",
                    vulnId = "GHSA-35jh-r3h4-6jhm",
                    source = "GITHUB",
                    severity = "HIGH",
                    cvssV3BaseScore = null,
                    cvssV4Score = 8.7,
                    epssScore = null,
                    epssPercentile = null,
                    cweName = null,
                    cwes = new List<Cwe> { new() { cweId = 79, name = "Cross-site Scripting" }, new() { cweId = 94, name = "Code Injection" } },
                    description = description,
                    aliases = new List<Alias> { new() { cveId = "CVE-2021-23337", ghsaId = "GHSA-35jh-r3h4-6jhm", osvId = null } },
                },
            });

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            var f = SingleSave().Report.Findings.Should().ContainSingle().Subject;
            f.ComponentName.Should().Be("lodash");
            f.ComponentGroup.Should().Be("npm");
            f.ComponentVersion.Should().Be("4.17.20");
            f.LatestVersion.Should().Be("4.17.21");
            f.VulnId.Should().Be("GHSA-35jh-r3h4-6jhm");
            f.Source.Should().Be("GITHUB");
            f.Severity.Should().Be("HIGH");
            f.CvssV3BaseScore.Should().BeNull();
            f.CvssV4Score.Should().Be(8.7);
            f.EpssScore.Should().BeNull();
            f.EpssPercentile.Should().BeNull();
            f.CweName.Should().BeNull();
            f.Cwes.Select(c => (c.CweId, c.Name)).Should().Equal((79, "Cross-site Scripting"), (94, "Code Injection"));
            f.Description.Should().Be(description, "the full description is kept");
            var alias = f.Aliases.Should().ContainSingle().Subject;
            alias.CveId.Should().Be("CVE-2021-23337", "aliases are stored raw, not as links");
            alias.GhsaId.Should().Be("GHSA-35jh-r3h4-6jhm");
            alias.OsvId.Should().BeNull();
        }

        [Fact]
        public async Task H6_EpssValuesAndCweNameAreStoredWhenPresent()
        {
            GivenReadyProject();
            var finding = Finding("CVE-9", "MEDIUM", 5.5);
            finding.vulnerability.epssScore = 0.012;
            finding.vulnerability.epssPercentile = 0.77;
            finding.vulnerability.cweName = "Improper Input Validation";
            GivenFindings(finding);

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            var f = SingleSave().Report.Findings.Single();
            f.EpssScore.Should().Be(0.012);
            f.EpssPercentile.Should().Be(0.77);
            f.CweName.Should().Be("Improper Input Validation");
            f.CvssV3BaseScore.Should().Be(5.5);
        }

        [Fact]
        public async Task C11_FindingWithNullAliases_IsSavedWithAnEmptyListAndTheRestOfTheReport()
        {
            GivenReadyProject();
            var withNull = Finding("CVE-1");
            withNull.vulnerability.aliases = null;
            withNull.vulnerability.cwes = null;
            var withAliases = Finding("CVE-2");
            withAliases.vulnerability.aliases = new List<Alias> { null, new() { cveId = "CVE-2" } };
            GivenFindings(withNull, withAliases);

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            var report = SingleSave().Report;
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Findings.Should().HaveCount(2);
            report.Findings.Single(f => f.VulnId == "CVE-1").Aliases.Should().NotBeNull().And.BeEmpty();
            report.Findings.Single(f => f.VulnId == "CVE-1").Cwes.Should().NotBeNull().And.BeEmpty();
            report.Findings.Single(f => f.VulnId == "CVE-2").Aliases.Should().ContainSingle().Which.CveId.Should().Be("CVE-2");
        }

        [Fact]
        public async Task H14_Ready_NotifiesOnceWithScaTexts()
        {
            GivenReadyProject();
            GivenFindings();

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            var p = _notified.Should().ContainSingle().Subject;
            p["isSuccess"].Should().Be(true);
            p["analysisType"].Should().Be("SCA");
            p["title"].Should().Be("Dependency analysis finished");
            p["description"].Should().Be("The dependency (SCA) analysis of the build finished.");
            p["buildId"].Should().Be("build-1");
            _notifications.Verify(n => n.SendBuiltInAsync("tenant-1", "release-code-analysis-finished",
                It.Is<IEnumerable<string>>(u => u.SequenceEqual(new[] { "user-1" })), It.IsAny<IDictionary<string, object>>()), Times.Once);
        }

        // ---- readiness ----

        [Fact]
        public async Task Readiness_LookupNotFound_IsNotReady()
        {
            GivenLookup(null, HttpStatusCode.NotFound);

            await Create().CaptureAsync(NewBuild(), 1);

            ShouldBePendingAndScheduled(1, 2);
            VerifyNoCaptureCalls();
            VerifyNoBookkeeping();
            _logger.Entries.Should().Contain(e => e.Message.Contains("no project for the branch yet"));
        }

        [Fact]
        public async Task Readiness_LookupWithoutUuid_IsNotReady()
        {
            var project = Project();
            project.uuid = "";
            GivenLookup(project);

            await Create().CaptureAsync(NewBuild(), 1);

            ShouldBePendingAndScheduled(1, 2);
            VerifyNoCaptureCalls();
        }

        [Fact]
        public async Task C10_LookupReturnsAnotherVersion_IsNotReadyAndSavesNoData()
        {
            GivenLookup(Project(version: "dev-x"));
            GivenMetrics();
            GivenFindings(Finding("CVE-1"));

            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            ShouldBePendingAndScheduled(1, 2);
            VerifyNoCaptureCalls();
            VerifyNoBookkeeping();
            _kv.Verify(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task C10_VersionMatchIsCaseSensitive()
        {
            GivenLookup(Project(version: "Dev"));

            await Create().CaptureAsync(NewBuild(), 1);

            ShouldBePendingAndScheduled(1, 2);
        }

        public static TheoryData<string, DateTimeOffset?, DateTimeOffset?, bool> NotAnalysedYet => new()
        {
            { "BOM imported before the build started", new DateTimeOffset(2026, 10, 28, 9, 59, 59, TimeSpan.Zero), new DateTimeOffset(2026, 10, 28, 10, 6, 0, TimeSpan.Zero), false },
            { "analysis older than the BOM", null, new DateTimeOffset(2026, 10, 28, 10, 4, 59, TimeSpan.Zero), false },
            { "no BOM or analysis times", null, null, true },
        };

        [Theory]
        [MemberData(nameof(NotAnalysedYet))]
        public async Task Readiness_BomOrAnalysisNotNewEnough_IsNotReady(string because, DateTimeOffset? bom, DateTimeOffset? analysed, bool nullTimes)
        {
            GivenLookup(Project(bom: bom, analysed: analysed, nullTimes: nullTimes));

            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            ShouldBePendingAndScheduled(1, 2);
            VerifyNoBookkeeping();
            VerifyNoCaptureCalls();
            because.Should().NotBeNull();
        }

        [Fact]
        public async Task Readiness_BomAtCreatedDateAndAnalysisAtBom_IsReady()
        {
            var at = new DateTimeOffset(Created);
            GivenLookup(Project(bom: at, analysed: at));
            GivenMetrics();
            GivenFindings();

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            SingleSave().Report.Status.Should().Be(AnalysisReportStatus.Ready);
        }

        // ---- H12 ----

        [Theory]
        [InlineData(1, 2)]
        [InlineData(2, 5)]
        [InlineData(3, 10)]
        public async Task H12_NotReady_SavesPendingAndSchedulesTheNextAttempt(int attempt, int delayMinutes)
        {
            GivenLookup(null, HttpStatusCode.NotFound);

            await Create().CaptureAsync(NewBuild(attempts: attempt - 1), attempt);

            ShouldBePendingAndScheduled(attempt, delayMinutes);
        }

        // ---- H13 ----

        [Fact]
        public async Task H13_FirstReadyAttempt_RecordsTheProjectRequestsARefreshAndCapturesOnTheNextAttempt()
        {
            GivenReadyProject();
            GivenRefresh(HttpStatusCode.OK);
            GivenFindings(Finding("CVE-1"));
            _repos.Setup(r => r.UpdateRepoDependencyTrackProjectUuid("repo-1", Uuid, "tenant-1")).ReturnsAsync(true);
            _builds.Setup(b => b.UpdateBuildDependencyTrackProjectId("build-1", Uuid, "tenant-1")).ReturnsAsync(true);
            DependencyTrackProjects mapped = null;
            _kv.Setup(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .Callback<string, DependencyTrackProjects, bool, CancellationToken>((_, doc, _, _) => mapped = doc)
                .Returns(Task.CompletedTask);

            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            // Today's bookkeeping, without today's per-lookup notification.
            _repos.Verify(r => r.UpdateRepoDependencyTrackProjectUuid("repo-1", Uuid, "tenant-1"), Times.Once);
            _builds.Verify(b => b.UpdateBuildDependencyTrackProjectId("build-1", Uuid, "tenant-1"), Times.Once);
            mapped.Should().NotBeNull();
            mapped.RepoProjects.Should().ContainSingle(rp => rp.RepoId == "repo-1" && rp.ProjectUuid == Uuid);
            _notifications.Invocations.Should().BeEmpty();

            _http.Verify(h => h.MakeHttpRequest<object>(It.IsAny<string>(), $"https://dt.example.com/api/v1/metrics/project/{Uuid}/refresh", HttpMethod.Get,
                It.IsAny<object>(), It.Is<Dictionary<string, string>>(d => d["X-Api-Key"] == ApiKey), It.IsAny<string>()), Times.Once);
            VerifyNoCaptureCalls();
            ShouldBePendingAndScheduled(1, 2);

            // The next attempt finds the build already pointing at the project and captures.
            _saved.Clear();
            _sent.Clear();
            var next = NewBuild(attempts: 1);
            await Create().CaptureAsync(next, 2);

            var (expected, report) = SingleSave();
            expected.Should().Be(1);
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Attempts.Should().Be(2);
            _sent.Should().BeEmpty();
            _http.Verify(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.Is<string>(u => u.EndsWith("/refresh")), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Once, "the refresh is requested once per build");
        }

        [Fact]
        public async Task H13_RefreshAccepted_SchedulingFails_DoesNotThrow()
        {
            GivenReadyProject();
            GivenRefresh(HttpStatusCode.Accepted);
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>())).ThrowsAsync(new Exception("bus down"));

            var act = () => Create().CaptureAsync(NewBuild(refreshed: false), 1);

            await act.Should().NotThrowAsync();
            SingleSave().Report.Status.Should().Be(AnalysisReportStatus.Pending);
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains("Could not schedule SCA capture attempt 2"));
        }

        [Fact]
        public async Task H13_RefreshOnTheLastAttempt_CapturesNowInsteadOfFailing()
        {
            GivenReadyProject();
            GivenRefresh(HttpStatusCode.OK);
            GivenFindings(Finding("CVE-1"));

            await Create().CaptureAsync(NewBuild(attempts: 3, refreshed: false), 4);

            var (expected, report) = SingleSave();
            expected.Should().Be(3);
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Attempts.Should().Be(4);
            _sent.Should().BeEmpty();
            _notified.Should().ContainSingle().Which["isSuccess"].Should().Be(true);
        }

        // ---- C9 ----

        [Theory]
        [InlineData(HttpStatusCode.Unauthorized)]
        [InlineData(HttpStatusCode.Forbidden)]
        public async Task C9_RefreshRefused_LogsOneWarningWithoutTheKeyAndCapturesInTheSameAttempt(HttpStatusCode refused)
        {
            GivenReadyProject();
            GivenRefresh(refused);
            GivenFindings(Finding("CVE-1"));

            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            var (expected, report) = SingleSave();
            expected.Should().Be(0);
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Attempts.Should().Be(1);
            report.Metrics.Critical.Should().Be(1, "the metrics as currently reported are saved");
            _sent.Should().BeEmpty();

            var warnings = _logger.Entries.Where(e => e.Level == LogLevel.Warning).ToList();
            warnings.Should().ContainSingle();
            warnings[0].Message.Should().Contain(((int)refused).ToString()).And.Contain("PORTFOLIO_MANAGEMENT");
            _logger.AllText.Should().NotContain(ApiKey);
            _dtLogger.AllText.Should().NotContain(ApiKey);
        }

        [Fact]
        public async Task RefreshFailsOtherwise_IsNotReady()
        {
            GivenReadyProject();
            GivenRefresh(HttpStatusCode.InternalServerError);

            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            ShouldBePendingAndScheduled(1, 2);
            VerifyNoCaptureCalls();
            _logger.Entries.Should().Contain(e => e.Message.Contains("metrics refresh returned 500"));
        }

        // ---- pagination ----

        [Fact]
        public async Task Paging_StopsOnAShortPage()
        {
            GivenReadyProject();
            GivenFindings(n => (n switch { 1 => Page(1, 100), 2 => Page(2, 30), _ => throw new InvalidOperationException("read past the short page") }, null, HttpStatusCode.OK));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _findingUrls.Should().HaveCount(2);
            var report = SingleSave().Report;
            report.Findings.Should().HaveCount(130);
            report.FindingsTruncated.Should().BeFalse();
        }

        [Fact]
        public async Task Paging_StopsWhenTheTotalCountIsReached()
        {
            GivenReadyProject();
            GivenFindings(n => (Page(n, 100), 200, HttpStatusCode.OK));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _findingUrls.Should().HaveCount(2);
            _findingUrls.Should().Equal(
                $"https://dt.example.com/api/v1/finding/project/{Uuid}?suppressed=false&pageSize=100&pageNumber=1",
                $"https://dt.example.com/api/v1/finding/project/{Uuid}?suppressed=false&pageSize=100&pageNumber=2");
            SingleSave().Report.Findings.Should().HaveCount(200);
            SingleSave().Report.FindingsTruncated.Should().BeFalse();
        }

        [Fact]
        public async Task Paging_StopsWhenTheServerRepeatsAPage()
        {
            GivenReadyProject();
            GivenFindings(_ => (Page(1, 100), null, HttpStatusCode.OK)); // paging ignored: the same 100 every time

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _findingUrls.Should().HaveCount(2);
            SingleSave().Report.Findings.Should().HaveCount(100, "a repeated page adds nothing");
        }

        [Fact]
        public async Task Paging_StopsAfterTwentyPagesAndFlagsTheTruncation()
        {
            GivenReadyProject();
            GivenFindings(n => (Page(n, 100), null, HttpStatusCode.OK));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _findingUrls.Should().HaveCount(20);
            var report = SingleSave().Report;
            report.Findings.Should().HaveCount(2000);
            report.FindingsTruncated.Should().BeTrue();
        }

        [Fact]
        public async Task Paging_TwentyFullPagesWithAHigherTotal_FlagsTheTruncation()
        {
            GivenReadyProject();
            GivenFindings(n => (Page(n, 100), 5000, HttpStatusCode.OK));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _findingUrls.Should().HaveCount(20);
            SingleSave().Report.FindingsTruncated.Should().BeTrue();
        }

        [Fact]
        public async Task Paging_FindingsWithoutUuidsAreAllKept()
        {
            GivenReadyProject();
            var a = Finding("CVE-A");
            var b = Finding("CVE-B");
            a.component.uuid = null;
            b.vulnerability.uuid = null;
            GivenFindings(a, b);

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            SingleSave().Report.Findings.Should().HaveCount(2);
        }

        [Fact]
        public async Task C4_AFindingsPageFails_IsNotReady()
        {
            GivenReadyProject();
            GivenFindings(n => (n == 1 ? Page(1, 100) : null, null, n == 1 ? HttpStatusCode.OK : HttpStatusCode.InternalServerError));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            ShouldBePendingAndScheduled(2, 5);
        }

        [Fact]
        public async Task C4_MetricsUnavailable_IsNotReady()
        {
            GivenLookup(Project());
            GivenMetrics(code: HttpStatusCode.ServiceUnavailable);

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            ShouldBePendingAndScheduled(2, 5);
            _http.Verify(h => h.MakeHttpRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task C4_HelperSwallowedException_EmptyOkResponse_IsNotReady()
        {
            // HttpHelperServices answers an exception with (null, new HttpResponseMessage()), i.e. an empty 200.
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((null, new HttpResponseMessage()));

            await Create().CaptureAsync(NewBuild(), 1);

            ShouldBePendingAndScheduled(1, 2);
            _logger.Entries.Should().Contain(e => e.Message.Contains("lookup returned 200"));
        }

        [Fact]
        public async Task C4_ToolCallThrows_IsNotReadyWithoutThrowing()
        {
            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ThrowsAsync(new HttpRequestException("connection reset"));

            var act = () => Create().CaptureAsync(NewBuild(), 1);

            await act.Should().NotThrowAsync();
            ShouldBePendingAndScheduled(1, 2);
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Warning && e.Exception is HttpRequestException);
        }

        // ---- C2 ----

        [Fact]
        public async Task C2_Attempt4NotReady_SavesFailedAndNotifiesOnce()
        {
            GivenLookup(null, HttpStatusCode.NotFound);

            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            var (expected, report) = SingleSave();
            expected.Should().Be(3);
            report.Status.Should().Be(AnalysisReportStatus.Failed);
            report.Attempts.Should().Be(4);
            report.Message.Should().Be("Dependency-Track results were not available after 4 attempts.");
            _sent.Should().BeEmpty();
            var p = _notified.Should().ContainSingle().Subject;
            p["isSuccess"].Should().Be(false);
            p["analysisType"].Should().Be("SCA");
            p["title"].Should().Be("Dependency analysis failed");
            p["description"].Should().Be("Dependency-Track results were not available after 4 attempts.");
        }

        [Fact]
        public async Task C2_Attempt4NotReady_WriteMatchesNothing_DoesNotNotify()
        {
            GivenLookup(null, HttpStatusCode.NotFound);
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            _notified.Should().BeEmpty();
            _sent.Should().BeEmpty();
        }

        // ---- C3 ----

        public static TheoryData<string, int?, int> NotAwaited => new()
        {
            { AnalysisReportStatus.Ready, 2, 3 },
            { AnalysisReportStatus.Failed, 4, 4 },
            { AnalysisReportStatus.NotRun, 0, 1 },
            { AnalysisReportStatus.Pending, 2, 2 },
            { AnalysisReportStatus.Pending, 1, 4 },
            { null, null, 1 },
        };

        [Theory]
        [MemberData(nameof(NotAwaited))]
        public async Task C3_MessageTheReportIsNotWaitingFor_DoesNothing(string status, int? attempts, int attempt)
        {
            GivenReadyProject();
            var build = NewBuild();
            build.ScaReport = status is null ? null : new ScaReport { Status = status, Attempts = attempts ?? 0 };

            var act = () => Create().CaptureAsync(build, attempt);

            await act.Should().NotThrowAsync();
            _http.Invocations.Should().BeEmpty();
            _builds.Invocations.Should().BeEmpty();
            _repos.Invocations.Should().BeEmpty();
            _messages.Invocations.Should().BeEmpty();
            _notifications.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task C3_ReadyButTheConditionalWriteMatchesNothing_DoesNotNotify()
        {
            GivenReadyProject();
            GivenFindings(Finding("CVE-1"));
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            _saved.Should().ContainSingle();
            _notified.Should().BeEmpty();
            _sent.Should().BeEmpty();
        }

        [Fact]
        public async Task C3_NotReadyButTheConditionalWriteMatchesNothing_SchedulesNothing()
        {
            GivenLookup(null, HttpStatusCode.NotFound);
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Should().ContainSingle();
            _sent.Should().BeEmpty();
        }

        // ---- C12 ----

        private static ScaFinding F(string id, string severity, double? v3 = null, double? v4 = null, string description = null) =>
            new() { VulnId = id, Severity = severity, CvssV3BaseScore = v3, CvssV4Score = v4, Description = description, Aliases = new(), Cwes = new() };

        [Fact]
        public void C12_BoundFindings_OrdersBySeverityThenCvssV3OrV4Descending()
        {
            var input = new[]
            {
                F("low", "LOW", 3.0),
                F("unassigned", "UNASSIGNED", 9.9),
                F("info", "INFO", 0.0),
                F("crit-v4", "CRITICAL", v4: 9.3),
                F("crit-v3-low", "critical", 9.0),
                F("crit-v3", "CRITICAL", 9.8, v4: 1.0),
                F("crit-none", "CRITICAL"),
                F("weird", "SOMETHING", 10.0),
                F("medium", "MEDIUM", 5.0),
                F("high-v4", "HIGH", v4: 8.9),
                F("high-v3", "HIGH", 7.1),
                F("null-sev", null, 10.0),
            };

            var (kept, truncated) = ScaCaptureService.BoundFindings(input);

            truncated.Should().BeFalse();
            kept.Select(f => f.VulnId).Should().Equal(
                "crit-v3", "crit-v4", "crit-v3-low", "crit-none",
                "high-v4", "high-v3",
                "medium", "low", "info", "unassigned",
                "weird", "null-sev");
        }

        [Fact]
        public void C12_BoundFindings_ExactlyTwoThousand_IsNotTruncated()
        {
            var (kept, truncated) = ScaCaptureService.BoundFindings(Enumerable.Range(0, 2000).Select(i => F($"f{i}", "LOW", 1.0)));

            kept.Should().HaveCount(2000);
            truncated.Should().BeFalse();
        }

        [Fact]
        public void C12_BoundFindings_MoreThanTwoThousand_KeepsTheMostSevereTwoThousand()
        {
            var input = Enumerable.Range(0, 2000).Select(i => F($"low{i}", "LOW", 1.0))
                .Append(F("crit", "CRITICAL", 9.0))
                .Append(F("high", "HIGH", 7.0));

            var (kept, truncated) = ScaCaptureService.BoundFindings(input);

            kept.Should().HaveCount(ScaCaptureService.MaxSavedFindings).And.HaveCount(2000);
            truncated.Should().BeTrue();
            kept[0].VulnId.Should().Be("crit");
            kept[1].VulnId.Should().Be("high");
        }

        [Fact]
        public void C12_BoundFindings_CutsAtFourMegabytesKeepingTheMostSevere()
        {
            var big = new string('x', 100 * 1024);
            var input = Enumerable.Range(0, 30).Select(i => F($"low{i}", "LOW", 2.0, description: big))
                .Concat(Enumerable.Range(0, 30).Select(i => F($"crit{i}", "CRITICAL", 9.0, description: big)));

            var (kept, truncated) = ScaCaptureService.BoundFindings(input);

            truncated.Should().BeTrue();
            kept.Should().HaveCountLessThan(60);
            kept.Take(30).Should().OnlyContain(f => f.Severity == "CRITICAL");
            JsonSerializer.SerializeToUtf8Bytes(kept).Length.Should().BeLessThanOrEqualTo(ScaCaptureService.MaxSavedFindingsBytes);
            ScaCaptureService.MaxSavedFindingsBytes.Should().Be(4 * 1024 * 1024);
            // One more finding would have crossed the bound.
            JsonSerializer.SerializeToUtf8Bytes(kept.Append(input.First())).Length.Should().BeGreaterThan(ScaCaptureService.MaxSavedFindingsBytes);
        }

        [Fact]
        public void C12_BoundFindings_Empty()
        {
            var (kept, truncated) = ScaCaptureService.BoundFindings(Array.Empty<ScaFinding>());
            kept.Should().BeEmpty();
            truncated.Should().BeFalse();
        }

        [Fact]
        public async Task C12_CaptureSavesTheBoundedSortedFindings()
        {
            GivenReadyProject();
            GivenFindings(Finding("CVE-L", "LOW", 2.0), Finding("CVE-C", "CRITICAL", 9.1), Finding("CVE-H", "HIGH", 7.0));

            await Create().CaptureAsync(NewBuild(attempts: 1), 2);

            SingleSave().Report.Findings.Select(f => f.VulnId).Should().Equal("CVE-C", "CVE-H", "CVE-L");
        }

        // ---- C17 ----

        [Fact]
        public async Task C17_TheDependencyTrackKeyIsNeverLoggedOrSaved()
        {
            GivenReadyProject();
            GivenRefresh(HttpStatusCode.Forbidden);
            GivenFindings(Finding("CVE-1"));
            await Create().CaptureAsync(NewBuild(refreshed: false), 1);

            _http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ThrowsAsync(new HttpRequestException("connection reset"));
            _notifications.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .ThrowsAsync(new Exception("notifier down"));
            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            _logger.Entries.Should().NotBeEmpty();
            _logger.AllText.Should().NotContain(ApiKey);
            _dtLogger.AllText.Should().NotContain(ApiKey);
            foreach (var (_, report) in _saved)
                JsonSerializer.Serialize(report).Should().NotContain(ApiKey);
        }
    }
}
