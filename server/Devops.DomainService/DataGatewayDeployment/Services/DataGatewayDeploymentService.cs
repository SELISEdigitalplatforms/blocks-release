using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.DataGetwayDeployment.Models;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.DataGetwayDeployment.Services
{
    public class DataGatewayDeploymentService: IDataGatewayDeploymentService
    {
        private readonly ILogger<DataGatewayDeploymentService> _logger;
        private readonly PipelineRunService _pipelineRunService;
        private readonly IDataGatewayDeploymentRepository _repository;
        private readonly IMessageClient _messageClient;
        private readonly IConfiguration _configuration;

        public DataGatewayDeploymentService(
            ILogger<DataGatewayDeploymentService> logger,
            PipelineRunService pipelineRunService,
            IDataGatewayDeploymentRepository repository,
            ITenants tenants,
            IConfiguration configuration,
            IMessageClient messageClient)
        {
            _logger = logger;
            _pipelineRunService = pipelineRunService;
            _repository = repository;
            _messageClient = messageClient;
            _configuration = configuration;
        }

        public async Task<bool> InitiateManualDataGatewayInstanceCreation(string projectKey)
        {
            try
            {
                _logger.LogInformation("Initiating DataGateway pipeline for projectId {ProjectName}", projectKey);

                Tenant project = await _repository.GetTenantByIdAsync(projectKey);
                if (project == null)
                {
                    _logger.LogError("Tenant not found for projectId: {ProjectId}", projectKey);
                    return false;
                }
                return await InitiateDataGatewayInstanceCreation(project);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initiate DataGateway instance creation pipeline for projectId: {ProjectName}", projectKey);
                return false;
            }
        }

        public async Task<bool> InitiateDataGatewayInstanceCreation(Tenant project)
        {
            try
            {
                _logger.LogInformation("Initiating DataGateway pipeline for project {ProjectName}", project.Name);

                var projectGuid = await _repository.GetBlocksGuidAsync(project.TenantGroupId);
                if (projectGuid == null)
                {
                    _logger.LogError("BlocksGuid not found for TenantGroupId: {TenantGroupId}", project.TenantGroupId);
                    return false;
                }

                string version = "v1";
                string tenantId = project.TenantId;
                string projectGuidId = $"{EnvironmentMapperHelper.EnvironmentMapper(project.Environment)}{projectGuid.EncodedValue}";
                string clusterNames = _configuration["DatagatewayClusterNames"];

                var pipelineRunName = await _pipelineRunService.CreateDataGetwayInstance(version, projectGuidId, clusterNames, project.Name, tenantId);
                if (string.IsNullOrEmpty(pipelineRunName))
                {
                    _logger.LogError("Failed to create DataGateway instance for project: {ProjectName}", project.Name);
                    return false;
                }

                await _repository.UpsertDataGatewayInstanceAsync(project, projectGuidId, pipelineRunName);

                return await QueuePostBuildEvent(project.TenantId, pipelineRunName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initiate DataGateway instance creation pipeline for project: {ProjectName}", project.Name);
                return false;
            }
        }

        private async Task<bool> QueuePostBuildEvent(string projectKey, string pipelineRunName)
        {
            try
            {
                var postBuildQueue = new PostBuildQueue
                {
                    ProjectKey = projectKey,
                    PipelineRunName = pipelineRunName,
                    PipelineType = PipelineTypes.DataGatewayPipeline,
                    PipelineEventType = PipelineEventTypes.RetrieveLog
                };

                await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue>
                {
                    ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER,
                    Payload = postBuildQueue
                });

                _logger.LogInformation("Queued post-build RetrieveLog event for DataGateway pipeline {PipelineRunName}", pipelineRunName);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to enqueue post-build event for DataGateway pipeline {PipelineRunName}", pipelineRunName);
                return false;
            }
        }
    }
}
