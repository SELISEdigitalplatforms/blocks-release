using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;
using Genesis = Blocks.Genesis.Entities.Release;
using Local = Devops.DomainService.TestingTools.Models;

namespace XUnitTest.Devops.AnalyticsTool.Capture
{
    /// <summary>#255: the shared report rules (schedule, texts, dates) and the Genesis/local/response mappings.</summary>
    public class AnalysisReportUpdatesTests
    {
        // ---- ParseSonarDate ----

        [Theory]
        [InlineData("2026-10-28T10:06:12+0000", "2026-10-28T10:06:12Z")]
        [InlineData("2026-10-28T15:36:12+0530", "2026-10-28T10:06:12Z")]
        [InlineData("2026-10-28T15:36:12+05:30", "2026-10-28T10:06:12Z")]
        [InlineData("2026-10-28T05:06:12-0500", "2026-10-28T10:06:12Z")]
        [InlineData("2026-10-28T10:06:12Z", "2026-10-28T10:06:12Z")]
        [InlineData("2026-10-28T10:06:12", "2026-10-28T10:06:12Z")] // no offset: taken as UTC
        [InlineData("  2026-10-28T10:06:12+0000  ", "2026-10-28T10:06:12Z")]
        public void ParseSonarDate_ReadsSonarQubeAndIsoOffsets(string value, string expectedUtc)
        {
            var parsed = AnalysisReportUpdates.ParseSonarDate(value);

            parsed.Should().NotBeNull();
            parsed!.Value.UtcDateTime.Should().Be(DateTime.Parse(expectedUtc, null, System.Globalization.DateTimeStyles.AdjustToUniversal));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("not a date")]
        [InlineData("2026-13-45T99:99:99+0000")]
        public void ParseSonarDate_NothingUsable_IsNull(string value) =>
            AnalysisReportUpdates.ParseSonarDate(value).Should().BeNull();

        // ---- FromEpochMilliseconds / ToEpochMilliseconds ----

        [Fact]
        public void FromEpochMilliseconds_ConvertsToUtc_AndNullStaysNull()
        {
            var at = new DateTimeOffset(2026, 10, 28, 10, 0, 0, TimeSpan.Zero);
            AnalysisReportUpdates.FromEpochMilliseconds(at.ToUnixTimeMilliseconds()).Should().Be(at);
            AnalysisReportUpdates.FromEpochMilliseconds(at.ToUnixTimeMilliseconds())!.Value.Offset.Should().Be(TimeSpan.Zero);
            AnalysisReportUpdates.FromEpochMilliseconds(null).Should().BeNull();
        }

        public static TheoryData<object, long?> EpochValues()
        {
            var json = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                """{ "n": 1761645600000, "s": "1761645600000", "bad": "soon", "f": 1.5, "b": true }""");
            return new TheoryData<object, long?>
            {
                { null, null },
                { 1761645600000L, 1761645600000 },
                { 42, 42 },
                { json["n"], 1761645600000 },
                { json["s"], 1761645600000 },
                { json["bad"], null },
                { json["f"], null },
                { json["b"], null },
                { "1761645600000", 1761645600000 },
                { "soon", null },
                { 1.5d, null },
            };
        }

        [Theory]
        [MemberData(nameof(EpochValues))]
        public void ToEpochMilliseconds_ReadsDependencyTrackTimestamps(object value, long? expected) =>
            AnalysisReportMapper.ToEpochMilliseconds(value).Should().Be(expected);

        // ---- schedule ----

        [Theory]
        [InlineData(1, 2)]
        [InlineData(2, 5)]
        [InlineData(3, 10)]
        [InlineData(4, 10)]
        public void RetryDelayAfter_IsTwoFiveThenTenMinutes(int attempt, int minutes) =>
            AnalysisReportUpdates.RetryDelayAfter(attempt).Should().Be(TimeSpan.FromMinutes(minutes));

        [Fact]
        public void FirstAttemptDelaysAndAttemptCount()
        {
            AnalysisReportUpdates.MaxAttempts.Should().Be(4);
            AnalysisReportUpdates.SastFirstAttemptDelay.Should().Be(TimeSpan.FromMinutes(1));
            AnalysisReportUpdates.ScaFirstAttemptDelay.Should().Be(TimeSpan.FromMinutes(3));
        }

