using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.DataGetwayDeployment.Services;

namespace Worker.Consumers
{
    public class PostProjectCreateConsumer : IConsumer<Tenant>
    {
        private readonly ILogger<PostProjectCreateConsumer> _logger;
        private readonly IDataGatewayDeploymentService _dataGetwayDeploymentService;
        public PostProjectCreateConsumer(ILogger<PostProjectCreateConsumer> logger, IDataGatewayDeploymentService dataGetwayDeploymentService)
        {
            _logger = logger;
            _dataGetwayDeploymentService = dataGetwayDeploymentService;
        }
        public async Task Consume(Tenant project)
        {
            try
            {
                _logger.LogInformation($"New project created : Name - {project.Name}, TenantId - {project.TenantId}, GroupId - {project.TenantGroupId}");

                await _dataGetwayDeploymentService.InitiateDataGatewayInstanceCreation(project);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Something went wrong {ex.Message}");

            }
        }
    }
}
