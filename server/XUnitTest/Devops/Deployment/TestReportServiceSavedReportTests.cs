using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Moq;
using XUnitTest.Devops.AnalyticsTool.Capture;
using XUnitTest.TestDoubles;
using Xunit;
using Genesis = Blocks.Genesis.Entities.Release;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// #255 GET /build/reports: saved reports are returned without any SonarQube or Dependency-Track call (H7, C14, C18),
    /// a stale Pending reads as Failed without a write (C8), legacy builds keep the live path and shape (H9, C20), and an
    /// unknown build behaves as today (C15).
    /// </summary>
    public class TestReportServiceSavedReportTests
    {
        private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
        private static readonly DateTime Created = new(2026, 10, 28, 8, 0, 0, DateTimeKind.Utc);
        private static readonly string[] TodaysKeys = { "type", "details", "vulnerabilities", "qualityGate", "issueBreakdown" };
        private static readonly string[] NewKeys = { "status", "message", "capturedAt", "analysisDate", "revision", "analyzedAt", "findingsTruncated" };

        private readonly DeploymentServiceFactory _f = new();
        private readonly FakeTimeProvider _clock = new(new DateTimeOffset(Created).AddMinutes(30));

        private TestReportService Create() =>
            new(_f.BuildRepo.Object, new SASTStrategy(_f.Http.Object, _f.Secret.Object, _f.Config), _f.ScaAnalyticsService(), new DASTStrategy(), _clock);

        private void GivenBuild(Build build) => _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(build);

        private static Build NewBuild(SastReport sast = null, ScaReport sca = null) => new()
        {
            ItemId = "b1",
            RepoName = "org/repo",
            Branch = "dev",
            ImageName = "registry/img:1",
            ProjectId = "tenant-1",
            CreatedDate = Created,
            SastReport = sast,
            ScaReport = sca,
        };

        private static JsonObject ToJson(TestReport report) => JsonNode.Parse(JsonSerializer.Serialize(report, Web))!.AsObject();

        private void VerifyNoToolCall() => _f.Http.Invocations.Should().BeEmpty("a saved report makes no SonarQube or Dependency-Track call");

        private void VerifyNoReportWrite() =>
            _f.BuildRepo.Invocations.Select(i => i.Method.Name).Should().OnlyContain(n => n == "GetBuild", "reading never writes the stored report");

        private static SastReport ReadySast() => new()
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = 1,
            CapturedAt = new DateTime(2026, 10, 28, 8, 9, 0, DateTimeKind.Utc),
            AnalysisDate = new DateTime(2026, 10, 28, 8, 6, 12, DateTimeKind.Utc),
            AnalysisKey = "AZ-1",
            Revision = "abc1234def",
            ProjectKey = "org-repo",
            Branch = "dev",
            Metrics = new Dictionary<string, string> { ["new_violations"] = "367", ["alert_status"] = "ERROR" },
            QualityGate = new Genesis.SastQualityGate
            {
                Status = "ERROR",
                Conditions = new() { new() { MetricKey = "new_violations", Comparator = "GT", ErrorThreshold = "0", ActualValue = "367", Status = "ERROR" } }
            },
            IssueBreakdown = new Genesis.SastIssueBreakdown
            {
                NewCode = new() { Total = 367, High = 3 },
                Overall = new() { Total = 1200, Blocker = 1 },
            },
        };

        private static ScaReport ReadySca() => new()
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = 2,
            CapturedAt = new DateTime(2026, 10, 28, 8, 15, 0, DateTimeKind.Utc),
            AnalyzedAt = new DateTime(2026, 10, 28, 8, 6, 30, DateTimeKind.Utc),
            BomImportedAt = new DateTime(2026, 10, 28, 8, 5, 0, DateTimeKind.Utc),
            ProjectUuid = "p-uuid",
            ProjectName = "org-repo",
            ProjectVersion = "dev",
            FindingsTruncated = true,
            Metrics = new ScaMetrics { Critical = 1, High = 2, Kev = 1, InheritedRiskScore = 12.5, FirstOccurrence = 1761645600000 },
            Findings = new List<ScaFinding>
            {
                new()
                {
                    ComponentName = "lodash", ComponentGroup = "npm", ComponentVersion = "4.17.20", LatestVersion = "4.17.21",
                    VulnId = "CVE-2021-23337", Source = "NVD", Severity = "CRITICAL", CvssV3BaseScore = 9.8, CvssV4Score = 9.3,
                    EpssScore = null, EpssPercentile = 0.4, CweName = "Command Injection", Description = "full description",
                    Cwes = new() { new() { CweId = 77, Name = "Command Injection" } },
                    Aliases = new() { new() { CveId = "CVE-2021-23337", GhsaId = "GHSA-x/../y?z" } },
                },
            },
        };

        // ---- H7 / C18 ----

        [Fact]
        public async Task H7_ReadySast_ReturnsTheSavedDataWithoutCallingSonarQube()
        {
            GivenBuild(NewBuild(sast: ReadySast(), sca: ReadySca()));

            var report = await Create().GetReport("b1", "sast");

            report.Type.Should().Be("SAST");
            report.Status.Should().Be("Ready");
            report.Message.Should().BeNull();
            report.CapturedAt.Should().Be(new DateTime(2026, 10, 28, 8, 9, 0, DateTimeKind.Utc));
            report.AnalysisDate.Should().Be(new DateTime(2026, 10, 28, 8, 6, 12, DateTimeKind.Utc));
            report.Revision.Should().Be("abc1234def");
            report.Details.Should().Equal(new Dictionary<string, string> { ["new_violations"] = "367", ["alert_status"] = "ERROR" });
            report.QualityGate.Should().BeEquivalentTo(ReadySast().QualityGate);
            report.QualityGate.Should().BeOfType<global::Devops.DomainService.TestingTools.Models.SastQualityGate>("today's local response type");
            report.IssueBreakdown.Should().BeEquivalentTo(ReadySast().IssueBreakdown);
            report.Vulnerabilities.Should().BeNull();
            report.AnalyzedAt.Should().BeNull();
            report.FindingsTruncated.Should().BeNull();
            VerifyNoToolCall();
            VerifyNoReportWrite();
            _f.BuildRepo.Verify(b => b.GetBuild("b1"), Times.Once, "one indexed read per request (C18)");
        }

        [Fact]
        public async Task H7_ReadySastWithoutMetrics_ReturnsNullDetails()
        {
            var sast = ReadySast();
            sast.Metrics = new Dictionary<string, string>();
            GivenBuild(NewBuild(sast: sast));

            var report = await Create().GetReport("b1", "sast");

            report.Status.Should().Be("Ready");
            report.Details.Should().BeNull();
            VerifyNoToolCall();
        }

        [Fact]
        public async Task H7_ReadySca_ReturnsTheSavedDataInTodaysShapeWithoutCallingDependencyTrack()
        {
            GivenBuild(NewBuild(sast: ReadySast(), sca: ReadySca()));

            var report = await Create().GetReport("b1", "sca-libraries");

            report.Type.Should().Be("Sca");
            report.Status.Should().Be("Ready");
            report.Message.Should().BeNull();
            report.CapturedAt.Should().Be(new DateTime(2026, 10, 28, 8, 15, 0, DateTimeKind.Utc));
            report.AnalyzedAt.Should().Be(new DateTime(2026, 10, 28, 8, 6, 30, DateTimeKind.Utc));
            report.FindingsTruncated.Should().BeTrue();
            report.AnalysisDate.Should().BeNull();
            report.Revision.Should().BeNull();
            report.QualityGate.Should().BeNull();
            report.IssueBreakdown.Should().BeNull();
            report.Details.Should().Equal(AnalysisReportMapper.ToDetails(ReadySca().Metrics));
            report.Details["critical"].Should().Be("1");
            report.Details["kev"].Should().Be("1");
            report.Details["inheritedRiskScore"].Should().Be(12.5.ToString());
            report.Details["firstOccurrence"].Should().Be("1761645600000");

            var v = report.Vulnerabilities.Should().ContainSingle().Subject;
            v.Name.Should().Be("lodash");
            v.Group.Should().Be("npm");
            v.Version.Should().Be("4.17.20");
            v.LatestVersion.Should().Be("4.17.21");
            v.Id.Should().Be("CVE-2021-23337");
            v.Score.Should().Be(9.8.ToString());
            v.Severity.Should().Be("CRITICAL");
            v.EpssScore.Should().Be(0);
            v.EpssPercentile.Should().Be(0.4);
            v.CweName.Should().Be("Command Injection");
            v.Description.Should().Be("full description");
            v.Aliases.Should().ContainSingle();
            v.Aliases[0].cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-23337");
            v.Aliases[0].ghsaId.Should().Be("https://github.com/advisories/GHSA-x%2F..%2Fy%3Fz");
            VerifyNoToolCall();
            VerifyNoReportWrite();
        }

        [Fact]
        public async Task H7_ReadyScaWithoutFindingsOrMetrics_ReturnsEmptyData()
        {
            GivenBuild(NewBuild(sca: new ScaReport { Status = AnalysisReportStatus.Ready, Attempts = 1, Findings = null, Metrics = null }));

            var report = await Create().GetReport("b1", "sca-libraries");

            report.Status.Should().Be("Ready");
            report.Vulnerabilities.Should().NotBeNull().And.BeEmpty();
            report.Details.Should().NotBeNull().And.BeEmpty();
            VerifyNoToolCall();
        }

        // ---- C8 ----

        [Theory]
        [InlineData("sast", "SAST")]
        [InlineData("sca-libraries", "Sca")]
        public async Task C8_PendingUnderTwoHours_IsPending(string type, string reportType)
        {
            _clock.Now = new DateTimeOffset(Created).AddHours(1).AddMinutes(59);
            GivenBuild(NewBuild(sast: new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 2 }, sca: new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = 2 }));

            var report = await Create().GetReport("b1", type);

            report.Type.Should().Be(reportType);
            report.Status.Should().Be("Pending");
            report.Message.Should().BeNull();
            report.Details.Should().BeNull();
            report.Vulnerabilities.Should().BeNull();
            report.QualityGate.Should().BeNull();
            report.IssueBreakdown.Should().BeNull();
            report.CapturedAt.Should().BeNull();
            VerifyNoToolCall();
            VerifyNoReportWrite();
        }

        [Theory]
        [InlineData("sast", "SAST")]
        [InlineData("sca-libraries", "Sca")]
        public async Task C8_PendingOverTwoHours_ReadsAsFailedWithoutWriting(string type, string reportType)
        {
            _clock.Now = new DateTimeOffset(Created).AddHours(2).AddMinutes(1);
            GivenBuild(NewBuild(sast: new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 2 }, sca: new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = 2 }));

            var report = await Create().GetReport("b1", type);

            report.Type.Should().Be(reportType);
            report.Status.Should().Be("Failed");
            report.Message.Should().Be("Results were not captured.");
            report.Details.Should().BeNull();
            report.Vulnerabilities.Should().BeNull();
            report.QualityGate.Should().BeNull();
            report.IssueBreakdown.Should().BeNull();
            VerifyNoToolCall();
            VerifyNoReportWrite();
        }

        [Fact]
        public async Task C8_ExactlyTwoHours_IsStillPending()
        {
            _clock.Now = new DateTimeOffset(Created).AddHours(2);
            GivenBuild(NewBuild(sast: new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 4 }));

            (await Create().GetReport("b1", "sast")).Status.Should().Be("Pending");
        }

        [Fact]
        public async Task C8_OldReadyOrNotRunReports_AreNotTurnedIntoFailed()
        {
            _clock.Now = new DateTimeOffset(Created).AddDays(30);
            GivenBuild(NewBuild(sast: ReadySast(), sca: new ScaReport { Status = AnalysisReportStatus.NotRun, Attempts = 0, Message = "The sca-scan step did not run." }));

            (await Create().GetReport("b1", "sast")).Status.Should().Be("Ready");
            var sca = await Create().GetReport("b1", "sca-libraries");
            sca.Status.Should().Be("NotRun");
            sca.Message.Should().Be("The sca-scan step did not run.");
        }

        // ---- C14 ----

        [Theory]
        [InlineData("sast", AnalysisReportStatus.NotRun, "The sonar-scan step did not run.")]
        [InlineData("sast", AnalysisReportStatus.Failed, "SonarQube results were not available after 4 attempts.")]
        [InlineData("sca-libraries", AnalysisReportStatus.NotRun, "The build was cancelled.")]
        [InlineData("sca-libraries", AnalysisReportStatus.Failed, "Dependency-Track results were not available after 4 attempts.")]
        public async Task C14_NotRunOrFailed_ReturnsStatusAndMessageOnly(string type, string status, string message)
        {
            GivenBuild(NewBuild(
                sast: new SastReport { Status = status, Attempts = 4, Message = message, Metrics = new() { ["x"] = "1" } },
                sca: new ScaReport { Status = status, Attempts = 4, Message = message, Findings = new() { new() { VulnId = "CVE-1" } } }));

            var report = await Create().GetReport("b1", type);

            report.Status.Should().Be(status);
            report.Message.Should().Be(message);
            report.Details.Should().BeNull();
            report.Vulnerabilities.Should().BeNull();
            report.QualityGate.Should().BeNull();
            report.IssueBreakdown.Should().BeNull();
            report.CapturedAt.Should().BeNull();
            var json = ToJson(report);
            json["status"]!.GetValue<string>().Should().Be(status);
            json["message"]!.GetValue<string>().Should().Be(message);
            json["details"].Should().BeNull();
            json.ContainsKey("details").Should().BeTrue("today's keys stay, as null");
            VerifyNoToolCall();
            VerifyNoReportWrite();
        }

        // ---- C15 ----

        [Theory]
        [InlineData("sast")]
        [InlineData("sca-libraries")]
        [InlineData("sca-container")]
        [InlineData("dast")]
        public async Task C15_UnknownBuild_ThrowsAsTodayWithoutAToolCall(string type)
        {
            _f.BuildRepo.Setup(b => b.GetBuild("missing")).ReturnsAsync((Build)null);

            var act = () => Create().GetReport("missing", type);

            await act.Should().ThrowAsync<NullReferenceException>();
            VerifyNoToolCall();
        }

        // ---- H9 ----

        [Fact]
        public async Task H9_LegacySastBuild_ReadsLiveWithoutStatus()
        {
            SastCaptureServiceTests.SetupFourQueries(_f.Http);
            GivenBuild(NewBuild());

            var report = await Create().GetReport("b1", "sast");

            report.Status.Should().BeNull();
            report.Details["new_violations"].Should().Be("367");
            _f.Http.Invocations.Should().HaveCount(4, "today's four SonarQube calls");
            ToJson(report).Select(p => p.Key).Should().BeEquivalentTo(TodaysKeys, "the legacy response has no status or other new key");
        }

        [Fact]
        public async Task H9_LegacyScaBuild_ReadsLiveWithoutStatus()
        {
            _f.Http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new ScaLookupResponse { metrics = new Metrics { critical = 2 }, versions = new() }, ""));
            GivenBuild(NewBuild(sast: ReadySast()));

            var report = await Create().GetReport("b1", "sca-libraries");

            report.Type.Should().Be("Sca");
            report.Status.Should().BeNull();
            report.Details["critical"].Should().Be("2");
            _f.Http.Verify(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.Is<string>(u => u.Contains("name=org-repo&version=dev")), null, It.IsAny<Dictionary<string, string>>()), Times.Once);
            var json = JsonSerializer.Serialize(report, Web);
            json.Should().NotContain("\"status\"").And.NotContain("\"message\"").And.NotContain("\"capturedAt\"");
            ToJson(report).Select(p => p.Key).Should().BeEquivalentTo(TodaysKeys);
        }

        // ---- C20 ----

        [Theory]
        [InlineData("sca-container")]
        [InlineData("dast")]
        public async Task C20_ContainerAndDast_AreUnchangedEvenForABuildWithSavedReports(string type)
        {
            _f.Http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new ScaLookupResponse { metrics = new Metrics(), versions = new() }, ""));
            GivenBuild(NewBuild(sast: ReadySast(), sca: ReadySca()));

            var report = await Create().GetReport("b1", type);

            report.Status.Should().BeNull();
            ToJson(report).Select(p => p.Key).Should().BeEquivalentTo(TodaysKeys);
            if (type == "sca-container")
            {
                report.Type.Should().Be("Sca");
                _f.Http.Verify(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.Is<string>(u => u.Contains("version=registry/img:1")), null, It.IsAny<Dictionary<string, string>>()), Times.Once);
            }
            else
            {
                _f.Http.Invocations.Should().BeEmpty();
            }
        }

        [Theory]
        [InlineData("sast")]
        [InlineData("sca-libraries")]
        public async Task C20_SavedResponses_KeepTodaysKeysAndTypesAndOnlyAddNewOnes(string type)
        {
            GivenBuild(NewBuild(sast: ReadySast(), sca: ReadySca()));

            var json = ToJson(await Create().GetReport("b1", type));

            json.Select(p => p.Key).Should().Contain(TodaysKeys);
            json.Select(p => p.Key).Except(TodaysKeys).Should().OnlyContain(k => NewKeys.Contains(k));
            json["type"]!.GetValueKind().Should().Be(JsonValueKind.String);
            json["details"]!.GetValueKind().Should().Be(JsonValueKind.Object);
            if (type == "sast")
            {
                json["qualityGate"]!.GetValueKind().Should().Be(JsonValueKind.Object);
                json["issueBreakdown"]!.GetValueKind().Should().Be(JsonValueKind.Object);
                json["vulnerabilities"].Should().BeNull();
            }
            else
            {
                json["vulnerabilities"]!.GetValueKind().Should().Be(JsonValueKind.Array);
                json["qualityGate"].Should().BeNull();
                json["issueBreakdown"].Should().BeNull();
            }
            json["details"]!.AsObject().Select(p => p.Value!.GetValueKind()).Should().OnlyContain(k => k == JsonValueKind.String, "details stay a string map");
        }

        [Fact]
        public async Task C20_SastCapturedThenRead_EqualsTodaysLiveResponse()
        {
            // Same SonarQube data: today's live read of a legacy build vs. the capture saved and read back.
            SastCaptureServiceTests.SetupBranches(_f.Http, ("dev", "2026-10-28T08:06:12+0000"));
            SastCaptureServiceTests.SetupFourQueries(_f.Http);
            SastCaptureServiceTests.SetupAnalysis(_f.Http, new SonarProjectAnalysis { Key = "k", Date = "2026-10-28T08:06:12+0000", Revision = "abc1234" });
            SastReport saved = null;
            _f.BuildRepo.Setup(b => b.TrySaveSastReport("b1", 0, It.IsAny<SastReport>(), "tenant-1"))
                .Callback<string, int, SastReport, string>((_, _, r, _) => saved = r).ReturnsAsync(true);
            var capture = new SastCaptureService(new SASTStrategy(_f.Http.Object, _f.Secret.Object, _f.Config), _f.BuildRepo.Object,
                _f.MessageClient.Object, new ListLogger<SastCaptureService>(), null, _clock);
            await capture.CaptureAsync(NewBuild(sast: new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 0 }), 1);
            saved.Should().NotBeNull();

            GivenBuild(NewBuild());
            var live = ToJson(await Create().GetReport("b1", "sast"));
            GivenBuild(NewBuild(sast: saved));
            var fromSaved = ToJson(await Create().GetReport("b1", "sast"));

            // The live read has data, so the comparison below never passes as null against null.
            live["details"].Should().NotBeNull();
            live["details"]!.AsObject().Count.Should().BePositive();
            live["qualityGate"].Should().NotBeNull();
            live["issueBreakdown"].Should().NotBeNull();
            foreach (var key in TodaysKeys)
                (fromSaved[key]?.ToJsonString()).Should().Be(live[key]?.ToJsonString(), key);
            fromSaved["status"]!.GetValue<string>().Should().Be("Ready");
            fromSaved["revision"]!.GetValue<string>().Should().Be("abc1234");
        }

        [Fact]
        public async Task C20_ScaCapturedThenRead_EqualsTodaysLiveResponsePlusKev()
        {
            const string metricsJson = """
                { "critical": 1, "high": 2, "medium": 0, "low": 4, "inheritedRiskScore": 18.75, "components": 40,
                  "collectionLogic": null, "collectionLogicChanged": false, "firstOccurrence": 1761645600000, "lastOccurrence": 1761646000000, "kev": 3 }
                """;
            var findings = new[]
            {
                new SCAVulnerability
                {
                    component = new MyComponent { uuid = "c1", name = "lodash", group = "npm", version = "4.17.20", latestVersion = "4.17.21" },
                    vulnerability = new Vulnerability
                    {
                        uuid = "v1", vulnId = "CVE-2021-23337", source = "NVD", severity = "CRITICAL", cvssV3BaseScore = 9.8, epssScore = 0.2, epssPercentile = 0.9,
                        cweName = "Command Injection", description = "d1", aliases = new() { new() { cveId = "CVE-2021-23337", ghsaId = "GHSA-35jh-r3h4-6jhm" } },
                    },
                },
                new SCAVulnerability
                {
                    component = new MyComponent { uuid = "c2", name = "minimist", version = "1.2.0" },
                    vulnerability = new Vulnerability
                    {
                        uuid = "v2", vulnId = "GHSA-xvch-5gv4-984h", source = "GITHUB", severity = "LOW", cvssV3BaseScore = null, cvssV4Score = 2.1,
                        epssScore = null, epssPercentile = null, description = "d2", aliases = null,
                    },
                },
            };

            // Live (legacy build): lookup with versions and metrics, then the findings of the exact version.
            _f.Http.Setup(h => h.MakeHttpGetRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new ScaLookupResponse { metrics = JsonSerializer.Deserialize<Metrics>(metricsJson), versions = new() { new() { uuid = "p-uuid", version = "dev" } } }, ""));
            _f.Http.Setup(h => h.MakeHttpGetRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((findings, ""));

            // Capture: the same project, metrics and findings through the capture calls.
            var lookup = new ScaLookupResponse
            {
                uuid = "p-uuid", name = "org-repo", version = "dev",
                lastBomImport = new DateTimeOffset(Created).AddMinutes(5).ToUnixTimeMilliseconds(),
                lastVulnerabilityAnalysis = new DateTimeOffset(Created).AddMinutes(6).ToUnixTimeMilliseconds(),
            };
            _f.Http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((lookup, new HttpResponseMessage(HttpStatusCode.OK)));
            _f.Http.Setup(h => h.MakeHttpRequest<DependencyTrackProjectMetrics>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((JsonSerializer.Deserialize<DependencyTrackProjectMetrics>(metricsJson), new HttpResponseMessage(HttpStatusCode.OK)));
            _f.Http.Setup(h => h.MakeHttpRequest<SCAVulnerability[]>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((findings, new HttpResponseMessage(HttpStatusCode.OK)));
            ScaReport saved = null;
            _f.BuildRepo.Setup(b => b.TrySaveScaReport("b1", 1, It.IsAny<ScaReport>(), "tenant-1"))
                .Callback<string, int, ScaReport, string>((_, _, r, _) => saved = r).ReturnsAsync(true);
            var pending = NewBuild(sca: new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = 1 });
            pending.DependencyTrackProjectId = "p-uuid";
            await new ScaCaptureService(_f.ScaAnalyticsService(), _f.BuildRepo.Object, _f.MessageClient.Object, new ListLogger<ScaCaptureService>(), null, _clock)
                .CaptureAsync(pending, 2);
            saved.Should().NotBeNull();
            saved.Status.Should().Be(AnalysisReportStatus.Ready);

            GivenBuild(NewBuild());
            var live = ToJson(await Create().GetReport("b1", "sca-libraries"));
            GivenBuild(NewBuild(sca: saved));
            var fromSaved = ToJson(await Create().GetReport("b1", "sca-libraries"));

            fromSaved["type"]!.ToJsonString().Should().Be(live["type"]!.ToJsonString());
            fromSaved["vulnerabilities"]!.ToJsonString().Should().Be(live["vulnerabilities"]!.ToJsonString());
            fromSaved["qualityGate"].Should().BeNull();
            fromSaved["issueBreakdown"].Should().BeNull();
            var liveDetails = live["details"]!.AsObject();
            var savedDetails = fromSaved["details"]!.AsObject();
            savedDetails.Select(p => p.Key).Should().BeEquivalentTo(liveDetails.Select(p => p.Key).Append("kev"));
            foreach (var (key, value) in liveDetails)
                savedDetails[key]!.ToJsonString().Should().Be(value!.ToJsonString(), key);
            savedDetails["kev"]!.GetValue<string>().Should().Be("3");
        }
    }
}
