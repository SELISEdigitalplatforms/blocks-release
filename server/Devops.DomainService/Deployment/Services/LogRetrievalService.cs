using System.Diagnostics;
using System.Text;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Deployment.Models.Request;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using System.Threading.Tasks;
using Devops.DomainService.DataGatewayDeployment.Services;

public class LogRetrievalService
{
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly PipelineRunService _pipelineRunService;
    private readonly IMessageClient _messageClient;
    private readonly INotificationService _notificationService;
    private readonly IDataGatewayDeploymentRepository _dataGatewayDeploymentRepository;

    public LogRetrievalService(
                                IBuildRepository buildRepository, 
                                IRepoRepository repoRepository, 
                                PipelineRunService pipelineRunService,
                                TestReportService testReportService,
                                IMessageClient messageClient,
                                INotificationService notificationService,
                                IDataGatewayDeploymentRepository dataGatewayDeploymentRepository
                               )
    {
        _buildRepository = buildRepository;
        _repoRepository = repoRepository;
        _pipelineRunService = pipelineRunService;
        _messageClient = messageClient;
        _notificationService = notificationService;
        _dataGatewayDeploymentRepository = dataGatewayDeploymentRepository;
    }

    public async Task CheckPodLogsAsync(Build build)
    {
        var pipelineRunName = build.PipelineRunName;
        var namespaceName = CloudBuildConstants.NAMESPACE_NAME;
        var userId = build.CreatedBy;
        var tenantId = build.ProjectId;
        int pollingInterval = 5000;
        int maxPollingDuration = 1800000;
        var stopwatch = Stopwatch.StartNew();
        int eventFinishedCount = 0;
        int iteration = 0;
        await Task.Delay(pollingInterval);

        while (stopwatch.ElapsedMilliseconds < maxPollingDuration)
        {
            var allTaskLogs = new Dictionary<string, TaskLogs>();
            iteration++;
            Console.WriteLine($"Iteration {iteration} for pipeline {pipelineRunName} | Elapsed: {stopwatch.Elapsed.TotalMinutes:F2} minutes");
            try
            {
                PipelineRunStatus pipeLineStatus = await _pipelineRunService.GetPipelineRunStatusAsync(pipelineRunName, namespaceName);

                if (pipeLineStatus is null && iteration > 20)
                {
                    break;
                }
                foreach (var taskRun in pipeLineStatus.TaskRuns)
                {
                    var logs = await _pipelineRunService.GetTaskRunLogsAsync(taskRun.Name, namespaceName);
                    allTaskLogs[taskRun.TaskName] = logs;
                }

                //Console.WriteLine($"Filtered task logs: {JsonConvert.SerializeObject(allTaskLogs, Formatting.Indented)}");
                if (allTaskLogs == null || !allTaskLogs.Any())
                {
                    Console.WriteLine("No task logs found. Retrying after delay...");
                    await Task.Delay(pollingInterval);
                    continue;
                }
                await MergeStepsPerTaskAsync(allTaskLogs, pipelineRunName, userId, tenantId);

                if (AreAllTaskLogsInTerminalState(pipeLineStatus, allTaskLogs))
                {
                    Console.WriteLine($"All tasks reached a terminal state for pipeline {pipelineRunName}. Count {eventFinishedCount}.");
                    eventFinishedCount++;
                    if (eventFinishedCount > 10)
                    {
                        try
                        {
                            PostBuildQueue postBuildQueue = new PostBuildQueue
                            {
                                ProjectKey = build.ProjectId,
                                PipelineRunName = build.PipelineRunName,
                                PipelineType = PipelineTypes.RepoDeployment,
                                PipelineEventType = PipelineEventTypes.RetrieveDependencyTrackId
                            };
                            await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue> { ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER, Payload = postBuildQueue, SccheduledEnqueueTimeUtc = DateTimeOffset.UtcNow.AddMinutes(10) });
                        }
                        catch(Exception ex){
                            Console.WriteLine($"Failed to push data to queue.");
                        }
                        Console.WriteLine($"All tasks reached a terminal state for pipeline {pipelineRunName}. Count {eventFinishedCount} Stopping polling.");
                        break;
                    }
                }
                await Task.Delay(pollingInterval);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error polling logs for {pipelineRunName}: {ex.Message}");
                await Task.Delay(pollingInterval);
                continue;
            }
        }
        stopwatch.Stop();

