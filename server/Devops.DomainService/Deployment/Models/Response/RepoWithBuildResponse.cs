using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

public class RepoWithBuildResponse : BaseApiResponse
{
    public List<Build> Build { get; set; } = new();
    public Repo Repo { get; set; } = new();

}