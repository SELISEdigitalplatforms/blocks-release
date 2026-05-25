using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Entities;

public class HostingProvider
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public List<Region>? Region { get; set; }

}

public class Region
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public List<MachineConfig>? MachineSpecs { get; set; }
}

public class MachineConfig
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string Ram { get; set; }
    public string CPU { get; set; }
    public string Bandwidth { get; set; }
    public string Status { get; set; }
}