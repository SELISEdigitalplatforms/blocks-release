using System.Text.Json.Serialization;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

public class BuildResponse : BaseApiResponse
{
    public string buildId { get; set; }
    // Set when the build started but the requested Blocks Monitor entry could not be created.
    public string? monitorError { get; set; }
    // Set when the deploy went through but the GitHub webhook is not in the state its mode asks for.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DeploymentWarning? Warning { get; set; }
}