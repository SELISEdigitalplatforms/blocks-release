using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// #255 when the log poller stops: each scan step decides its report from the §6.4 table (H2, H3, C1), a build
    /// without reports keeps today's single RetrieveDependencyTrackId message (Q2 A), and the 30-minute timeout ends
    /// the still-Pending reports (C6). CheckPodLogsAsync itself is not run: it polls every 5 s for up to 30 min.
    /// </summary>
    public class LogRetrievalReportCaptureTests
    {
        private readonly DeploymentServiceFactory _f = new();
        private readonly List<ConsumerMessage<PostBuildQueue>> _sent = new();
        private readonly List<(string Run, AnalysisReportKind Kind, string Status, string Message, string Tenant)> _ended = new();
        private readonly ListLogger<LogRetrievalService> _logger = new();

        public LogRetrievalReportCaptureTests()
        {
            _f.MessageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .Callback<ConsumerMessage<PostBuildQueue>>(_sent.Add).Returns(Task.CompletedTask);
            _f.BuildRepo.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<string, AnalysisReportKind, string, string, string>((run, kind, status, message, tenant) => _ended.Add((run, kind, status, message, tenant)))
                .ReturnsAsync(new Build { ItemId = "build-1", ProjectId = "tenant-1", CreatedBy = "user-1", RepoId = "repo-1" });
        }

        private LogRetrievalService Create() =>
            new(_f.BuildRepo.Object, _f.RepoRepo.Object, _f.PipelineRunService(), _f.MessageClient.Object, _f.Notification.Object, _f.DataGatewayRepo.Object, _logger);

        private static Build NewBuild(bool withReports = true) => new()
        {
            ItemId = "build-1",
            RepoId = "repo-1",
            ProjectId = "tenant-1",
            RepoName = "org/repo",
            Branch = "dev",
            PipelineRunName = "run-1",
            CreatedBy = "user-1",
            SastReport = withReports ? new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 0 } : null,
            ScaReport = withReports ? new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = 0 } : null,
        };

        private static PipelineRunStatus Pipeline(string status) => new() { Status = status };

        /// <summary>Task logs where <paramref name="step"/> is in <paramref name="state"/> (null = no TaskRun) and the other scan succeeded.</summary>
        private static Dictionary<string, TaskLogs> Logs(string step, string state)
        {
            var logs = new Dictionary<string, TaskLogs>
            {
                ["fetch-source"] = new() { Status = "Succeeded" },
                ["build-push"] = new() { Status = "Succeeded" },
                ["deploy-app"] = new() { Status = "Succeeded" },
                ["sonar-scan"] = new() { Status = "Succeeded" },
                ["sca-scan"] = new() { Status = "Succeeded" },
            };
            if (state is null) logs.Remove(step);
            else logs[step] = new TaskLogs { TaskRunName = step + "-run", Status = state };
            return logs;
        }

        private static (AnalysisReportKind Kind, PipelineEventTypes Event, TimeSpan Delay) Of(string step) => step == "sonar-scan"
            ? (AnalysisReportKind.Sast, PipelineEventTypes.CaptureSastReport, TimeSpan.FromMinutes(1))
            : (AnalysisReportKind.Sca, PipelineEventTypes.CaptureScaReport, TimeSpan.FromMinutes(3));

        private static string Other(string step) => step == "sonar-scan" ? "sca-scan" : "sonar-scan";

        private void ShouldHaveScheduledAttemptOne(string step, DateTimeOffset before, DateTimeOffset after)
        {
            var (_, eventType, delay) = Of(step);
            var message = _sent.Where(m => m.Payload.PipelineEventType == eventType).Should().ContainSingle().Subject;
            message.ConsumerName.Should().Be(CloudBuildConstants.POST_BUILD_LISTENER);
            message.Payload.Attempt.Should().Be(1);
            message.Payload.ProjectKey.Should().Be("tenant-1");
            message.Payload.PipelineRunName.Should().Be("run-1");
            message.Payload.PipelineType.Should().Be(PipelineTypes.RepoDeployment);
            message.ScheduledEnqueueTimeUtc.Should().NotBeNull();
            message.ScheduledEnqueueTimeUtc!.Value.Should().BeOnOrAfter(before + delay).And.BeOnOrBefore(after + delay);
        }

        // ---- §6.4 step table, both steps (H2, H3, C1) ----

        [Theory]
        [InlineData("sonar-scan", "Succeeded", "Running")]
        [InlineData("sca-scan", "Succeeded", "Running")]
        [InlineData("sonar-scan", "Running", "Running")]
        [InlineData("sca-scan", "Running", "Running")]
        [InlineData("sonar-scan", "Pending", "Running")]
        [InlineData("sca-scan", "Pending", "Running")]
        [InlineData("sonar-scan", "Unknown", "Succeeded")]
        [InlineData("sca-scan", "Unknown", "Succeeded")]
        [InlineData("sonar-scan", null, "Running")]   // absent while the PipelineRun still runs
        [InlineData("sca-scan", null, "Running")]
        [InlineData("sonar-scan", null, "Started")]
        public async Task H2_H3_StepSucceededRunningOrNotStartedOnARunningPipeline_SchedulesAttemptOne(string step, string state, string pipelineStatus)
        {
            var before = DateTimeOffset.UtcNow;
            await Create().StartReportCaptureAsync(NewBuild(), Pipeline(pipelineStatus), Logs(step, state));
            var after = DateTimeOffset.UtcNow;

            ShouldHaveScheduledAttemptOne(step, before, after);
            _ended.Should().NotContain(e => e.Kind == Of(step).Kind);
            _f.Notification.Invocations.Should().BeEmpty();
            // Exactly one capture message per report, and no legacy RetrieveDependencyTrackId.
            _sent.Should().HaveCount(2);
            _sent.Should().NotContain(m => m.Payload.PipelineEventType == PipelineEventTypes.RetrieveDependencyTrackId);
        }

        [Theory]
        [InlineData("sonar-scan", "Failed")]
        [InlineData("sca-scan", "Failed")]
        [InlineData("sonar-scan", "TaskRunTimeout")]
        [InlineData("sca-scan", "TaskRunTimeout")]
        [InlineData("sonar-scan", "Cancelled")]
        [InlineData("sca-scan", "Cancelled")]
        [InlineData("sonar-scan", "TaskRunCancelled")]
        [InlineData("sca-scan", "TaskRunCancelled")]
        public async Task C1_StepFailedOrCancelled_EndsTheReportNotRunAndNotifiesOnce(string step, string state)
        {
            await Create().StartReportCaptureAsync(NewBuild(), Pipeline("Failed"), Logs(step, state));

            var (kind, eventType, _) = Of(step);
            var message = $"The {step} step did not succeed.";
            _ended.Should().ContainSingle().Which.Should().Be(("run-1", kind, AnalysisReportStatus.NotRun, message, "tenant-1"));
            _sent.Should().NotContain(m => m.Payload.PipelineEventType == eventType, "no capture is scheduled for a scan that did not run");
            _sent.Should().ContainSingle(m => m.Payload.PipelineEventType == Of(Other(step)).Event);

            _f.Notification.Verify(n => n.SendBuiltInAsync("tenant-1", "release-code-analysis-finished",
                It.Is<IEnumerable<string>>(u => u.SequenceEqual(new[] { "user-1" })),
                It.Is<IDictionary<string, object>>(p => (bool)p["isSuccess"] == false && (string)p["description"] == message
                    && (string)p["analysisType"] == (kind == AnalysisReportKind.Sast ? "SAST" : "SCA"))), Times.Once);
            _f.Notification.Verify(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Once);
        }

        [Theory]
        [InlineData("sonar-scan", "Failed")]
        [InlineData("sca-scan", "Failed")]
        [InlineData("sonar-scan", "Succeeded")]
        [InlineData("sca-scan", "Succeeded")]
        [InlineData("sonar-scan", "PipelineRunCancelled")]
        [InlineData("sca-scan", "PipelineRunTimeout")]
        public async Task C1_NoTaskRunOnATerminalPipeline_EndsTheReportNotRunAndNotifiesOnce(string step, string pipelineStatus)
        {
            await Create().StartReportCaptureAsync(NewBuild(), Pipeline(pipelineStatus), Logs(step, null));

            var (kind, eventType, _) = Of(step);
            var message = $"The {step} step did not run.";
            _ended.Should().ContainSingle().Which.Should().Be(("run-1", kind, AnalysisReportStatus.NotRun, message, "tenant-1"));
            _sent.Should().NotContain(m => m.Payload.PipelineEventType == eventType);
            _f.Notification.Verify(n => n.SendBuiltInAsync("tenant-1", "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(),
                It.Is<IDictionary<string, object>>(p => (bool)p["isSuccess"] == false && (string)p["description"] == message)), Times.Once);
        }

        [Fact]
        public async Task C1_BothStepsDidNotRun_EndsBothReportsAndSchedulesNothing()
        {
            var logs = Logs("sonar-scan", null);
            logs.Remove("sca-scan");

            await Create().StartReportCaptureAsync(NewBuild(), Pipeline("Failed"), logs);

            _ended.Select(e => (e.Kind, e.Message)).Should().BeEquivalentTo(new[]
            {
                (AnalysisReportKind.Sast, "The sonar-scan step did not run."),
                (AnalysisReportKind.Sca, "The sca-scan step did not run."),
            });
            _sent.Should().BeEmpty();
            _f.Notification.Verify(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Exactly(2));
        }

        [Fact]
        public async Task C1_ReportAlreadyEndedElsewhere_DoesNotNotify()
        {
            _f.BuildRepo.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Build)null);

            await Create().StartReportCaptureAsync(NewBuild(), Pipeline("Failed"), Logs("sca-scan", "Failed"));

            _f.Notification.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task SchedulingFails_IsLoggedAndTheOtherReportStillStarts()
        {
            _f.MessageClient.SetupSequence(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .ThrowsAsync(new Exception("bus down"))
                .Returns(Task.CompletedTask);

            var act = () => Create().StartReportCaptureAsync(NewBuild(), Pipeline("Succeeded"), Logs("sca-scan", "Succeeded"));

            await act.Should().NotThrowAsync();
            _f.MessageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()), Times.Exactly(2));
            _logger.Entries.Should().ContainSingle(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error && e.Message.Contains("Could not start the Sca capture"));
        }

        // ---- legacy builds (Q2 A) ----

        [Fact]
        public async Task Q2_BuildWithoutReports_KeepsTodaysSingleRetrieveDependencyTrackIdMessage()
        {
            var before = DateTimeOffset.UtcNow;
            await Create().StartReportCaptureAsync(NewBuild(withReports: false), Pipeline("Succeeded"), Logs("sca-scan", "Failed"));
            var after = DateTimeOffset.UtcNow;

            var message = _sent.Should().ContainSingle().Subject;
            message.ConsumerName.Should().Be(CloudBuildConstants.POST_BUILD_LISTENER);
            message.Payload.PipelineEventType.Should().Be(PipelineEventTypes.RetrieveDependencyTrackId);
            message.Payload.Attempt.Should().Be(0);
            message.Payload.ProjectKey.Should().Be("tenant-1");
            message.Payload.PipelineRunName.Should().Be("run-1");
#pragma warning disable CS0618 // today's code sets the obsolete alias
            var at = message.ScheduledEnqueueTimeUtc ?? message.SccheduledEnqueueTimeUtc;
#pragma warning restore CS0618
            at.Should().NotBeNull();
            at!.Value.Should().BeOnOrAfter(before.AddMinutes(10)).And.BeOnOrBefore(after.AddMinutes(10));

            _f.BuildRepo.Invocations.Should().BeEmpty("nothing is written to a build from before the release");
            _f.Notification.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task Q2_BuildWithoutReports_SchedulingFails_DoesNotThrow()
        {
            _f.MessageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>())).ThrowsAsync(new Exception("bus down"));

            var act = () => Create().StartReportCaptureAsync(NewBuild(withReports: false), Pipeline("Succeeded"), Logs("sca-scan", "Succeeded"));

            await act.Should().NotThrowAsync();
        }

        // ---- ScanStepNotRunMessage ----

        [Theory]
        [InlineData("Succeeded", "Succeeded", null)]
        [InlineData("Running", "Running", null)]
        [InlineData("SomethingNew", "Failed", null)] // unmapped TaskRun status: wait for the scan
        [InlineData(null, "Failed", null)]           // TaskRun without status
        [InlineData("Failed", "Running", "The sonar-scan step did not succeed.")]
        [InlineData("CancelledRunFinally", "Cancelled", "The sonar-scan step did not succeed.")]
        public void ScanStepNotRunMessage_MapsTheTaskRunStatus(string taskStatus, string pipelineStatus, string expected)
        {
            var logs = new Dictionary<string, TaskLogs> { ["sonar-scan"] = new() { Status = taskStatus } };

            LogRetrievalService.ScanStepNotRunMessage("sonar-scan", Pipeline(pipelineStatus), logs).Should().Be(expected);
        }

        [Fact]
        public void ScanStepNotRunMessage_NullTaskLogEntry_CountsAsAbsent()
        {
            var logs = new Dictionary<string, TaskLogs> { ["sca-scan"] = null };

            LogRetrievalService.ScanStepNotRunMessage("sca-scan", Pipeline("Failed"), logs).Should().Be("The sca-scan step did not run.");
            LogRetrievalService.ScanStepNotRunMessage("sca-scan", Pipeline("Running"), logs).Should().BeNull();
        }

        // ---- C6 ----

        [Fact]
        public async Task C6_Timeout_EndsBothPendingReportsFailedAndNotifiesEach()
        {
            await Create().EndPendingReportsAsync(NewBuild(), AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.");

            _ended.Should().BeEquivalentTo(new[]
            {
                ("run-1", AnalysisReportKind.Sast, AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.", "tenant-1"),
                ("run-1", AnalysisReportKind.Sca, AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.", "tenant-1"),
            });
            _f.Notification.Verify(n => n.SendBuiltInAsync("tenant-1", "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(),
                It.Is<IDictionary<string, object>>(p => (bool)p["isSuccess"] == false && (string)p["description"] == "The pipeline did not finish within 30 minutes.")),
                Times.Exactly(2));
            _sent.Should().BeEmpty();
        }

        [Fact]
        public async Task C6_LegacyBuild_TouchesNoRepository()
        {
            await Create().EndPendingReportsAsync(NewBuild(withReports: false), AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.");

            _f.BuildRepo.Invocations.Should().BeEmpty();
            _f.Notification.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task C6_RepositoryThrows_IsLoggedAndTheOtherReportIsStillEnded()
        {
            _f.BuildRepo.Setup(b => b.TryEndPendingReport("run-1", AnalysisReportKind.Sast, It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .ThrowsAsync(new Exception("mongo down"));

            var act = () => Create().EndPendingReportsAsync(NewBuild(), AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.");

            await act.Should().NotThrowAsync();
            _ended.Should().ContainSingle().Which.Kind.Should().Be(AnalysisReportKind.Sca);
            _logger.Entries.Should().ContainSingle(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error && e.Message.Contains("Could not end the Sast report"));
        }
    }
}
