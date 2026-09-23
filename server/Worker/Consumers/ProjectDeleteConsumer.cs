using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Models;

namespace Worker.Consumers
{
    /// <summary>
    /// Consumes <c>blocks_release_project_delete_listener</c>. The delete itself happens in blocks-os;
    /// what follows here is settling this service's own repositories and deployments. The work is
    /// delegated to a scoped service because it reaches into per-tenant databases and this consumer
    /// is a singleton.
    /// </summary>
    public class ProjectDeleteConsumer : IConsumer<ProjectDeleteQueue>
    {
        private readonly ILogger<ProjectDeleteConsumer> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public ProjectDeleteConsumer(ILogger<ProjectDeleteConsumer> logger, IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public async Task Consume(ProjectDeleteQueue message)
        {
            try
            {
                _logger.LogInformation(
                    "Received project delete message. group={TenantGroupId} project={ProjectId} resource={ResourceId}",
                    message?.TenantGroupId, message?.ProjectId, message?.ResourceId);

                using var scope = _scopeFactory.CreateScope();
                var deploymentTeardownService = scope.ServiceProvider.GetRequiredService<IDeploymentTeardownService>();

                var summary = await deploymentTeardownService.TearDownAsync(message);

                if (summary.HasFailures)
                {
                    _logger.LogWarning(
                        "Deployment teardown requires replay after {FailureCount} failure(s): {Failures}",
                        summary.Failures.Count, string.Join(" | ", summary.Failures));
                    // Genesis dead-letters failed deliveries. A completed delivery would lose
                    // the failed tenant; settled repositories are safe to skip on replay.
                    throw new InvalidOperationException("Deployment teardown did not complete for every project.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to process project delete message. group={TenantGroupId} project={ProjectId} resource={ResourceId}",
                    message?.TenantGroupId, message?.ProjectId, message?.ResourceId);
                throw;
            }
        }
    }
}
