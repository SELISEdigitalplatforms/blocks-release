using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Interfaces
{
    /// <summary>
    /// Updates and deletes heartbeat (InboundPing) monitors for the release UI. Replaces the calls the
    /// release client used to make to blocks-logic's HealthController, applying the same rules as
    /// blocks-monitor's HealthConfigurationService.
    /// </summary>
    public interface IHeartbeatConfigurationService
    {
        Task<BaseApiResponse> UpdateAsync(UpdateHealthRequest request);

        Task<BaseApiResponse> DeleteAsync(string itemId);
    }
}
