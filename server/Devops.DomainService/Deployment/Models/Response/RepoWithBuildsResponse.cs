using Devops.DomainService.Deployment.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

public class RepoWithBuildsResponse : Repo
{
    public List<Build> Builds { get; set; } = new();
}