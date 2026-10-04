using Devops.DomainService.Deployment.Entities;

namespace Devops.DomainService.Deployment.Interfaces
{
    public interface IMonitorProvisioningService
    {
        /// <summary>
        /// Creates a Blocks Monitor uptime monitor for a freshly deployed repository.
        /// </summary>
        /// <returns>Null on success (or when the repository already has a monitor), otherwise the failure reason.</returns>
        Task<string?> CreateMonitorForRepoAsync(Repo repo);
    }
}
