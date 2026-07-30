using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Covers the log merging, notification fan-out and deployment status paths of
    /// LogRetrievalService. The two polling loops (CheckPodLogsAsync and
    /// CheckDataGatewayLog) are not exercised here: they poll on a fixed five second
    /// delay for up to thirty minutes, so no branch of them can be reached inside a
    /// reasonable test duration.
    /// </summary>
    public class LogRetrievalServiceTests
    {
        private readonly DeploymentServiceFactory _f = new();

        private static Dictionary<string, TaskLogs> SingleTask(string taskName, string status, string log) =>
            new()
            {
                [taskName] = new TaskLogs
                {
                    TaskRunName = $"{taskName}-run",
                    PodName = "pod-1",
                    Status = status,
                    Steps = new Dictionary<string, string> { ["step-1"] = log }
                }
            };

        // ---- MergeStepsPerTaskAsync ----

        [Fact]
        public async Task MergeStepsPerTaskAsync_NewTask_AddsStartedAndLogEvents()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string> { "user-2" });
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedGroup = null;
            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, group, status, _) => { stored = events; storedGroup = group; storedStatus = status; })
                .Returns(Task.CompletedTask);

            var result = await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("fetch-source", "Running", "cloning"), "run-1", "user-1", "tenant-1");

            result.Should().BeTrue();
            stored.Should().NotBeNull();
            // "Running" maps to Log, so a synthetic EventStarted is inserted before the Log event.
            stored.Should().Contain(e => e.EventGroup == EventGroups.Clone && e.EventType == EventTypes.EventStarted);
            stored.Should().Contain(e => e.EventGroup == EventGroups.Clone && e.EventType == EventTypes.Log);
            storedGroup.Should().Be(EventNames.CLONE);
            storedStatus.Should().Be(EventStatus.RUNNING);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_FinishedTask_BackfillsLogEvent()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, _, status, _) => { stored = events; storedStatus = status; })
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("deploy-app", "Succeeded", "deployed"), "run-1", "user-1", "tenant-1");

            stored.Should().Contain(e => e.EventGroup == EventGroups.Deploy && e.EventType == EventTypes.Log);
            stored.Should().Contain(e => e.EventGroup == EventGroups.Deploy && e.EventType == EventTypes.EventFinished);
            storedStatus.Should().Be(EventStatus.SUCCEEDED);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_ExistingMatchingEvent_UpdatesMessageInPlace()
        {
            var existing = new BuildEventResponse
            {
                Id = "e1",
                BuildId = "build-1",
                EventGroup = EventGroups.Build,
                EventType = EventTypes.Log,
                Message = "old"
            };
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse> { existing } };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, events, _, _, _) => stored = events)
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("build-push", "Running", "compiling"), "run-1", "user-1", "tenant-1");

            existing.Message.Should().Be("compiling" + Environment.NewLine);
            stored.Should().HaveCount(1);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_RedactsGithubUrlsAndNamespaces()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, events, _, _, _) => stored = events)
                .Returns(Task.CompletedTask);

            var logs = SingleTask("fetch-source", "Running", "cloning https://github.com/org/secret-repo.git");
            logs["fetch-source"].Steps["step-2"] = "namespace tenant-secret";

            await _f.LogRetrievalService().MergeStepsPerTaskAsync(logs, "run-1", "user-1", "tenant-1");

            var message = stored.Last().Message;
            message.Should().NotContain("github.com");
            message.Should().Contain("**");
            message.Should().Contain("namespace ***");
            message.Should().NotContain("tenant-secret");
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_BlankLogs_SkipsTaskEntirely()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());

            List<BuildEventResponse> stored = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, events, _, _, _) => stored = events)
                .Returns(Task.CompletedTask);

            var result = await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("fetch-source", "Running", "   "), "run-1", "user-1", "tenant-1");

            result.Should().BeTrue();
            stored.Should().BeEmpty();
            _f.Notification.Verify(n => n.NotifyPipeLineLogData(
                It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_NullSteps_SkipsTask()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());

            var logs = new Dictionary<string, TaskLogs>
            {
                ["fetch-source"] = new TaskLogs { Status = "Running", Steps = null }
            };

            var result = await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(logs, "run-1", "user-1", "tenant-1");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_UnmappedTaskName_UsesTaskNameAndRawStatus()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedGroup = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, group, _, _) => { stored = events; storedGroup = group; })
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("custom-task", "SomethingElse", "text"), "run-1", "user-1", "tenant-1");

            stored.Should().ContainSingle();
            stored[0].EventGroup.Should().Be("custom-task");
            stored[0].EventType.Should().Be("SomethingElse");
            // No priority group matched, so the build event name falls back to Unknown.
            storedGroup.Should().Be(EventNames.UNKNOWN);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_OnlyKnownEventGroupsAreNotified()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents(It.IsAny<string>(), It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var logs = SingleTask("sonar-scan", "Succeeded", "scanned");

            await _f.LogRetrievalService().MergeStepsPerTaskAsync(logs, "run-1", "user-1", "tenant-1");

            // Sast is not in EventGroups.EventGroupsList, so nothing is pushed to the hub.
            _f.Notification.Verify(n => n.NotifyPipeLineLogData(
                It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_RepositoryThrows_ReturnsFalse()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var result = await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("fetch-source", "Running", "x"), "run-1", "user-1", "tenant-1");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task MergeStepsPerTaskAsync_NullBuildEvents_StartsFromEmptyList()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = null };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync((List<string>)null);
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents(It.IsAny<string>(), It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var result = await _f.LogRetrievalService()
                .MergeStepsPerTaskAsync(SingleTask("deploy-app", "Failed", "boom"), "run-1", "user-1", "tenant-1");

            result.Should().BeTrue();
            _f.Notification.Verify(n => n.NotifyPipeLineLogData(
                It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                "tenant-1", "repo-1", EventStatus.FAILED), Times.AtLeastOnce);
        }

        // ---- SendNotification ----

        [Fact]
        public async Task SendNotification_MergesProjectPeopleWithTriggeringUser()
        {
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string> { "user-2", "user-1" });
            List<string> recipients = null;
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<BuildEventResponse, List<string>, string, string, string>((_, users, _, _, _) => recipients = users)
                .ReturnsAsync(true);

            var events = new List<BuildEventResponse> { new() { EventGroup = EventGroups.Build } };
            var result = await _f.LogRetrievalService()
                .SendNotification(events, "user-1", "tenant-1", "repo-1", EventStatus.RUNNING, "run-1");

            result.Should().BeTrue();
            recipients.Should().BeEquivalentTo(new[] { "user-2", "user-1" });
        }

        [Fact]
        public async Task SendNotification_NoPeopleList_NotifiesTriggeringUserOnly()
        {
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync((List<string>)null);
            List<string> recipients = null;
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<BuildEventResponse, List<string>, string, string, string>((_, users, _, _, _) => recipients = users)
                .ReturnsAsync(true);

            await _f.LogRetrievalService().SendNotification(
                new List<BuildEventResponse> { new() }, "user-1", "tenant-1", "repo-1", EventStatus.RUNNING, "run-1");

            recipients.Should().BeEquivalentTo(new[] { "user-1" });
        }

        [Fact]
        public async Task SendNotification_EmptyLogArray_SendsNothing()
        {
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());

            var result = await _f.LogRetrievalService().SendNotification(
                new List<BuildEventResponse>(), "user-1", "tenant-1", "repo-1", EventStatus.RUNNING, "run-1");

            result.Should().BeTrue();
            _f.Notification.Verify(n => n.NotifyPipeLineLogData(
                It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SendNotification_SendsOneMessagePerEvent()
        {
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList("tenant-1")).ReturnsAsync(new List<string>());
            _f.Notification
                .Setup(n => n.NotifyPipeLineLogData(
                    It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var events = new List<BuildEventResponse> { new(), new(), new() };
            await _f.LogRetrievalService().SendNotification(events, "user-1", "tenant-1", "repo-1", EventStatus.RUNNING, "run-1");

            _f.Notification.Verify(n => n.NotifyPipeLineLogData(
                It.IsAny<BuildEventResponse>(), It.IsAny<List<string>>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Exactly(3));
        }

        // ---- UpdateDeploymentStatus (PipelineRunStatus overload) ----

        [Fact]
        public async Task UpdateDeploymentStatus_Succeeded_ClosesGroupsAndUpdatesRepo()
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse>
                {
                    new() { EventGroup = EventGroups.Deploy, EventType = EventTypes.Log, Message = "last deploy log" }
                }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), "tenant-1")).ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, _, status, _) => { stored = events; storedStatus = status; })
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Succeeded" });

            storedStatus.Should().Be(EventStatus.SUCCEEDED);
            stored.Should().Contain(e => e.EventGroup == EventGroups.Deploy && e.EventType == EventTypes.EventFinished);
            stored.Last().Message.Should().Be("last deploy log");
            _f.RepoRepo.Verify(r => r.UpdateRepo(
                It.Is<RepoUpdateRequest>(u => u.RepoId == "repo-1" && u.LastDeploymentStatus == EventStatus.SUCCEEDED),
                "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task UpdateDeploymentStatus_NonSucceededStatus_MarksFailed()
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse>
                {
                    new() { EventGroup = EventGroups.Build, EventType = EventTypes.Log, Message = "compiling" }
                }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), "tenant-1")).ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, _, status, _) => { stored = events; storedStatus = status; })
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Failed" });

            storedStatus.Should().Be(EventStatus.FAILED);
            stored.Should().Contain(e => e.EventGroup == EventGroups.Build && e.EventType == EventTypes.EventFailed);
        }

        [Fact]
        public async Task UpdateDeploymentStatus_NullPipelineStatus_MarksFailed()
        {
            var build = new Build { ItemId = "build-1", RepoId = "repo-1", Events = new List<BuildEventResponse>() };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync((Repo)null);

            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, _, _, status, _) => storedStatus = status)
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", "tenant-1", (PipelineRunStatus)null);

            storedStatus.Should().Be(EventStatus.FAILED);
            // Repo lookup returned null, so no repo update is attempted.
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task UpdateDeploymentStatus_BuildNotFound_StillUpdatesEventsAndSkipsRepo()
        {
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync((Build)null);
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents(It.IsAny<string>(), It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Succeeded" });

            _f.BuildRepo.Verify(b => b.UpdateBuildEvents(
                "run-1", It.Is<List<BuildEventResponse>>(e => e.Count == 0),
                EventNames.UNKNOWN, EventStatus.SUCCEEDED, "tenant-1"), Times.Once);
            _f.RepoRepo.Verify(r => r.GetRepo(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task UpdateDeploymentStatus_AlreadyTerminalGroup_IsNotClosedAgain()
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse>
                {
                    new() { EventGroup = EventGroups.Clone, EventType = EventTypes.EventFinished, Message = "cloned" }
                }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync((Repo)null);

            List<BuildEventResponse> stored = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, events, _, _, _) => stored = events)
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Succeeded" });

            stored.Should().ContainSingle();
        }

        [Fact]
        public async Task UpdateDeploymentStatus_RepositoryThrows_IsSwallowed()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = async () => await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Succeeded" });

            await act.Should().NotThrowAsync();
        }

        // ---- UpdateDeploymentStatus (timeout overload) ----

        [Fact]
        public async Task UpdateDeploymentStatusTimeout_ClosesGroupsAsFailedAndUpdatesRepo()
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse>
                {
                    new() { EventGroup = EventGroups.Deploy, EventType = EventTypes.Log, Message = "deploying" }
                }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), "tenant-1")).ReturnsAsync(true);

            List<BuildEventResponse> stored = null;
            string storedStatus = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>(
                    (_, events, _, status, _) => { stored = events; storedStatus = status; })
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", "tenant-1", "Timeout");

            storedStatus.Should().Be(EventStatus.FAILED);
            stored.Should().Contain(e => e.EventType == EventTypes.EventFailed);
            _f.RepoRepo.Verify(r => r.UpdateRepo(
                It.Is<RepoUpdateRequest>(u => u.LastDeploymentStatus == EventStatus.FAILED), "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task UpdateDeploymentStatusTimeout_BuildNotFound_SkipsRepoUpdate()
        {
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync((Build)null);
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents(It.IsAny<string>(), It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", "tenant-1", "Timeout");

            _f.RepoRepo.Verify(r => r.GetRepo(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task UpdateDeploymentStatusTimeout_RepositoryThrows_IsSwallowed()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = async () => await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", "tenant-1", "Timeout");

            await act.Should().NotThrowAsync();
        }

        // ---- checkBuildEventName priority resolution, reached through UpdateDeploymentStatus ----

        [Theory]
        [InlineData(EventGroups.Clone, EventTypes.EventFailed, EventNames.CLONE)]
        [InlineData(EventGroups.Build, EventTypes.EventFailed, EventNames.BUILD)]
        [InlineData(EventGroups.Deploy, EventTypes.EventFailed, EventNames.DEPLOY)]
        [InlineData("Pipeline", EventTypes.EventStarted, EventNames.PIPELINE)]
        public async Task UpdateDeploymentStatus_ResolvesEventGroupByPriority(string group, string eventType, string expectedGroup)
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse> { new() { EventGroup = group, EventType = eventType, Message = "m" } }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync((Repo)null);

            string storedGroup = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, _, g, _, _) => storedGroup = g)
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Failed" });

            storedGroup.Should().Be(expectedGroup);
        }

        [Fact]
        public async Task UpdateDeploymentStatus_DeployWinsOverBuild()
        {
            var build = new Build
            {
                ItemId = "build-1",
                RepoId = "repo-1",
                Events = new List<BuildEventResponse>
                {
                    new() { EventGroup = EventGroups.Build, EventType = EventTypes.EventFinished, Message = "built" },
                    new() { EventGroup = EventGroups.Deploy, EventType = EventTypes.EventFinished, Message = "deployed" }
                }
            };
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", "tenant-1")).ReturnsAsync((Repo)null);

            string storedGroup = null;
            _f.BuildRepo
                .Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), "tenant-1"))
                .Callback<string, List<BuildEventResponse>, string, string, string>((_, _, g, _, _) => storedGroup = g)
                .Returns(Task.CompletedTask);

            await _f.LogRetrievalService().UpdateDeploymentStatus(
                "run-1", "tenant-1", new PipelineRunStatus { Status = "Succeeded" });

            storedGroup.Should().Be(EventNames.DEPLOY);
        }

        // ---- HasStartedAndRunningPipelineRunEvents ----

        [Fact]
        public void HasStartedAndRunningPipelineRunEvents_MatchingGroupAndType_ReturnsTrue()
        {
            var events = new List<BuildEventResponse>
            {
                new() { EventGroup = EventGroups.Clone, EventType = EventTypes.EventStarted }
            };

            _f.LogRetrievalService()
                .HasStartedAndRunningPipelineRunEvents(events, EventGroups.Clone, EventTypes.EventStarted)
                .Should().BeTrue();
        }

        [Fact]
        public void HasStartedAndRunningPipelineRunEvents_DifferentGroup_ReturnsFalse()
        {
            var events = new List<BuildEventResponse>
            {
                new() { EventGroup = EventGroups.Build, EventType = EventTypes.EventStarted }
            };

            _f.LogRetrievalService()
                .HasStartedAndRunningPipelineRunEvents(events, EventGroups.Clone, EventTypes.EventStarted)
                .Should().BeFalse();
        }

        [Fact]
        public void HasStartedAndRunningPipelineRunEvents_EmptyList_ReturnsFalse()
        {
            _f.LogRetrievalService()
                .HasStartedAndRunningPipelineRunEvents(new List<BuildEventResponse>(), EventGroups.Clone, EventTypes.Log)
                .Should().BeFalse();
        }
    }
}
