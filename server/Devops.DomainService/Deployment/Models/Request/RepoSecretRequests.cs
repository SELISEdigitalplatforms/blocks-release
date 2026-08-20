using System.Text.Json;

namespace Devops.DomainService.Deployment.Models.Request;

/// <summary>
/// Saves the complete secret set for one repository.
/// </summary>
/// <remarks>
/// There is deliberately no secret id here. Every id is resolved from the repository document,
/// so a caller cannot reach another repository's - or another tenant's - secret by supplying one.
/// </remarks>
public sealed class RepoSecretSaveRequest
{
    public string RepoId { get; set; }

    /// <summary>
    /// The whole set, replacing whatever is stored. Flat, string to string.
    /// </summary>
    /// <remarks>
    /// Kept as a raw <see cref="JsonElement"/> rather than a dictionary so the service can tell a
    /// caller exactly which key was wrong. Binding to a dictionary would collapse a nested or
    /// numeric value into a generic model-binding 400 and would quietly drop a duplicated key.
    /// </remarks>
    public JsonElement Secrets { get; set; }
}

/// <summary>Identifies one repository. Used by the lifecycle endpoints.</summary>
public sealed class RepoSecretIdRequest
{
    public string RepoId { get; set; }
}
