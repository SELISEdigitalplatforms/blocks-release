using MongoDB.Bson.Serialization.Attributes;
using Blocks.Genesis;

namespace Devops.DomainService.VersionControlSystems.Entities;
[BsonIgnoreExtraElements]
public class RepositoryToken : BaseEntity
{
    public string AccessToken { get; set; }
    public string Source { get; set; }
    public string Scope { get; set; }
    public string TokenType { get; set; }
    public string UserName { get; set; }
    public string BlocksUserId { get; set; }
    public List<UserOrganizations> Organizations { get; set; }
}

public class UserOrganizations
{
    public string OrgId { get; set; }
    public string OrgNodeId { get; set; }
    public string OrgUserName { get; set; }
    public string OrgDescription { get; set; }
    public string AvatarUrl { get; set; }
}