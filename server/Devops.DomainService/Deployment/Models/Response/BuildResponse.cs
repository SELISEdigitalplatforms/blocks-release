using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

public class BuildResponse : BaseApiResponse
{
    public string buildId { get; set; }
}