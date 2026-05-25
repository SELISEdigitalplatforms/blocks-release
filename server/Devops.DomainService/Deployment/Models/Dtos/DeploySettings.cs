using Devops.DomainService.Deployment.Entities;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Models.Dtos;

[BsonIgnoreExtraElements]
public class DeploySettings
{
    public HostingProvider HostingProvider { get; set; }
    public Region Region { get; set; }
    public MachineConfig MachineConfig { get; set; }
}

public class RepoDeploymentType
{
    public static readonly string Manual = "Manual";
    public static readonly string Auto = "Auto";
}
