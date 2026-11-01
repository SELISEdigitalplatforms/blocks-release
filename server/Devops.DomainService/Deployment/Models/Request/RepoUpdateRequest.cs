using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Models.Dtos;

namespace Devops.DomainService.Deployment.Models.Request;

public class RepoUpdateRequest
{
    public string RepoId { get; set; }
    public string HostingProviderId { get; set; }
    public string RegionId { get; set; }
    public string MachineConfigId { get; set; }
    public string DeploymentType { get; set; }
    public string CustomDomain { get; set; }
    // Null leaves the stored value alone, so a caller that does not send it never resets it.
    public bool? IsCustomDomainOnly { get; set; }
    public DateTime? LastDeploymentDate { get; set; }
    public string LastDeploymentStatus { get; set; }
    public DeploySettings? deploySettings { get; set; }
}