namespace Devops.DomainService.Deployment.Interfaces
{
    public interface IDeploymentHubService
    {
        Task SendBuildLogAsync(object payload, IReadOnlyCollection<string>? userIds = null);
    }
}
