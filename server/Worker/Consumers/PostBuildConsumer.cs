using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Models;

namespace Worker.Consumers
{
    public class PostBuildConsumer : IConsumer<PostBuildQueue>
    {
        private readonly ILogger<PostBuildConsumer> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly PipelineRunService _pipelineRunService;

        public PostBuildConsumer(
            ILogger<PostBuildConsumer> logger,
            IServiceScopeFactory scopeFactory,
            PipelineRunService pipelineRunService)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _pipelineRunService = pipelineRunService;
        }

        public async Task Consume(PostBuildQueue task)
        {
            try
            {
                _logger.LogInformation(
                    $"Received message from queue for project {task.ProjectKey}, pipeline {task.PipelineRunName}, event {task.PipelineEventType}, pipeline type {task.PipelineEventType}");

                using var scope = _scopeFactory.CreateScope();
                var logRetrievalService = scope.ServiceProvider.GetRequiredService<LogRetrievalService>();
                
                if (task.PipelineType == PipelineTypes.RepoDeployment)
                {
                    if (string.IsNullOrWhiteSpace(task.ProjectKey) || string.IsNullOrWhiteSpace(task.PipelineRunName))
                        throw new InvalidOperationException("Repo deployment message has no target tenant or pipeline run.");

                    var dependencyTrackAnalyticsService = scope.ServiceProvider.GetRequiredService<DependencyTrackAnalyticsService>();
                    var buildRepository = scope.ServiceProvider.GetRequiredService<IBuildRepository>();

                    var build = await buildRepository.GetBuildByPipelineRunName(task.PipelineRunName, task.ProjectKey);
                    if (build == null)
                    {
                        throw new InvalidOperationException($"No build found for pipeline {task.PipelineRunName} in tenant {task.ProjectKey}.");
                    }
                    if (!string.Equals(build.ProjectId, task.ProjectKey, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("Build does not belong to the message target tenant.");

                    switch (task.PipelineEventType)
                    {
                        case PipelineEventTypes.RetrieveLog:
                            await logRetrievalService.CheckPodLogsAsync(build);
                            break;

                        case PipelineEventTypes.RetrieveDependencyTrackId:
                            await dependencyTrackAnalyticsService.RetrieveScaProjectUuid(build);
                            break;

                        case PipelineEventTypes.DeletePipeLine:
                            await _pipelineRunService.DeletePipelineRunAsync(task.PipelineRunName);
                            break;

                        default:
                            _logger.LogWarning($"Unknown build event type {task.PipelineEventType} for project {task.ProjectKey}");
                            break;
                    }
                }
                else if(task.PipelineType == PipelineTypes.DataGatewayPipeline)
                {
                    switch (task.PipelineEventType)
                    {
                        case PipelineEventTypes.RetrieveLog:
                            await logRetrievalService.CheckDataGatewayLog(task.PipelineRunName, task.ProjectKey);
                            break;
                        case PipelineEventTypes.DeletePipeLine:
                            await _pipelineRunService.DeletePipelineRunAsync(task.PipelineRunName);
                            break;
                        default:
                            _logger.LogWarning($"Unknown build event type {task.PipelineEventType} for project {task.ProjectKey}");
                            break;
                    }
                }
                else
                {
                    _logger.LogWarning($"Unknown pipeline type {task.PipelineType} for project {task.ProjectKey}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to process message from queue for project {task?.ProjectKey}, pipeline {task?.PipelineRunName}");
                if (task?.PipelineType == PipelineTypes.RepoDeployment)
                    throw;
            }
        }
    }
}
