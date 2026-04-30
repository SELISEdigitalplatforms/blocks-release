using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Interfaces
{
    public interface INotificationService
    {
        Task<bool> NotifyPipeLineLogData(BuildEventResponse logData, List<string> UserId, string TenantId, string RepoId, string BuildStatus);
        Task<bool> NotifyPipeLineLogData(List<BuildEventResponse> logData, List<string> UserId, string TenantId, string RepoId, string BuildStatus);
    }
}
