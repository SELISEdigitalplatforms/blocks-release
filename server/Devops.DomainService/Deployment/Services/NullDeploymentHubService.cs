using Devops.DomainService.Deployment.Interfaces;

namespace Devops.DomainService.Deployment.Services
{
    public class NullDeploymentHubService : IDeploymentHubService
    {
        public Task SendBuildLogAsync(object payload, IReadOnlyCollection<string>? userIds = null) => Task.CompletedTask;
    }
}
