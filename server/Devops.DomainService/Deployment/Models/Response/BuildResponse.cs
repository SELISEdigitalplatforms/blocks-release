using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

public class BuildResponse : BaseApiResponse
{
    public string buildId { get; set; }
    // Set when the build started but the requested Blocks Monitor entry could not be created.
    public string? monitorError { get; set; }
}