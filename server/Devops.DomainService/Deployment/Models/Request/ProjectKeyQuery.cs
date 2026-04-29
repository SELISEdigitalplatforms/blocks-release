using Blocks.Genesis;

namespace Devops.DomainService.Deployment.Models.Request
{
    public class ProjectKeyQuery : IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
