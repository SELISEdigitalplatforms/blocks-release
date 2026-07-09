namespace Devops.DomainService.Deployment.Models.Request;
public class BuildRequest
{
    public string repoName { get; set; }
    public string repoUrl { get; set; }
    public string branch { get; set; }
    public string deploymentUrl { get; set; }
    public string projectName { get; set; }
    public string hostingProviderId { get; set; }
    public string regionId { get; set; }
    public string machineConfigId { get; set; }
    public string deploymentType { get; set; }
}