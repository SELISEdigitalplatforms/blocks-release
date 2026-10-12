using MongoDB.Bson.Serialization.Attributes;
using Blocks.Genesis;

namespace Devops.DomainService.VersionControlSystems.Entities;
[BsonIgnoreExtraElements]
public class RepositoryToken : BaseEntity
{
    /// <summary>
    /// Legacy plaintext token. New and renewed saves never persist it (the value lives in the
    /// secret store under <see cref="TokenSecretId"/>); it is only read for rows whose
    /// <see cref="TokenSecretId"/> is null. In memory it carries the resolved token value.
    /// </summary>
    [BsonIgnoreIfNull]
    public string AccessToken { get; set; }

    /// <summary>
    /// Pointer to the token value in the secret store (<c>github-token-{32 hex}</c>). Not a secret.
    /// Null or missing marks a legacy plaintext row.
    /// </summary>
    [BsonIgnoreIfNull]
    public string? TokenSecretId { get; set; }

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