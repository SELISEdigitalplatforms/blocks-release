using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Interfaces
{
    public interface INotificationService
    {
        Task<bool> NotifyPipeLineLogData(BuildEventResponse logData, List<string> UserId, string TenantId, string RepoId, string BuildStatus);
        Task<bool> NotifyPipeLineLogData(List<BuildEventResponse> logData, List<string> UserId, string TenantId, string RepoId, string BuildStatus);

        /// <summary>
        /// Best-effort send of a built-in notification configuration to users of one tenant.
        /// Never throws; returns whether the Notifier accepted it.
        /// </summary>
        Task<bool> SendBuiltInAsync(string tenantId, string configurationName, IEnumerable<string?> userIds, IDictionary<string, object?> payload);
    }
}
