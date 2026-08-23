using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Interfaces;

/// <summary>
/// Repository-scoped view over the secret store.
/// </summary>
/// <remarks>
/// <para>
/// Every method takes a repository id and resolves the secret id from the repository document.
/// No method accepts a secret id from a caller - that is what keeps one tenant's console from
/// reaching another tenant's secret by guessing an id, and it is the reason this service exists
/// rather than exposing <c>ISecretService</c> directly.
/// </para>
/// <para>
/// A repository owns at most one secret, whose value is the whole key/value set serialized as a
/// JSON object. There is no partial update: a save replaces the set.
/// </para>
/// </remarks>
public interface IRepoSecretService
{
    /// <summary>
    /// Creates or replaces the repository's secret set and stamps the id onto the repository.
    /// </summary>
    Task<RepoSecretSaveResponse> SaveAsync(RepoSecretSaveRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Metadata only. Returns <c>HasSecrets = false</c> - not an error - when the repository has
    /// never had secrets saved.
    /// </summary>
    Task<RepoSecretMetaResponse> GetMetaAsync(string repoId, CancellationToken cancellationToken = default);

    /// <summary>Reads the plaintext set. Audited server-side on every call.</summary>
    Task<RepoSecretValueResponse> GetValueAsync(string repoId, CancellationToken cancellationToken = default);

    Task LockAsync(string repoId, CancellationToken cancellationToken = default);

    Task UnlockAsync(string repoId, CancellationToken cancellationToken = default);

    /// <summary>Soft-deletes. The vault value is retained so <see cref="RestoreAsync"/> works.</summary>
    Task DeleteAsync(string repoId, CancellationToken cancellationToken = default);

    Task RestoreAsync(string repoId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Audit trail for this repository's secret. The filter's secret id is always overwritten
    /// with the repository's own.
    /// </summary>
    Task<Blocks.Secrets.SecretAuditListResult> GetAuditLogsAsync(
        string repoId,
        Blocks.Secrets.SecretAuditFilter filter,
        CancellationToken cancellationToken = default);
}