        [Theory]
        [InlineData(AnalysisReportStatus.Pending, 0, 1, true)]
        [InlineData(AnalysisReportStatus.Pending, 3, 4, true)]
        [InlineData(AnalysisReportStatus.Pending, 1, 1, false)]
        [InlineData(AnalysisReportStatus.Pending, 2, 4, false)]
        [InlineData(AnalysisReportStatus.Ready, 0, 1, false)]
        [InlineData(AnalysisReportStatus.NotRun, 0, 1, false)]
        [InlineData(AnalysisReportStatus.Failed, 3, 4, false)]
        [InlineData(null, null, 1, false)]
        public void IsAwaitedAttempt_OnlyPendingWithOneAttemptLess(string status, int? attempts, int attempt, bool expected) =>
            AnalysisReportUpdates.IsAwaitedAttempt(status, attempts, attempt).Should().Be(expected);

        [Theory]
        [InlineData(AnalysisReportKind.Sast, PipelineEventTypes.CaptureSastReport)]
        [InlineData(AnalysisReportKind.Sca, PipelineEventTypes.CaptureScaReport)]
        public async Task ScheduleCaptureAsync_QueuesTheAttemptOnThePostBuildListener(AnalysisReportKind kind, PipelineEventTypes eventType)
        {
            var client = new Mock<IMessageClient>();
            ConsumerMessage<PostBuildQueue> sent = null;
            client.Setup(c => c.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .Callback<ConsumerMessage<PostBuildQueue>>(m => sent = m).Returns(Task.CompletedTask);
            var at = new DateTimeOffset(2026, 10, 28, 10, 9, 0, TimeSpan.Zero);

            await AnalysisReportUpdates.ScheduleCaptureAsync(client.Object, new Build { ProjectId = "t1", PipelineRunName = "run-1" }, kind, 3, at);

            sent.ConsumerName.Should().Be(CloudBuildConstants.POST_BUILD_LISTENER).And.Be("blocks_release_post_build_listener");
            sent.ScheduledEnqueueTimeUtc.Should().Be(at);
            sent.Payload.Should().BeEquivalentTo(new PostBuildQueue
            {
                ProjectKey = "t1", PipelineRunName = "run-1", PipelineType = PipelineTypes.RepoDeployment, PipelineEventType = eventType, Attempt = 3,
            });
        }

        [Fact]
        public void PostBuildQueue_NewValuesAreAppended_AndAttemptDefaultsToZero()
        {
            ((int)PipelineEventTypes.RetrieveLog).Should().Be(0);
            ((int)PipelineEventTypes.RetrieveDependencyTrackId).Should().Be(1);
            ((int)PipelineEventTypes.DeletePipeLine).Should().Be(2);
            ((int)PipelineEventTypes.CaptureSastReport).Should().Be(3);
            ((int)PipelineEventTypes.CaptureScaReport).Should().Be(4);
            JsonSerializer.Deserialize<PostBuildQueue>("""{"ProjectKey":"t","PipelineRunName":"r","PipelineType":0,"PipelineEventType":1}""")!
                .Attempt.Should().Be(0, "messages queued before the field existed");
        }

        // ---- texts ----

        [Fact]
        public void Messages_AreTheSpecTexts()
        {
            AnalysisReportUpdates.StepDidNotSucceed("sonar-scan").Should().Be("The sonar-scan step did not succeed.");
            AnalysisReportUpdates.StepDidNotRun("sca-scan").Should().Be("The sca-scan step did not run.");
            AnalysisReportUpdates.AttemptsExhausted("SonarQube").Should().Be("SonarQube results were not available after 4 attempts.");
            AnalysisReportUpdates.AttemptsExhausted("Dependency-Track").Should().Be("Dependency-Track results were not available after 4 attempts.");
            AnalysisReportUpdates.CancelledMessage.Should().Be("The build was cancelled.");
            AnalysisReportUpdates.TimedOutMessage.Should().Be("The pipeline did not finish within 30 minutes.");
            AnalysisReportUpdates.NotificationConfig.Should().Be("release-code-analysis-finished");
        }

        [Theory]
        [InlineData(AnalysisReportKind.Sast, true, null, "Code analysis finished", "The code (SAST) analysis of the build finished.", "SAST")]
        [InlineData(AnalysisReportKind.Sast, false, "The sonar-scan step did not run.", "Code analysis failed", "The sonar-scan step did not run.", "SAST")]
        [InlineData(AnalysisReportKind.Sca, true, null, "Dependency analysis finished", "The dependency (SCA) analysis of the build finished.", "SCA")]
        [InlineData(AnalysisReportKind.Sca, false, "The build was cancelled.", "Dependency analysis failed", "The build was cancelled.", "SCA")]
        [InlineData(AnalysisReportKind.Sca, false, null, "Dependency analysis failed", "", "SCA")]
        public async Task NotifyAsync_SendsTheQ7TextsToTheCreator(AnalysisReportKind kind, bool ok, string message, string title, string description, string analysisType)
        {
            var notifications = new Mock<INotificationService>();
            IDictionary<string, object> payload = null;
            string[] recipients = null;
            notifications.Setup(n => n.SendBuiltInAsync("t1", "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .Callback<string, string, IEnumerable<string>, IDictionary<string, object>>((_, _, users, p) => { recipients = users?.ToArray(); payload = p; })
                .ReturnsAsync(true);
            var logger = new ListLogger<AnalysisReportUpdatesTests>();

            await AnalysisReportUpdates.NotifyAsync(notifications.Object, logger,
                new Build { ItemId = "b1", RepoId = "r1", ProjectId = "t1", CreatedBy = "creator" }, kind, ok, message);

            notifications.Verify(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Once);
            logger.Entries.Should().NotContain(e => e.Level >= LogLevel.Warning, "the notification was sent without an error");
            recipients.Should().Equal("creator");
            payload["event"].Should().Be("release-code-analysis-finished");
            payload["title"].Should().Be(title);
            payload["description"].Should().Be(description);
            payload["isSuccess"].Should().Be(ok);
            payload["analysisType"].Should().Be(analysisType);
            payload["buildId"].Should().Be("b1");
            payload["repoId"].Should().Be("r1");
            payload["projectId"].Should().Be("t1");
        }

        [Fact]
        public async Task NotifyAsync_NoServiceOrAFailingOne_NeverThrows()
        {
            var logger = new ListLogger<AnalysisReportUpdatesTests>();
            var build = new Build { ItemId = "b1", ProjectId = "t1", CreatedBy = "u" };
            await AnalysisReportUpdates.NotifyAsync(null, logger, build, AnalysisReportKind.Sast, true, null);

            var failing = new Mock<INotificationService>();
            failing.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .ThrowsAsync(new TimeoutException("slow"));
            var act = () => AnalysisReportUpdates.NotifyAsync(failing.Object, logger, build, AnalysisReportKind.Sca, false, "m");

            await act.Should().NotThrowAsync();
            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning && e.Message.Contains("TimeoutException"));
        }

        // ---- EndPendingAsync ----

        [Fact]
        public async Task EndPendingAsync_EndedByThisCall_NotifiesOnceWithTheMessage()
        {
            var builds = new Mock<IBuildRepository>();
            var notifications = new Mock<INotificationService>();
            builds.Setup(b => b.TryEndPendingReport("run-1", AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "The build was cancelled.", "t1"))
                .ReturnsAsync(new Build { ItemId = "b1", ProjectId = "t1", CreatedBy = "creator", RepoId = "r1" });

            await AnalysisReportUpdates.EndPendingAsync(builds.Object, notifications.Object, new ListLogger<AnalysisReportUpdatesTests>(),
                new AnalysisReportUpdates.PendingReportEnd("run-1", AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "The build was cancelled.", "t1"));

            notifications.Verify(n => n.SendBuiltInAsync("t1", "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(),
                It.Is<IDictionary<string, object>>(p => (bool)p["isSuccess"] == false && (string)p["description"] == "The build was cancelled." && (string)p["analysisType"] == "SCA")), Times.Once);
        }

        [Fact]
        public async Task EndPendingAsync_AlreadyEndedElsewhere_DoesNotNotify()
        {
            var builds = new Mock<IBuildRepository>();
            var notifications = new Mock<INotificationService>();
            builds.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Build)null);

            await AnalysisReportUpdates.EndPendingAsync(builds.Object, notifications.Object, new ListLogger<AnalysisReportUpdatesTests>(),
                new AnalysisReportUpdates.PendingReportEnd("run-1", AnalysisReportKind.Sast, AnalysisReportStatus.Failed, "x", "t1"));

            notifications.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task EndPendingAsync_WithAProjectPlacement_UsesTheTenantOverload()
        {
            var builds = new Mock<IBuildRepository>();
            var project = new Tenant { TenantId = "t1", TenantGroupId = "g", DbConnectionString = "cs", DBName = "db", JwtTokenParameters = null! };
            builds.Setup(b => b.TryEndPendingReport("run-1", AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "m", project))
                .ReturnsAsync(new Build { ItemId = "b1", ProjectId = "t1", CreatedBy = "u" });
            var notifications = new Mock<INotificationService>();

            await AnalysisReportUpdates.EndPendingAsync(builds.Object, notifications.Object, new ListLogger<AnalysisReportUpdatesTests>(),
                new AnalysisReportUpdates.PendingReportEnd("run-1", AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "m", "t1", project));

            builds.Verify(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            notifications.Verify(n => n.SendBuiltInAsync("t1", It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Once);
        }

        // ---- CreatedAtUtc ----

        [Fact]
        public void CreatedAtUtc_TreatsUnspecifiedAsUtcAndConvertsLocal()
        {
            var utc = new DateTime(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc);
            AnalysisReportUpdates.CreatedAtUtc(new Build { CreatedDate = utc }).Should().Be(new DateTimeOffset(utc));
            AnalysisReportUpdates.CreatedAtUtc(new Build { CreatedDate = DateTime.SpecifyKind(utc, DateTimeKind.Unspecified) })
                .Should().Be(new DateTimeOffset(utc));
            var local = utc.ToLocalTime();
            AnalysisReportUpdates.CreatedAtUtc(new Build { CreatedDate = local }).UtcDateTime.Should().Be(utc);
        }

        // ---- mapper: SAST ----

        [Fact]
        public void Mapper_SastGateAndBreakdown_RoundTripBetweenLocalAndGenesis()
        {
            var gate = new Local.SastQualityGate
            {
                Status = "ERROR",
                Conditions = new() { new() { MetricKey = "new_violations", Comparator = "GT", ErrorThreshold = "0", ActualValue = "367", Status = "ERROR" } }
            };
            var breakdown = new Local.SastIssueBreakdown
            {
                NewCode = new() { Total = 7, Blocker = 1, High = 2, Medium = 3, Low = 1, Info = 0 },
                Overall = null,
            };

            var genesisGate = AnalysisReportMapper.ToGenesis(gate);
            var genesisBreakdown = AnalysisReportMapper.ToGenesis(breakdown);

            genesisGate.Should().BeEquivalentTo(gate);
            genesisBreakdown.Should().BeEquivalentTo(breakdown);
            JsonSerializer.Serialize(AnalysisReportMapper.ToLocal(genesisGate)).Should().Be(JsonSerializer.Serialize(gate));
            JsonSerializer.Serialize(AnalysisReportMapper.ToLocal(genesisBreakdown)).Should().Be(JsonSerializer.Serialize(breakdown));
        }

        [Fact]
        public void Mapper_SastNulls_StayNull()
        {
            AnalysisReportMapper.ToGenesis((Local.SastQualityGate)null).Should().BeNull();
            AnalysisReportMapper.ToLocal((Genesis.SastQualityGate)null).Should().BeNull();
            AnalysisReportMapper.ToGenesis((Local.SastIssueBreakdown)null).Should().BeNull();
            AnalysisReportMapper.ToLocal((Genesis.SastIssueBreakdown)null).Should().BeNull();
            AnalysisReportMapper.ToLocal(new Genesis.SastQualityGate { Status = "OK", Conditions = null })!.Conditions.Should().BeEmpty();
        }

        // ---- mapper: SCA ----

        [Fact]
        public void Mapper_ToDetails_UsesTheLiveKeysAndFormattingPlusKev()
        {
            var live = JsonSerializer.Deserialize<Local.DependencyTrackProjectMetrics>(
                """{ "critical": 1, "high": 2, "inheritedRiskScore": 12.25, "kev": 3, "collectionLogic": null, "firstOccurrence": 1761645600000, "lastOccurrence": null }""");

            var details = AnalysisReportMapper.ToDetails(AnalysisReportMapper.ToGenesis(live));
            var liveDetails = DependencyTrackAnalyticsService.MetricsToDetails(live);

            details.Keys.Should().BeEquivalentTo(liveDetails.Keys.Append("kev"));
            foreach (var key in liveDetails.Keys)
                details[key].Should().Be(liveDetails[key], key);
            details["kev"].Should().Be("3");
            details["critical"].Should().Be("1");
            details["inheritedRiskScore"].Should().Be(12.25.ToString());
            details["collectionLogic"].Should().Be("null");
            details["firstOccurrence"].Should().Be("1761645600000");
            details["lastOccurrence"].Should().Be("null");
        }

        [Fact]
        public void Mapper_ToDetails_NullMetrics_IsEmpty() =>
            AnalysisReportMapper.ToDetails(null).Should().BeEmpty();

        [Fact]
        public void Mapper_ToFinding_NullComponentAndVulnerability_GivesNullsAndEmptyLists()
        {
            var f = AnalysisReportMapper.ToFinding(new Local.SCAVulnerability());

            f.ComponentName.Should().BeNull();
            f.VulnId.Should().BeNull();
            f.Severity.Should().BeNull();
            f.Cwes.Should().BeEmpty();
            f.Aliases.Should().BeEmpty();
        }

        [Fact]
        public void Mapper_ToFinding_SkipsNullCwesAndAliases()
        {
            var f = AnalysisReportMapper.ToFinding(new Local.SCAVulnerability
            {
                vulnerability = new Local.Vulnerability
                {
                    cwes = new() { null, new() { cweId = 79, name = "XSS" } },
                    aliases = new() { null, new() { osvId = "PYSEC-1" } },
                }
            });

            f.Cwes.Should().ContainSingle().Which.CweId.Should().Be(79);
            f.Aliases.Should().ContainSingle().Which.OsvId.Should().Be("PYSEC-1");
        }

        [Fact]
        public void Mapper_ToResponse_KeepsTheLiveShape()
        {
            var response = AnalysisReportMapper.ToResponse(new ScaFinding
            {
                ComponentName = "lodash", ComponentGroup = "npm", ComponentVersion = "4.17.20", LatestVersion = "4.17.21",
                VulnId = "CVE-2021-23337", CvssV3BaseScore = 7.2, CvssV4Score = 8.7, Severity = "HIGH",
                EpssScore = null, EpssPercentile = 0.5, CweName = "Command Injection", Description = "full",
                Aliases = new() { new() { CveId = "CVE-2021-23337", GhsaId = "GHSA-x/../y?z" } },
            });

            response.Name.Should().Be("lodash");
            response.Group.Should().Be("npm");
            response.Version.Should().Be("4.17.20");
            response.LatestVersion.Should().Be("4.17.21");
            response.Id.Should().Be("CVE-2021-23337");
            response.Score.Should().Be(7.2.ToString(), "score stays CVSS v3 as today");
            response.Severity.Should().Be("HIGH");
            response.EpssScore.Should().Be(0);
            response.EpssPercentile.Should().Be(0.5);
            response.CweName.Should().Be("Command Injection");
            response.Description.Should().Be("full");
            var alias = response.Aliases.Should().ContainSingle().Subject;
            alias.cveId.Should().Be("https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-23337");
            alias.ghsaId.Should().Be("https://github.com/advisories/GHSA-x%2F..%2Fy%3Fz");
            alias.osvId.Should().BeNull();
        }

        [Fact]
        public void Mapper_ToResponse_NullAliasesAndScores()
        {
            var response = AnalysisReportMapper.ToResponse(new ScaFinding { Aliases = null, CvssV3BaseScore = null, CvssV4Score = 9.0 });

            response.Aliases.Should().NotBeNull().And.BeEmpty();
            response.Score.Should().BeNull();
            response.EpssScore.Should().Be(0);
            response.EpssPercentile.Should().Be(0);
        }
    }
}
