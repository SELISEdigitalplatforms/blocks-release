using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Worker.Consumers;
using XUnitTest.Devops.Deployment;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Worker
{
    /// <summary>
    /// #255 routing in PostBuildConsumer: CaptureSastReport / CaptureScaReport carry their attempt (H12), a legacy
    /// RetrieveDependencyTrackId becomes the next SCA attempt for a build with a report (H16), and the tenant/build
    /// checks still reject before any capture (C5). The capture services are real; what they reach is mocked.
    /// </summary>
    public class PostBuildConsumerCaptureTests
    {
        private readonly DeploymentServiceFactory _f = new();
        private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 10, 28, 10, 30, 0, TimeSpan.Zero));
        private readonly List<ConsumerMessage<PostBuildQueue>> _sent = new();

        public PostBuildConsumerCaptureTests()
        {
            _f.MessageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .Callback<ConsumerMessage<PostBuildQueue>>(_sent.Add).Returns(Task.CompletedTask);
            _f.BuildRepo.Setup(b => b.TrySaveSastReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<SastReport>(), It.IsAny<string>())).ReturnsAsync(true);
            _f.BuildRepo.Setup(b => b.TrySaveScaReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<ScaReport>(), It.IsAny<string>())).ReturnsAsync(true);
            // Dependency-Track has no project for the branch yet; SonarQube has no analysis since the build started.
            _f.Http.Setup(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((null, new HttpResponseMessage(HttpStatusCode.NotFound)));
            _f.Http.Setup(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SonarProjectBranchesResponse { Branches = new() { new() { Name = "dev", AnalysisDate = "2026-10-01T00:00:00+0000" } } }, ""));
        }

        private PostBuildConsumer Consumer()
        {
            var services = new ServiceCollection();
            services.AddSingleton(_f.LogRetrievalService());
            services.AddSingleton(_f.ScaAnalyticsService());
            services.AddSingleton(_f.BuildRepo.Object);
            services.AddSingleton(new SastCaptureService(new SASTStrategy(_f.Http.Object, _f.Secret.Object, _f.Config),
                _f.BuildRepo.Object, _f.MessageClient.Object, new ListLogger<SastCaptureService>(), _f.Notification.Object, _clock));
            services.AddSingleton(sp => new ScaCaptureService(sp.GetRequiredService<global::Devops.DomainService.AnalyticsTool.Services.Sca.DependencyTrackAnalyticsService>(),
                _f.BuildRepo.Object, _f.MessageClient.Object, new ListLogger<ScaCaptureService>(), _f.Notification.Object, _clock));
            var scopes = services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
            return new PostBuildConsumer(new Mock<ILogger<PostBuildConsumer>>().Object, scopes, _f.PipelineRunService());
        }

        private void GivenBuild(Build build) =>
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);

        private static Build NewBuild(SastReport sast = null, ScaReport sca = null, string projectId = "tenant-1") => new()
        {
            ItemId = "build-1",
            RepoId = "repo-1",
            ProjectId = projectId,
            RepoName = "org/repo",
            Branch = "dev",
            PipelineRunName = "run-1",
            CreatedBy = "user-1",
            CreatedDate = new DateTime(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc),
            SastReport = sast,
            ScaReport = sca,
        };

        private static PostBuildQueue Message(PipelineEventTypes type, int attempt = 0) => new()
        {
            ProjectKey = "tenant-1",
            PipelineRunName = "run-1",
            PipelineType = PipelineTypes.RepoDeployment,
            PipelineEventType = type,
            Attempt = attempt,
        };

        private static SastReport PendingSast(int attempts) => new() { Status = AnalysisReportStatus.Pending, Attempts = attempts };
        private static ScaReport PendingSca(int attempts) => new() { Status = AnalysisReportStatus.Pending, Attempts = attempts };

        private void VerifyNoToolCall()
        {
            _f.Http.Verify(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
            _f.Http.Verify(h => h.MakeHttpGetRequest<SonarProjectBranchesResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()), Times.Never);
        }

        private void VerifyNoReportWrite()
        {
            _f.BuildRepo.Verify(b => b.TrySaveSastReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<SastReport>(), It.IsAny<string>()), Times.Never);
            _f.BuildRepo.Verify(b => b.TrySaveScaReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<ScaReport>(), It.IsAny<string>()), Times.Never);
            _f.BuildRepo.Verify(b => b.UpdateBuildDependencyTrackProjectId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.RepoRepo.Verify(r => r.UpdateRepoDependencyTrackProjectUuid(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // ---- routing ----

        [Fact]
        public async Task CaptureSastReport_RunsTheSastAttemptTheMessageCarries()
        {
            GivenBuild(NewBuild(sast: PendingSast(1), sca: PendingSca(0)));

            await Consumer().Consume(Message(PipelineEventTypes.CaptureSastReport, attempt: 2));

            _f.BuildRepo.Verify(b => b.TrySaveSastReport("build-1", 1,
                It.Is<SastReport>(r => r.Status == AnalysisReportStatus.Pending && r.Attempts == 2), "tenant-1"), Times.Once);
            _f.BuildRepo.Verify(b => b.TrySaveScaReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<ScaReport>(), It.IsAny<string>()), Times.Never);
            _sent.Should().ContainSingle().Which.Payload.Should().Match<PostBuildQueue>(p =>
                p.PipelineEventType == PipelineEventTypes.CaptureSastReport && p.Attempt == 3);
        }

        [Fact]
        public async Task CaptureScaReport_RunsTheScaAttemptTheMessageCarries()
        {
            GivenBuild(NewBuild(sast: PendingSast(0), sca: PendingSca(2)));

            await Consumer().Consume(Message(PipelineEventTypes.CaptureScaReport, attempt: 3));

            _f.BuildRepo.Verify(b => b.TrySaveScaReport("build-1", 2,
                It.Is<ScaReport>(r => r.Status == AnalysisReportStatus.Pending && r.Attempts == 3), "tenant-1"), Times.Once);
            _f.BuildRepo.Verify(b => b.TrySaveSastReport(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<SastReport>(), It.IsAny<string>()), Times.Never);
            _sent.Should().ContainSingle().Which.Payload.Should().Match<PostBuildQueue>(p =>
                p.PipelineEventType == PipelineEventTypes.CaptureScaReport && p.Attempt == 4);
        }

        [Fact]
        public async Task C3_DuplicateCaptureMessage_CompletesWithoutEffect()
        {
            // Example 6: attempt 2 delivered again after the first delivery moved the report on.
            GivenBuild(NewBuild(sast: new SastReport { Status = AnalysisReportStatus.Ready, Attempts = 2 }, sca: PendingSca(2)));

            var act = () => Consumer().Consume(Message(PipelineEventTypes.CaptureSastReport, attempt: 2));

            await act.Should().NotThrowAsync();
            VerifyNoToolCall();
            VerifyNoReportWrite();
            _sent.Should().BeEmpty();
            _f.Notification.Invocations.Should().BeEmpty();
        }

        // ---- H16 ----

        [Fact]
        public async Task H16_RetrieveDependencyTrackId_ForABuildWithAReport_IsTheNextScaAttempt()
        {
            GivenBuild(NewBuild(sast: PendingSast(0), sca: PendingSca(2)));

            await Consumer().Consume(Message(PipelineEventTypes.RetrieveDependencyTrackId));

            // Attempt = ScaReport.Attempts + 1 = 3: the conditional write expects 2 attempts.
            _f.BuildRepo.Verify(b => b.TrySaveScaReport("build-1", 2,
                It.Is<ScaReport>(r => r.Status == AnalysisReportStatus.Pending && r.Attempts == 3), "tenant-1"), Times.Once);
            _sent.Should().ContainSingle().Which.Payload.Attempt.Should().Be(4);
            // Not today's lookup-and-notify.
            _f.Notification.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task H16_RetrieveDependencyTrackId_ForABuildWithAFinishedReport_ChangesNothing()
        {
            GivenBuild(NewBuild(sca: new ScaReport { Status = AnalysisReportStatus.Ready, Attempts = 2 }));

            await Consumer().Consume(Message(PipelineEventTypes.RetrieveDependencyTrackId));

            VerifyNoToolCall();
            VerifyNoReportWrite();
            _f.Notification.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task H16_RetrieveDependencyTrackId_ForALegacyBuild_KeepsTodaysLookupAndNotification()
        {
            GivenBuild(NewBuild());

            await Consumer().Consume(Message(PipelineEventTypes.RetrieveDependencyTrackId));

            _f.Http.Verify(h => h.MakeHttpRequest<ScaLookupResponse>(It.IsAny<string>(), It.Is<string>(u => u.Contains("name=org-repo&version=dev")), HttpMethod.Get,
                It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Once);
            VerifyNoReportWrite();
            _sent.Should().BeEmpty();
            // Today's per-lookup notification (the lookup found nothing, so ok = false).
            _f.Notification.Verify(n => n.SendBuiltInAsync("tenant-1", "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(),
                It.Is<IDictionary<string, object>>(p => (bool)p["isSuccess"] == false && (string)p["description"] == "The dependency (SCA) analysis of the build did not finish.")),
                Times.Once);
        }

        // ---- C5 ----

        [Theory]
        [InlineData(PipelineEventTypes.CaptureSastReport)]
        [InlineData(PipelineEventTypes.CaptureScaReport)]
        [InlineData(PipelineEventTypes.RetrieveDependencyTrackId)]
        public async Task C5_BuildOfAnotherTenant_IsRejectedBeforeAnyCapture(PipelineEventTypes type)
        {
            GivenBuild(NewBuild(sast: PendingSast(0), sca: PendingSca(0), projectId: "tenant-2"));

            var act = () => Consumer().Consume(Message(type, attempt: 1));

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("Build does not belong to the message target tenant.");
            VerifyNoToolCall();
            VerifyNoReportWrite();
            _sent.Should().BeEmpty();
        }

        [Theory]
        [InlineData(PipelineEventTypes.CaptureSastReport)]
        [InlineData(PipelineEventTypes.CaptureScaReport)]
        public async Task C5_UnknownBuild_IsRejectedBeforeAnyCapture(PipelineEventTypes type)
        {
            GivenBuild(null);

            var act = () => Consumer().Consume(Message(type, attempt: 1));

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*No build found for pipeline run-1*");
            VerifyNoToolCall();
            VerifyNoReportWrite();
        }

        [Fact]
        public async Task C5_MessageWithoutTenant_IsRejectedBeforeAnyRead()
        {
            var message = Message(PipelineEventTypes.CaptureSastReport, attempt: 1);
            message.ProjectKey = " ";

            var act = () => Consumer().Consume(message);

            await act.Should().ThrowAsync<InvalidOperationException>();
            _f.BuildRepo.Invocations.Should().BeEmpty();
        }
    }
}
