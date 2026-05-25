using Blocks.Genesis;

namespace Devops.DomainService.Deployment.Models.Request
{
    public class RepoDomainUpdateRequest: IProjectKey
    {
        public string ProjectKey { get; set; }
        public string ProjectEnv { get; set; }
        public List<RepoWithDomain> repoWithDomains {  get; set; }
    }

    public class RepoWithDomain
    {
        public string RepoId { get; set; }
        public string RepoUrl { get; set; }
        public string CustomDeploymentDomain { get; set; }
    }
}
