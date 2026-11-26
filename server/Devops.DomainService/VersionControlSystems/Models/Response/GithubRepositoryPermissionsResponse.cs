using System.Text.Json.Serialization;

namespace Devops.DomainService.VersionControlSystems.Models.Response;

/// <summary>
/// The part of GitHub's "get a repository" answer that explains a refused webhook call: what the token's user
/// may do on the repository. GitHub has no flag for a custom role's "Manage webhooks" permission, so this is
/// only ever read after GitHub has refused, never to refuse up front.
/// </summary>
public class GithubRepositoryPermissionsResponse
{
    [JsonPropertyName("permissions")]
    public GithubRepositoryPermissions? Permissions { get; set; }
}

public class GithubRepositoryPermissions
{
    [JsonPropertyName("admin")]
    public bool Admin { get; set; }
}
