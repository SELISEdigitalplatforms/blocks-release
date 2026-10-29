using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool.Capture
{
    /// <summary>
    /// #255 SAST capture: readiness through project_branches/list (H4 and its boundary), the attempt schedule (H12),
    /// giving up after attempt 4 (C2), idempotency (C3), tool errors (C4), the one notification (H14) and log
    /// redaction (C17).
    /// </summary>
    public class SastCaptureServiceTests
    {
        internal const string Token = "sast-secret-token-123";
        internal static readonly DateTime Created = new(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc);
        internal static readonly DateTimeOffset Now = new(2026, 10, 28, 10, 9, 0, TimeSpan.Zero);

        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<IBuildRepository> _builds = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly ListLogger<SastCaptureService> _logger = new();
        private readonly ListLogger<SASTStrategy> _strategyLogger = new();
        private readonly FakeTimeProvider _clock = new(Now);
        private readonly IConfiguration _config;

        private readonly List<(int Expected, SastReport Report)> _saved = new();
        private readonly List<ConsumerMessage<PostBuildQueue>> _sent = new();
        private readonly List<(string Tenant, string Config, string[] Users, IDictionary<string, object> Payload)> _notified = new();

        private bool _saveResult = true;

        public SastCaptureServiceTests()
        {
            _secret.SetupGet(s => s.SastBasicAuthToken).Returns(Token);
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["SastToolsApiBaseUri"] = "https://sonar.example.com/api/" })
                .Build();

            _builds.Setup(b => b.TrySaveSastReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<SastReport>(), It.IsAny<string>()))
                .Callback<string, int, SastReport, string>((_, expected, report, _) => _saved.Add((expected, report)))
                .ReturnsAsync(() => _saveResult);
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .Callback<ConsumerMessage<PostBuildQueue>>(_sent.Add)
                .Returns(Task.CompletedTask);
            _notifications.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .Callback<string, string, IEnumerable<string>, IDictionary<string, object>>((t, c, u, p) => _notified.Add((t, c, u.ToArray(), p)))
                .ReturnsAsync(true);
        }

        private SastCaptureService Create(IConfiguration config = null) =>
            new(new SASTStrategy(_http.Object, _secret.Object, config ?? _config, _strategyLogger),
                _builds.Object, _messages.Object, _logger, _notifications.Object, _clock);

        internal static Build NewBuild(int attempts = 0, string status = AnalysisReportStatus.Pending) => new()
        {
            ItemId = "build-1",
            RepoId = "repo-1",
            ProjectId = "tenant-1",
            RepoName = "org/repo",
            Branch = "dev",
            PipelineRunName = "run-1",
            CreatedBy = "user-1",
            CreatedDate = Created,
            SastReport = new SastReport { Status = status, Attempts = attempts },
        };

        // ---- SonarQube fakes ----

        internal static SASTResponse Measures() => new()
        {
            Component = new Component
            {
                Measures = new List<Measure>
                {
                    new() { Metric = "alert_status", Value = "ERROR" },
                    new() { Metric = "new_violations", Value = null, Period = new Period { value = "367" } },
                    new() { Metric = "bugs", Value = "4" },
                }
            },
            Period = new NewCodePeriod { Mode = "previous_version", Date = "2026-08-10T09:12:00+0000" }
        };

        internal static SonarProjectStatusResponse Gate() => new()
        {
            ProjectStatus = new SonarProjectStatus
            {
                Status = "ERROR",
                Conditions = new List<SonarGateCondition>
                {
                    new() { MetricKey = "new_violations", Comparator = "GT", ErrorThreshold = "0", ActualValue = "367", Status = "ERROR" }
                }
            }
        };

        internal static SonarIssuesSearchResponse Issues(int total, string severity, int count) => new()
        {
            Paging = new SonarPaging { Total = total },
            Facets = new List<SonarFacet>
            {
                new() { Property = "impactSeverities", Values = new List<SonarFacetValue> { new() { Val = severity, Count = count } } }
            }
        };

        internal static void SetupFourQueries(Mock<IHttpHelperServices> http, SASTResponse measures = null, SonarProjectStatusResponse gate = null,
            SonarIssuesSearchResponse newIssues = null, SonarIssuesSearchResponse allIssues = null, bool nullAll = false)
        {
            http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((nullAll ? null : measures ?? Measures(), ""));
            http.Setup(h => h.MakeHttpGetRequest<SonarProjectStatusResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((nullAll ? null : gate ?? Gate(), ""));
            http.Setup(h => h.MakeHttpGetRequest<SonarIssuesSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Returns((string url, string _, Dictionary<string, string> _) => Task.FromResult<(SonarIssuesSearchResponse, string)>(
                    (nullAll ? null : url.Contains("inNewCodePeriod=true") ? newIssues ?? Issues(367, "HIGH", 3) : allIssues ?? Issues(1200, "BLOCKER", 1), "")));
        }

        internal static void SetupBranches(Mock<IHttpHelperServices> http, params (string Name, string AnalysisDate)[] branches) =>
            http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.Is<string>(u => u.Contains("project_branches/list")), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SonarProjectBranchesResponse
                {
                    Branches = branches.Select(b => new SonarProjectBranch { Name = b.Name, AnalysisDate = b.AnalysisDate }).ToList()
                }, ""));

        internal static void SetupAnalysis(Mock<IHttpHelperServices> http, SonarProjectAnalysis analysis) =>
            http.Setup(h => h.MakeHttpGetRequest<SonarProjectAnalysesResponse>(It.Is<string>(u => u.Contains("project_analyses/search")), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((analysis is null ? null : new SonarProjectAnalysesResponse { Analyses = new List<SonarProjectAnalysis> { analysis } }, ""));

        private void GivenReady(string analysisDate = "2026-10-28T10:06:12+0000")
        {
            SetupBranches(_http, ("main", "2026-10-28T10:07:00+0000"), ("dev", analysisDate));
            SetupFourQueries(_http);
            SetupAnalysis(_http, new SonarProjectAnalysis { Key = "AZ-key-1", Date = "2026-10-28T10:06:12+0000", Revision = "abc1234def5678" });
        }

        private void GivenNotReady() => SetupBranches(_http, ("dev", "2026-10-28T09:30:00+0000"));

        private void VerifyNothingScheduled() => _sent.Should().BeEmpty();

        // ---- H4 ----

        [Fact]
        public async Task H4_AnalysisAfterTheBuildStarted_SavesReadyWithTheExistingMappingsAndMetadata()
        {
            GivenReady();

            await Create().CaptureAsync(NewBuild(), 1);

            var (expected, report) = _saved.Should().ContainSingle().Subject;
            expected.Should().Be(0, "the write is conditional on the attempts the message expects (C3)");
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.Attempts.Should().Be(1);
            report.CapturedAt.Should().Be(Now.UtcDateTime);
            report.Message.Should().BeNull();
            report.ProjectKey.Should().Be("org-repo");
            report.Branch.Should().Be("dev");
            report.AnalysisKey.Should().Be("AZ-key-1");
            report.AnalysisDate.Should().Be(new DateTime(2026, 10, 28, 10, 6, 12, DateTimeKind.Utc));
            report.Revision.Should().Be("abc1234def5678");

            // Exactly what the four existing SonarQube queries map to.
            report.Metrics.Should().Equal(SASTStrategy.MapMeasures(Measures()));
            report.Metrics["new_violations"].Should().Be("367");
            report.Metrics["new_code_period_mode"].Should().Be("previous_version");
            report.QualityGate.Should().BeEquivalentTo(SASTStrategy.MapQualityGate(Gate()));
            report.IssueBreakdown.Should().BeEquivalentTo(SASTStrategy.MapIssueBreakdown(Issues(367, "HIGH", 3), Issues(1200, "BLOCKER", 1)));
            report.IssueBreakdown.NewCode.High.Should().Be(3);
            report.IssueBreakdown.Overall.Blocker.Should().Be(1);

            VerifyNothingScheduled();
        }

        [Fact]
        public async Task H4_SavedReport_EqualsTodaysLiveMappingForTheSameSonarQubeData()
        {
            GivenReady();

            await Create().CaptureAsync(NewBuild(), 1);
            var live = await new SASTStrategy(_http.Object, _secret.Object, _config).getInfo("org-repo", "dev");

            var report = _saved.Single().Report;
            report.Metrics.Should().Equal(live.Details);
            JsonSerializer.Serialize(AnalysisReportMapper.ToLocal(report.QualityGate)).Should().Be(JsonSerializer.Serialize(live.QualityGate));
            JsonSerializer.Serialize(AnalysisReportMapper.ToLocal(report.IssueBreakdown)).Should().Be(JsonSerializer.Serialize(live.IssueBreakdown));
        }

        [Fact]
        public async Task H4_QueriesTheBuildsOwnProjectKeyAndBranch()
        {
            GivenReady();
            var urls = new List<string>();
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((u, _, _) => urls.Add(u))
                .ReturnsAsync((new SonarProjectBranchesResponse { Branches = new() { new() { Name = "dev", AnalysisDate = "2026-10-28T10:06:12+0000" } } }, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectAnalysesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((u, _, _) => urls.Add(u))
                .ReturnsAsync(((SonarProjectAnalysesResponse)null, "fail"));

            await Create().CaptureAsync(NewBuild(), 1);

            urls.Should().Contain("https://sonar.example.com/api/project_branches/list?project=org-repo");
            urls.Should().Contain("https://sonar.example.com/api/project_analyses/search?project=org-repo&branch=dev&ps=1");
        }

        // ---- readiness boundary ----

        [Fact]
        public async Task Readiness_AnalysisDateEqualToCreatedDate_IsReady()
        {
            GivenReady(analysisDate: "2026-10-28T10:00:00+0000");

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Ready);
        }

        [Fact]
        public async Task Readiness_AnalysisDateOneSecondBeforeCreatedDate_IsNotReady()
        {
            GivenReady(analysisDate: "2026-10-28T09:59:59+0000");

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
            _http.Verify(h => h.MakeHttpGetRequest<SASTResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()), Times.Never);
        }

        [Fact]
        public async Task Readiness_AnalysisDateWithAnotherOffset_IsComparedInUtc()
        {
            // 15:29:59+05:30 is 09:59:59Z: one second before the build started.
            GivenReady(analysisDate: "2026-10-28T15:29:59+0530");
            await Create().CaptureAsync(NewBuild(), 1);
            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        [Fact]
        public async Task Readiness_OnlyAnotherBranchAnalysed_IsNotReady()
        {
            SetupBranches(_http, ("main", "2026-10-28T10:06:12+0000"), ("dev-x", "2026-10-28T10:06:12+0000"));
            SetupFourQueries(_http);

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        [Fact]
        public async Task Readiness_BranchWithoutAnalysisDate_IsNotReady()
        {
            SetupBranches(_http, ("dev", null));
            await Create().CaptureAsync(NewBuild(), 1);
            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        // ---- optional metadata ----

        [Fact]
        public async Task OptionalMetadataLookupFails_StillSavesReadyWithNullAnalysisFields()
        {
            GivenReady();
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectAnalysesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new InvalidOperationException("internal parameter rejected"));

            await Create().CaptureAsync(NewBuild(), 1);

            var report = _saved.Single().Report;
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.AnalysisKey.Should().BeNull();
            report.AnalysisDate.Should().BeNull();
            report.Revision.Should().BeNull();
            report.Metrics.Should().NotBeEmpty();
        }

        [Fact]
        public async Task OptionalMetadataLookupReturnsNoAnalysis_StillSavesReadyWithNullAnalysisFields()
        {
            GivenReady();
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectAnalysesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SonarProjectAnalysesResponse { Analyses = new List<SonarProjectAnalysis>() }, ""));

            await Create().CaptureAsync(NewBuild(), 1);

            var report = _saved.Single().Report;
            report.Status.Should().Be(AnalysisReportStatus.Ready);
            report.AnalysisKey.Should().BeNull();
            report.AnalysisDate.Should().BeNull();
            report.Revision.Should().BeNull();
        }

        // ---- H12 ----

        [Theory]
        [InlineData(1, 2)]
        [InlineData(2, 5)]
        [InlineData(3, 10)]
        public async Task H12_NotReady_SavesPendingWithTheAttemptAndSchedulesTheNextOne(int attempt, int delayMinutes)
        {
            GivenNotReady();

            await Create().CaptureAsync(NewBuild(attempts: attempt - 1), attempt);

            var (expected, report) = _saved.Should().ContainSingle().Subject;
            expected.Should().Be(attempt - 1);
            report.Status.Should().Be(AnalysisReportStatus.Pending);
            report.Attempts.Should().Be(attempt);
            report.Message.Should().BeNull();

            var message = _sent.Should().ContainSingle().Subject;
            message.ConsumerName.Should().Be(CloudBuildConstants.POST_BUILD_LISTENER);
            message.ScheduledEnqueueTimeUtc.Should().Be(Now + TimeSpan.FromMinutes(delayMinutes));
            message.Payload.PipelineEventType.Should().Be(PipelineEventTypes.CaptureSastReport);
            message.Payload.Attempt.Should().Be(attempt + 1);
            message.Payload.ProjectKey.Should().Be("tenant-1");
            message.Payload.PipelineRunName.Should().Be("run-1");
            message.Payload.PipelineType.Should().Be(PipelineTypes.RepoDeployment);

            _notified.Should().BeEmpty("no notification per attempt (6.5)");
        }

        [Fact]
        public async Task H12_NotReady_SchedulingFails_DoesNotThrow()
        {
            GivenNotReady();
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>())).ThrowsAsync(new Exception("bus down"));

            var act = () => Create().CaptureAsync(NewBuild(), 1);

            await act.Should().NotThrowAsync();
            _saved.Single().Report.Attempts.Should().Be(1);
            _logger.Entries.Should().Contain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error && e.Message.Contains("Could not schedule SAST capture attempt 2"));
        }

        // ---- C2 ----

        [Fact]
        public async Task C2_Attempt4NotReady_SavesFailedAndNotifiesOnceWithoutScheduling()
        {
            GivenNotReady();

            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            var (expected, report) = _saved.Should().ContainSingle().Subject;
            expected.Should().Be(3);
            report.Status.Should().Be(AnalysisReportStatus.Failed);
            report.Attempts.Should().Be(4);
            report.Message.Should().Be("SonarQube results were not available after 4 attempts.");
            VerifyNothingScheduled();

            var n = _notified.Should().ContainSingle().Subject;
            n.Tenant.Should().Be("tenant-1");
            n.Config.Should().Be("release-code-analysis-finished");
            n.Users.Should().Equal("user-1");
            n.Payload["isSuccess"].Should().Be(false);
            n.Payload["analysisType"].Should().Be("SAST");
            n.Payload["title"].Should().Be("Code analysis failed");
            n.Payload["description"].Should().Be("SonarQube results were not available after 4 attempts.");
        }

        [Fact]
        public async Task C2_Attempt4NotReady_WriteMatchesNothing_DoesNotNotify()
        {
            GivenNotReady();
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            _saved.Should().ContainSingle();
            _notified.Should().BeEmpty();
            VerifyNothingScheduled();
        }

        // ---- empty measures: "no data", as on the live path ----

        public static TheoryData<string> EmptyMeasures => new() { "no component", "no measures", "only empty values" };

        private static SASTResponse EmptyMeasuresResponse(string kind) => kind switch
        {
            "no component" => new SASTResponse { Component = null },
            "no measures" => new SASTResponse { Component = new Component { Measures = new List<Measure>() } },
            _ => new SASTResponse
            {
                Component = new Component
                {
                    Measures = new List<Measure>
                    {
                        new() { Metric = "bugs", Value = "" },
                        new() { Metric = "new_violations", Value = null, Period = new Period { value = null } },
                    }
                }
            },
        };

        [Theory]
        [MemberData(nameof(EmptyMeasures))]
        public async Task EmptyMeasures_Attempt1_SavesPendingAndSchedulesTheNextAttemptInsteadOfReady(string kind)
        {
            SetupBranches(_http, ("dev", "2026-10-28T10:06:12+0000"));
            SetupFourQueries(_http, measures: EmptyMeasuresResponse(kind));
            SetupAnalysis(_http, new SonarProjectAnalysis { Key = "AZ-key-1", Date = "2026-10-28T10:06:12+0000", Revision = "abc" });

            await Create().CaptureAsync(NewBuild(), 1);

            var (expected, report) = _saved.Should().ContainSingle().Subject;
            expected.Should().Be(0);
            report.Status.Should().Be(AnalysisReportStatus.Pending);
            report.Attempts.Should().Be(1);
            report.Message.Should().BeNull();
            report.Metrics.Should().BeNullOrEmpty();
            report.CapturedAt.Should().BeNull();
            _saved.Should().NotContain(s => s.Report.Status == AnalysisReportStatus.Ready);

            var message = _sent.Should().ContainSingle().Subject;
            message.Payload.PipelineEventType.Should().Be(PipelineEventTypes.CaptureSastReport);
            message.Payload.Attempt.Should().Be(2);
            message.ScheduledEnqueueTimeUtc.Should().Be(Now + TimeSpan.FromMinutes(2));
            _notified.Should().BeEmpty();
            _logger.Entries.Should().Contain(e => e.Message.Contains("returned no measures"));
        }

        [Fact]
        public async Task EmptyMeasures_Attempt4_SavesFailedWithTheSonarQubeMessage()
        {
            SetupBranches(_http, ("dev", "2026-10-28T10:06:12+0000"));
            SetupFourQueries(_http, measures: EmptyMeasuresResponse("no measures"));

            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            var (expected, report) = _saved.Should().ContainSingle().Subject;
            expected.Should().Be(3);
            report.Status.Should().Be(AnalysisReportStatus.Failed);
            report.Attempts.Should().Be(4);
            report.Message.Should().Be("SonarQube results were not available after 4 attempts.");
            report.Metrics.Should().BeNullOrEmpty();
            VerifyNothingScheduled();
            var n = _notified.Should().ContainSingle().Subject;
            n.Payload["isSuccess"].Should().Be(false);
            n.Payload["description"].Should().Be("SonarQube results were not available after 4 attempts.");
        }

        // ---- H14 ----

        [Fact]
        public async Task H14_Ready_NotifiesTheCreatorOnceWithSastTexts()
        {
            GivenReady();

            await Create().CaptureAsync(NewBuild(), 1);

            var n = _notified.Should().ContainSingle().Subject;
            n.Tenant.Should().Be("tenant-1");
            n.Config.Should().Be("release-code-analysis-finished");
            n.Users.Should().Equal("user-1");
            n.Payload["isSuccess"].Should().Be(true);
            n.Payload["analysisType"].Should().Be("SAST");
            n.Payload["title"].Should().Be("Code analysis finished");
            n.Payload["description"].Should().Be("The code (SAST) analysis of the build finished.");
            n.Payload["buildId"].Should().Be("build-1");
            n.Payload["repoId"].Should().Be("repo-1");
            n.Payload["projectId"].Should().Be("tenant-1");
        }

        [Fact]
        public async Task H14_NotificationFails_CaptureStillCompletes()
        {
            GivenReady();
            _notifications.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .ThrowsAsync(new Exception("notifier down"));

            var act = () => Create().CaptureAsync(NewBuild(), 1);

            await act.Should().NotThrowAsync();
            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Ready);
        }

        // ---- C3 ----

        public static TheoryData<string, int?, int> NotAwaited => new()
        {
            { AnalysisReportStatus.Ready, 1, 2 },      // already captured
            { AnalysisReportStatus.Failed, 4, 4 },     // already failed
            { AnalysisReportStatus.NotRun, 0, 1 },     // scan did not run
            { AnalysisReportStatus.Pending, 2, 2 },    // duplicate delivery: attempts already moved on
            { AnalysisReportStatus.Pending, 0, 3 },    // stale or early message
            { null, null, 1 },                         // legacy build: no report
        };

        [Theory]
        [MemberData(nameof(NotAwaited))]
        public async Task C3_MessageTheReportIsNotWaitingFor_WritesSchedulesAndNotifiesNothing(string status, int? attempts, int attempt)
        {
            GivenReady();
            var build = NewBuild();
            build.SastReport = status is null ? null : new SastReport { Status = status, Attempts = attempts ?? 0 };

            var act = () => Create().CaptureAsync(build, attempt);

            await act.Should().NotThrowAsync();
            _http.Invocations.Should().BeEmpty("nothing is asked of SonarQube");
            _builds.Invocations.Should().BeEmpty();
            _messages.Invocations.Should().BeEmpty();
            _notifications.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task C3_ReadyButTheConditionalWriteMatchesNothing_DoesNotNotify()
        {
            GivenReady();
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Should().ContainSingle();
            _notified.Should().BeEmpty();
            VerifyNothingScheduled();
        }

        [Fact]
        public async Task C3_NotReadyButTheConditionalWriteMatchesNothing_SchedulesNothing()
        {
            GivenNotReady();
            _saveResult = false;

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Should().ContainSingle();
            VerifyNothingScheduled();
            _notified.Should().BeEmpty();
        }

        // ---- C4 ----

        [Fact]
        public async Task C4_BranchListNull_CountsAsNotReady()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync(((SonarProjectBranchesResponse)null, "Operation Failed."));

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
            _sent.Should().ContainSingle();
        }

        [Fact]
        public async Task C4_BranchListThrows_CountsAsNotReadyWithoutThrowing()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new TaskCanceledException("timeout"));

            var act = () => Create().CaptureAsync(NewBuild(), 1);

            await act.Should().NotThrowAsync();
            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
            _sent.Should().ContainSingle().Which.Payload.Attempt.Should().Be(2);
        }

        [Fact]
        public async Task C4_BranchesWithoutAList_CountsAsNotReady()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SonarProjectBranchesResponse { Branches = null }, ""));

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        [Theory]
        [InlineData("measures")]
        [InlineData("gate")]
        [InlineData("newIssues")]
        [InlineData("allIssues")]
        public async Task C4_OneDataQueryFails_CountsAsNotReady(string failing)
        {
            SetupBranches(_http, ("dev", "2026-10-28T10:06:12+0000"));
            SetupFourQueries(_http);
            if (failing == "measures")
                _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                    .ReturnsAsync(((SASTResponse)null, "fail"));
            if (failing == "gate")
                _http.Setup(h => h.MakeHttpGetRequest<SonarProjectStatusResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                    .ThrowsAsync(new Exception("invalid JSON"));
            if (failing is "newIssues" or "allIssues")
                _http.Setup(h => h.MakeHttpGetRequest<SonarIssuesSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                    .Returns((string url, string _, Dictionary<string, string> _) => Task.FromResult<(SonarIssuesSearchResponse, string)>(
                        (url.Contains("inNewCodePeriod=true") == (failing == "newIssues") ? null : Issues(1, "LOW", 1), "")));

            await Create().CaptureAsync(NewBuild(), 1);

            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Pending);
            _sent.Should().ContainSingle();
            _notified.Should().BeEmpty();
        }

        [Fact]
        public async Task C4_UnexpectedErrorInsideTheAttempt_CountsAsNotReadyWithoutThrowing()
        {
            var config = new Mock<IConfiguration>();
            config.Setup(c => c[It.IsAny<string>()]).Throws(new InvalidOperationException("configuration unavailable"));

            var act = () => Create(config.Object).CaptureAsync(NewBuild(attempts: 3), 4);

            await act.Should().NotThrowAsync();
            _saved.Single().Report.Status.Should().Be(AnalysisReportStatus.Failed);
            _logger.Entries.Should().Contain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Warning && e.Message.Contains("SAST capture attempt 4"));
        }

        // ---- C17 ----

        [Fact]
        public async Task C17_TheSonarQubeTokenIsNeverLoggedOrSaved()
        {
            // Every path that logs: ready, not ready, failing calls, failing schedule, failing notification.
            GivenReady();
            await Create().CaptureAsync(NewBuild(), 1);

            GivenNotReady();
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>())).ThrowsAsync(new Exception("bus down"));
            await Create().CaptureAsync(NewBuild(), 1);

            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new Exception("boom"));
            _notifications.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .ThrowsAsync(new Exception("notifier down"));
            await Create().CaptureAsync(NewBuild(attempts: 3), 4);

            _logger.Entries.Should().NotBeEmpty();
            _logger.AllText.Should().NotContain(Token);
            _strategyLogger.AllText.Should().NotContain(Token);
            foreach (var (_, report) in _saved)
                JsonSerializer.Serialize(report).Should().NotContain(Token);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(4)]
        public async Task C17_HelperThrowsWithTheRequestUrlInItsMessage_TheTokenSentAsBearerIsNeverLoggedOrSaved(int attempt)
        {
            var headersSent = new List<Dictionary<string, string>>();
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((_, _, headers) => headersSent.Add(headers))
                .Returns((string url, string _, Dictionary<string, string> _) =>
                    Task.FromException<(SonarProjectBranchesResponse, string)>(new System.Net.Http.HttpRequestException($"Request to {url} failed: connection reset")));

            await Create().CaptureAsync(NewBuild(attempts: attempt - 1), attempt);

            // The secret is in play: the request carried it as a bearer token.
            var headers = headersSent.Should().ContainSingle().Subject;
            headers.Should().ContainKey("Authorization").WhoseValue.Should().Be($"Bearer {Token}");

            // The URL from the exception message did reach the log, the token did not.
            _strategyLogger.AllText.Should().Contain("https://sonar.example.com/api/project_branches/list?project=org-repo");
            _logger.Entries.Should().NotBeEmpty();
            _logger.AllText.Should().NotContain(Token);
            _strategyLogger.AllText.Should().NotContain(Token);
            _saved.Should().ContainSingle().Which.Report.Status.Should().Be(attempt == 4 ? AnalysisReportStatus.Failed : AnalysisReportStatus.Pending);
            foreach (var (_, report) in _saved)
                JsonSerializer.Serialize(report).Should().NotContain(Token);
            foreach (var m in _sent)
                JsonSerializer.Serialize(m).Should().NotContain(Token);
        }
    }
}
