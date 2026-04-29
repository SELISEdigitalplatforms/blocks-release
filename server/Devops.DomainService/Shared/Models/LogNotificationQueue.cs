using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Shared.Models
{
    public class LogNotificationQueue
    {
        public BuildEventResponse Message { get; set; }
        public string UserId { get; set; }
        public List<string> UserIds { get; set; }
        public string TenantId { get; set; }
        public string RepoId { get; set; }
        public string BuildStatus { get; set; }
    }
}