        if (stopwatch.ElapsedMilliseconds >= maxPollingDuration)
        {
            try
            {
                await UpdateDeploymentStatus(pipelineRunName, tenantId, "Timeout");
                try
                {
                    PostBuildQueue postBuildQueue = new PostBuildQueue
                    {
                        ProjectKey = build.ProjectId,
                        PipelineRunName = build.PipelineRunName,
                        PipelineType = PipelineTypes.RepoDeployment,
                        PipelineEventType = PipelineEventTypes.DeletePipeLine
                    };
                    await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue> { ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER, Payload = postBuildQueue, SccheduledEnqueueTimeUtc = DateTimeOffset.UtcNow.AddMinutes(60) });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to push data to queue.");
                }
                Console.WriteLine($"Pipeline {pipelineRunName} monitoring timed out, status updated");
                return;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to update timeout status for {pipelineRunName}: {ex.Message}");
            }
        }
        await UpdateDeploymentStatus(pipelineRunName, tenantId);
        try
        {
            PostBuildQueue postBuildQueue = new PostBuildQueue
            {
                ProjectKey = build.ProjectId,
                PipelineRunName = build.PipelineRunName,
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = PipelineEventTypes.DeletePipeLine

            };
            await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue> { ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER, Payload = postBuildQueue, SccheduledEnqueueTimeUtc = DateTimeOffset.UtcNow.AddMinutes(60) });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to push data to queue.");
        }
    }


    public async Task<bool> MergeStepsPerTaskAsync(Dictionary<string, TaskLogs> allTaskLogs, string pipelineRunName, string userId, string tenantId)
    {
        try
        {
            Console.WriteLine($"MergeStepsPerTaskAsync merging allTaskLogs status for pipeline {pipelineRunName}.");

            Build build = await _buildRepository.GetBuildByPipelineRunName(pipelineRunName, tenantId);

            var results = build.Events ?? new List<BuildEventResponse>();
            foreach (var kvp in allTaskLogs)
            {
                string taskName = kvp.Key;
                TaskLogs taskLog = kvp.Value;
                bool isUpdated = false;
                var combinedLogsBuilder = new StringBuilder();

                if (taskLog.Steps != null)
                {
                    foreach (var step in taskLog.Steps)
                    {
                        combinedLogsBuilder.AppendLine($"{step.Value}");
                    }
                }

                var combinedLogsMessage = System.Text.RegularExpressions.Regex.Replace(
                    System.Text.RegularExpressions.Regex.Replace(
                        combinedLogsBuilder.ToString(),
                        @"\S*github\.com\S*",
                        "**"),
                    @"(?i)(namespace\s+).*",
                    "$1***");
                if (string.IsNullOrWhiteSpace(combinedLogsMessage))
                {
                    continue;
                }
                PipeLineTaskConstants.EventGroupMapping.TryGetValue(taskName, out var pipelineRunEventGroup);
                PipeLineTaskConstants.StatusEventMapping.TryGetValue(taskLog.Status, out var pipelineRunEventType);

                Console.WriteLine($"EventGroup: TaskName: - {taskName} EventGroup: - {pipelineRunEventGroup ?? taskName}, TaskLog Status: - {taskLog.Status} EventType: {pipelineRunEventType ?? taskLog.Status}");

                foreach (var item in results)
                {

                    var effectiveEventGroup = string.IsNullOrEmpty(pipelineRunEventGroup) ? taskName : pipelineRunEventGroup;
                    var effectiveEventType = string.IsNullOrEmpty(pipelineRunEventType) ? taskLog.Status : pipelineRunEventType;

                    if (item.EventGroup == effectiveEventGroup && item.EventType == effectiveEventType)
                    {
                        item.Message = combinedLogsMessage;
                        item.LastUpdateDate = DateTime.Now;
                        isUpdated = true;
                        break;
                    }
                }
                if (!isUpdated)
                {
                    Console.WriteLine($"Adding new status for EventGroup: TaskName: - {taskName} EventGroup: - {pipelineRunEventGroup ?? taskName}, TaskLog Status: - {taskLog.Status} EventType: {pipelineRunEventType ?? taskLog.Status}");

                    if (pipelineRunEventType == EventTypes.Log)
                    {
                        if (!HasStartedAndRunningPipelineRunEvents(results, pipelineRunEventGroup, EventTypes.EventStarted))
                        {
                            results.Add(new BuildEventResponse
                            {
                                Id = Guid.NewGuid().ToString(),
                                BuildId = build.ItemId,
                                EventType = EventTypes.EventStarted,
                                Message = combinedLogsMessage,
                                EventGroup = string.IsNullOrEmpty(pipelineRunEventGroup) ? taskName : pipelineRunEventGroup,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }

                    if (pipelineRunEventType == EventTypes.EventFinished || pipelineRunEventType == EventTypes.EventFailed || pipelineRunEventType == EventTypes.EventCancelled)
                    {
                        if(!HasStartedAndRunningPipelineRunEvents(results, pipelineRunEventGroup, EventTypes.Log))
                        {
                            results.Add(new BuildEventResponse
                            {
                                Id = Guid.NewGuid().ToString(),
                                BuildId = build.ItemId,
                                EventType = EventTypes.Log,
                                Message = combinedLogsMessage,
                                EventGroup = string.IsNullOrEmpty(pipelineRunEventGroup) ? taskName : pipelineRunEventGroup,
                                CreatedAt = DateTime.UtcNow
                            });
                        }

                        foreach (var item in results)
                        {

                            var effectiveEventGroup = string.IsNullOrEmpty(pipelineRunEventGroup) ? taskName : pipelineRunEventGroup;
                            var effectiveEventType = string.IsNullOrEmpty(pipelineRunEventType) ? taskLog.Status : pipelineRunEventType;

                            if (item.EventGroup == effectiveEventGroup && item.EventType == EventTypes.Log)
                            {
                                item.Message = combinedLogsMessage;
                                break;
                            }
                        }
                    }

                    results.Add(new BuildEventResponse
                    {
                        Id = Guid.NewGuid().ToString(),
                        BuildId = build.ItemId,
                        EventType = string.IsNullOrEmpty(pipelineRunEventType) ? taskLog.Status : pipelineRunEventType,
                        Message = combinedLogsMessage,
                        EventGroup = string.IsNullOrEmpty(pipelineRunEventGroup) ? taskName : pipelineRunEventGroup,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
            (string eventGroup, string buildStatus) = checkBuildEventName(results);
            await _buildRepository.UpdateBuildEvents(pipelineRunName, results, eventGroup, buildStatus, tenantId);
            var filteredResults = results.Where(x => EventGroups.EventGroupsList.Contains(x.EventGroup)).ToList();
            return await SendNotification(filteredResults, userId, tenantId, build.RepoId, buildStatus, pipelineRunName);
        }
        catch (Exception ex) 
        {
            Console.WriteLine($"Error deleting PipelineRun: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SendNotification(List<BuildEventResponse> logArray, string userId, string tenantId, string repoId, string buildStatus, string pipelineRunName)
    {

        Console.WriteLine($"Sending Notification for {pipelineRunName}.");
        var userIdLists = (await _repoRepository.GetProjectPeopleList(tenantId)
                   ?? new List<string>())
        .Append(userId)
        .Distinct()
        .ToList();

        for (int i = 0; i< logArray.Count(); i++)
        {
            await _notificationService.NotifyPipeLineLogData(logArray[i], userIdLists, tenantId, repoId, buildStatus);
            //var buildNotification = new LogNotificationQueue
            //{
            //    Message = logArray[i],
            //    UserIds = userIdLists,
            //    TenantId = tenantId,
            //    RepoId = repoId,
            //    BuildStatus = buildStatus
            //};
            //await _messageClient.SendToConsumerAsync(new ConsumerMessage<LogNotificationQueue> { ConsumerName = CloudBuildConstants.NOTIFICATION_LISTENER, Payload = azureTask });
        }
        return true;
    }
    private (string a, string b) checkBuildEventName(List<BuildEventResponse> buildEventResponse)
    {
        if (buildEventResponse == null || buildEventResponse.Count == 0)
            return (EventNames.UNKNOWN, EventNames.UNKNOWN);

        if (buildEventResponse.Count > 0)
        {
            var priorityGroups = new List<string>
            {
                EventNames.DEPLOY,
                EventNames.BUILD,
                EventNames.CLONE,
                EventNames.PIPELINE
            };

            foreach (var group in priorityGroups)
            {
                var lastEvent = buildEventResponse
                    .Where(e => e.EventGroup == group)
                    .LastOrDefault();
                if (lastEvent == null)
                    continue;

                switch (lastEvent.EventGroup)
                {
                    case EventNames.PIPELINE:
                        return (EventNames.PIPELINE, EventStatus.STARTED);
                    case EventNames.CLONE:
                        {
                            if (lastEvent.EventType == EventTypes.EventFailed)
                            {
                                return (EventNames.CLONE, EventStatus.FAILED);
                            }
                            return (EventNames.CLONE, EventStatus.RUNNING);
                        }
                    case EventNames.BUILD:
                        {
                            if (lastEvent.EventType == EventTypes.EventFailed)
                            {
                                return (EventNames.BUILD, EventStatus.FAILED);
                            }
                            return (EventNames.BUILD, EventStatus.RUNNING);
                        }
                    case EventNames.DEPLOY:
                        {
                            if (lastEvent.EventType == EventTypes.EventFinished)
                            {
                                return (EventNames.DEPLOY, EventStatus.SUCCEEDED);
                            }
                            if (lastEvent.EventType == EventTypes.EventFailed)
                            {
                                return (EventNames.DEPLOY, EventStatus.FAILED);
                            }
                            return (EventNames.DEPLOY, EventStatus.RUNNING);
                        }
                    default:
                        return (EventNames.UNKNOWN, EventNames.UNKNOWN);
                }
            }
        }
        return (EventNames.UNKNOWN, EventNames.UNKNOWN);
    }

    public async Task UpdateDeploymentStatus(string pipelineRunName, string tenantId)
    {
        Console.WriteLine("Updating DeploymentStatus of Repo");
        try
        {
            Build build = await _buildRepository.GetBuildByPipelineRunName(pipelineRunName, tenantId);
            string lastDeploymentStatus = build.Status;
            Repo repo = await _repoRepository.GetRepo(build.RepoId, tenantId);
            if (repo != null) 
            {
                var repoUpdate = new RepoUpdateRequest()
                {
                    RepoId = repo.ItemId,
                    LastDeploymentStatus = lastDeploymentStatus
                };
                await _repoRepository.UpdateRepo(repoUpdate, tenantId);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating deploymentStatus: {ex.Message}");
        }
    }

    public async Task UpdateDeploymentStatus(string pipelineRunName, string tenantId, string timedOutStatus)
    {
        Console.WriteLine("Updating DeploymentStatus of Repo");
        try
        {
            Build build = await _buildRepository.GetBuildByPipelineRunName(pipelineRunName, tenantId);
            await _buildRepository.UpdateBuildStatus(pipelineRunName, EventStatus.FAILED, tenantId);
            Repo repo = await _repoRepository.GetRepo(build.RepoId, tenantId);
            if (repo != null)
            {
                var repoUpdate = new RepoUpdateRequest()
                {
                    RepoId = repo.ItemId,
                    LastDeploymentStatus = EventStatus.FAILED,
                };
                await _repoRepository.UpdateRepo(repoUpdate, tenantId);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating deploymentStatus: {ex.Message}");
        }
    }

    public bool HasStartedAndRunningPipelineRunEvents(List<BuildEventResponse> events, string pipelineRunEventGroup, string pipelineRunEventType)
    {
        var filtered = events
            .Where(e => e.EventGroup == pipelineRunEventGroup)
            .ToList();

        return filtered.Any(e => e.EventType == pipelineRunEventType);
    }

    private bool AreAllTaskLogsInTerminalState(PipelineRunStatus pipelineRunStatus, Dictionary<string, TaskLogs> allTaskLogs)
    {
        Console.WriteLine($"Pipeline run status: {pipelineRunStatus.Status}, reason {pipelineRunStatus.Reason}");
        if (PipeLineTaskConstants.TermialStatus.Contains(pipelineRunStatus.Status))
            return true;

        if (allTaskLogs == null || allTaskLogs.Count == 0)
            return false;

        var terminalEvents = new HashSet<string>
        {
            EventTypes.EventFinished,
            EventTypes.EventFailed,
            EventTypes.EventCancelled
        };

        var priorityTasks = PipeLineTaskConstants.PriorityTaskList;

        var priorityTaskLogs = allTaskLogs
            .Where(kvp => priorityTasks.Contains(kvp.Key))
            .Select(kvp => kvp.Value)
            .ToList();

        if (priorityTaskLogs.Count == 0)
            return false;

        foreach (var taskLog in priorityTaskLogs)
        {
            if (!PipeLineTaskConstants.StatusEventMapping.TryGetValue(taskLog.Status, out var pipelineRunEventType))
            {
                return false;
            }

            if (!terminalEvents.Contains(pipelineRunEventType))
            {
                return false;
            }
        }

        return true;
    }


    public async Task CheckDataGatewayLog(string pipelineRunName, string tenantId)
    {
        var namespaceName = CloudBuildConstants.NAMESPACE_NAME;
        int pollingInterval = 5000;
        int maxPollingDuration = 1800000;
        var stopwatch = Stopwatch.StartNew();
        int eventFinishedCount = 0;
        int iteration = 0;
        await Task.Delay(pollingInterval);

        while (stopwatch.ElapsedMilliseconds < maxPollingDuration)
        {
            var allTaskLogs = new Dictionary<string, TaskLogs>();
            iteration++;
            Console.WriteLine($"Iteration {iteration} for pipeline {pipelineRunName} | Elapsed: {stopwatch.Elapsed.TotalMinutes:F2} minutes");
            try
            {
                PipelineRunStatus pipeLineStatus = await _pipelineRunService.GetPipelineRunStatusAsync(pipelineRunName, namespaceName);

                if (pipeLineStatus is null && iteration > 20)
                {
                    break;
                }
                foreach (var taskRun in pipeLineStatus.TaskRuns)
                {
                    var logs = await _pipelineRunService.GetTaskRunLogsAsync(taskRun.Name, namespaceName);
                    allTaskLogs[taskRun.TaskName] = logs;
                }

                //Console.WriteLine($"Filtered task logs: {JsonConvert.SerializeObject(allTaskLogs, Formatting.Indented)}");
                if (allTaskLogs == null || !allTaskLogs.Any())
                {
                    Console.WriteLine("No task logs found. Retrying after delay...");
                    await Task.Delay(pollingInterval);
                    continue;
                }

                if (PipeLineTaskConstants.TermialStatus.Contains(pipeLineStatus.Status))
                {
                    Console.WriteLine($"All tasks reached a terminal state for pipeline {pipelineRunName}. Count {eventFinishedCount}.");
                    eventFinishedCount++;
                    if (eventFinishedCount > 10)
                    {
                        await _dataGatewayDeploymentRepository.UpdatePipelineStatusAsync(tenantId,pipelineRunName, pipeLineStatus.Status);
                        Console.WriteLine($"All tasks reached a terminal state for pipeline {pipelineRunName}. Count {eventFinishedCount} Stopping polling.");
                        break;
                    }
                }
                await Task.Delay(pollingInterval);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error polling logs for {pipelineRunName}: {ex.Message}");
                await Task.Delay(pollingInterval);
                continue;
            }
        }
        stopwatch.Stop();

        try
        {
            PostBuildQueue postBuildQueue = new PostBuildQueue
            {
                ProjectKey = tenantId,
                PipelineRunName = pipelineRunName,
                PipelineType = PipelineTypes.DataGatewayPipeline,
                PipelineEventType = PipelineEventTypes.DeletePipeLine

            };
            await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue> { ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER, Payload = postBuildQueue, SccheduledEnqueueTimeUtc = DateTimeOffset.UtcNow.AddMinutes(60) });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to push data to queue.");
        }
    }



}