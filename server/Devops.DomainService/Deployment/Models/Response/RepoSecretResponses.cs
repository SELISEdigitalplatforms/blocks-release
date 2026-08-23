namespace Devops.DomainService.Deployment.Models.Response;

/// <summary>Result of a save. Carries the id and a count, never a value or a key name.</summary>
public sealed class RepoSecretSaveResponse
{
    public string RepoId { get; set; }

    public string SecretId { get; set; }

    public int KeyCount { get; set; }

    /// <summary>True when this save created the secret; false when it replaced an existing one.</summary>
    public bool Created { get; set; }
}

/// <summary>
/// Metadata view of a repository's secret.
/// </summary>
/// <remarks>
/// Carries no key names by design: the keys live inside the vault value, so listing them would
/// mean an unaudited plaintext read on what is meant to be a cheap metadata call. A UI shows the
/// status and offers a deliberate reveal instead.
/// </remarks>
public sealed class RepoSecretMetaResponse
{
    public string RepoId { get; set; }

    public string SecretId { get; set; }

    /// <summary>False when the repository has never had secrets saved. Not an error.</summary>
    public bool HasSecrets { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Status { get; set; }

    public DateTime? CreatedDate { get; set; }

    public string CreatedBy { get; set; }

    public DateTime? LastUpdatedDate { get; set; }

    public string LastUpdatedBy { get; set; }

    public DateTime? LastRotatedDate { get; set; }

    public string LastRotatedBy { get; set; }

    public int RotationCount { get; set; }

    public DateTime? DeletedDate { get; set; }

    public string DeletedBy { get; set; }
}

/// <summary>
/// The only response type here that carries plaintext. Its endpoint sets no-store.
/// </summary>
public sealed class RepoSecretValueResponse
{
    public string RepoId { get; set; }

    public string SecretId { get; set; }

    public Dictionary<string, string> Secrets { get; set; }
}
