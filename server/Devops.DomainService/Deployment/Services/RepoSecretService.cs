using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services;

/// <summary>
/// Repository-scoped facade over <see cref="ISecretService"/>.
/// </summary>
/// <remarks>
/// <para>
/// Two rules shape everything here. First, a secret id is <b>never</b> taken from a caller - it is
/// read from the repository document, so the only secrets reachable through this service are the
/// ones belonging to repositories the caller's tenant can already see. Second, the value written to
/// the vault is the whole set serialized as one JSON object, so a save is a single atomic write and
/// there is exactly one vault object per repository to reason about.
/// </para>
/// <para>
/// Validation lives here rather than in the controller because the same rules must hold for any
/// future caller - a worker, a migration - that never goes through HTTP. The failures are raised as
/// <see cref="SecretValidationException"/> so the package's <c>SecretExceptionFilter</c> renders
/// them in the same envelope as the package's own errors.
/// </para>
/// </remarks>
public sealed partial class RepoSecretService : IRepoSecretService
{
    private const int MaxKeyLength = 128;
    private const int MaxDescriptionLength = 1000;

    /// <summary>
    /// Allowed secret keys. The POSIX environment-variable rule, so a set can be projected onto
    /// container environment variables or a Kubernetes secret without a mangling step.
    /// </summary>
    /// <remarks>
    /// Distinct from the package's rule on the secret <i>name</i>: that governs the single
    /// "repo-{id}" name, this governs the keys inside the value.
    /// </remarks>
    [GeneratedRegex("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    private readonly IRepoRepository _repoRepository;
    private readonly ISecretService _secretService;
    private readonly ILogger<RepoSecretService> _logger;

    public RepoSecretService(
        IRepoRepository repoRepository,
        ISecretService secretService,
        ILogger<RepoSecretService> logger)
    {
        _repoRepository = repoRepository;
        _secretService = secretService;
        _logger = logger;
    }

    public async Task<RepoSecretSaveResponse> SaveAsync(RepoSecretSaveRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        // Payload first, repository second: a malformed set is rejected without a database read,
        // and no ISecretService method is reached at all.
        var repoId = RequireRepoId(request.RepoId);
        var secrets = ReadSecretSet(request.Secrets);
        var payload = SerializeAndMeasure(secrets);

        var repo = await LoadRepoAsync(repoId).ConfigureAwait(false);

        return string.IsNullOrWhiteSpace(repo.SecretStoreItemId)
            ? await CreateAsync(repo, payload, secrets.Count, cancellationToken).ConfigureAwait(false)
            : await ReplaceAsync(repo, payload, secrets.Count, cancellationToken).ConfigureAwait(false);
    }

    public async Task<RepoSecretMetaResponse> GetMetaAsync(string repoId, CancellationToken cancellationToken = default)
    {
        var repo = await LoadRepoAsync(RequireRepoId(repoId)).ConfigureAwait(false);

        // A repository with no secret is a legitimate, common state - the first-run one - not a
        // 404. The UI renders its empty state from this.
        if (string.IsNullOrWhiteSpace(repo.SecretStoreItemId))
        {
            return new RepoSecretMetaResponse { RepoId = repo.ItemId, HasSecrets = false };
        }

        var secret = await _secretService.GetAsync(repo.SecretStoreItemId, cancellationToken).ConfigureAwait(false);

        // The repository points at a secret the store no longer has. Report it as "no secrets"
        // rather than failing the whole screen: the pointer is stale, which a later save fixes.
        if (secret is null)
        {
            _logger.LogWarning(
                "Repository {RepoId} points at secret {SecretId}, which is not in the secret store.",
                repo.ItemId, repo.SecretStoreItemId);

            return new RepoSecretMetaResponse { RepoId = repo.ItemId, HasSecrets = false };
        }

        return new RepoSecretMetaResponse
        {
            RepoId = repo.ItemId,
            SecretId = secret.SecretId,
            HasSecrets = true,
            Name = secret.Name,
            Description = secret.Description,
            Status = secret.Status,
            CreatedDate = secret.CreatedDate,
            CreatedBy = secret.CreatedBy,
            LastUpdatedDate = secret.LastUpdatedDate,
            LastUpdatedBy = secret.LastUpdatedBy,
            LastRotatedDate = secret.LastRotatedDate,
            LastRotatedBy = secret.LastRotatedBy,
            RotationCount = secret.RotationCount,
            DeletedDate = secret.DeletedDate,
            DeletedBy = secret.DeletedBy
        };
    }

    public async Task<RepoSecretValueResponse> GetValueAsync(string repoId, CancellationToken cancellationToken = default)
    {
        var repo = await LoadRepoAsync(RequireRepoId(repoId)).ConfigureAwait(false);
        var secretId = RequireSecretId(repo);

        var raw = await _secretService.GetValueAsync(secretId, cancellationToken).ConfigureAwait(false);

        return new RepoSecretValueResponse
        {
            RepoId = repo.ItemId,
            SecretId = secretId,
            Secrets = Deserialize(raw, repo.ItemId)
        };
    }

    public async Task LockAsync(string repoId, CancellationToken cancellationToken = default) =>
        await _secretService.LockAsync(await ResolveSecretIdAsync(repoId).ConfigureAwait(false), cancellationToken).ConfigureAwait(false);

    public async Task UnlockAsync(string repoId, CancellationToken cancellationToken = default) =>
        await _secretService.UnlockAsync(await ResolveSecretIdAsync(repoId).ConfigureAwait(false), cancellationToken).ConfigureAwait(false);

    /// <remarks>
    /// The repository keeps pointing at the deleted secret on purpose. The package's delete is
    /// metadata-only so that a restore can bring the value back; clearing the pointer here would
    /// strand a secret that is still restorable.
    /// </remarks>
    public async Task DeleteAsync(string repoId, CancellationToken cancellationToken = default) =>
        await _secretService.DeleteAsync(await ResolveSecretIdAsync(repoId).ConfigureAwait(false), cancellationToken).ConfigureAwait(false);

    public async Task RestoreAsync(string repoId, CancellationToken cancellationToken = default) =>
        await _secretService.RestoreAsync(await ResolveSecretIdAsync(repoId).ConfigureAwait(false), cancellationToken).ConfigureAwait(false);

    public async Task<SecretAuditListResult> GetAuditLogsAsync(
        string repoId,
        SecretAuditFilter filter,
        CancellationToken cancellationToken = default)
    {
        var secretId = await ResolveSecretIdAsync(repoId).ConfigureAwait(false);

        filter ??= new SecretAuditFilter();

        // Overwritten, not defaulted: a caller that supplies a secret id must not be able to read
        // another repository's audit trail through this endpoint.
        filter.SecretId = secretId;

        return await _secretService.GetAuditLogsAsync(filter, cancellationToken).ConfigureAwait(false);
    }

    #region Write paths

    private async Task<RepoSecretSaveResponse> CreateAsync(
        Repo repo,
        string payload,
        int keyCount,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId();

        var secretId = await _secretService.SetAsync(
            new SetSecretRequest
            {
                Name = SecretNameFor(repo.ItemId),
                Description = Truncate(repo.RepoName, MaxDescriptionLength),
                Value = payload,
                // Service, not Api: these are consumed by the platform on the repository's behalf
                // and have no per-user access list. An Api-type secret would be readable only by
                // its creator, which is the wrong model for a shared deployment credential.
                Type = SecretTypes.Service
            },
            cancellationToken).ConfigureAwait(false);

        try
        {
            var stamped = await _repoRepository
                .UpdateRepoSecretStoreItemId(repo.ItemId, secretId, tenantId)
                .ConfigureAwait(false);

            if (!stamped)
            {
                throw new InvalidOperationException(
                    $"The secret reference could not be written to repository '{repo.ItemId}'.");
            }
        }
        catch (Exception ex)
        {
            // The value is in the vault but nothing points at it. Undo the create rather than
            // leave a secret no repository references and no one can find.
            await CompensateAsync(secretId, repo.ItemId, ex).ConfigureAwait(false);
            throw;
        }

        return new RepoSecretSaveResponse
        {
            RepoId = repo.ItemId,
            SecretId = secretId,
            KeyCount = keyCount,
            Created = true
        };
    }

    private async Task<RepoSecretSaveResponse> ReplaceAsync(
        Repo repo,
        string payload,
        int keyCount,
        CancellationToken cancellationToken)
    {
        await _secretService
            .RotateAsync(repo.SecretStoreItemId, new RotateSecretRequest { Value = payload }, cancellationToken)
            .ConfigureAwait(false);

        return new RepoSecretSaveResponse
        {
            RepoId = repo.ItemId,
            SecretId = repo.SecretStoreItemId,
            KeyCount = keyCount,
            Created = false
        };
    }

    private async Task CompensateAsync(string secretId, string repoId, Exception cause)
    {
        try
        {
            await _secretService.DeleteAsync(secretId, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception cleanupFailure)
        {
            // Both halves failed. Log the id explicitly - it is the only remaining handle on an
            // orphaned secret, and reconciliation is manual from here.
            _logger.LogError(
                cleanupFailure,
                "Orphaned secret {SecretId} for repository {RepoId}: the reference could not be stored and the compensating delete also failed.",
                secretId, repoId);

            return;
        }

        _logger.LogError(
            cause,
            "Rolled back secret {SecretId} for repository {RepoId}: the reference could not be stored.",
            secretId, repoId);
    }

    #endregion

    #region Loading

    private async Task<string> ResolveSecretIdAsync(string repoId)
    {
        var repo = await LoadRepoAsync(RequireRepoId(repoId)).ConfigureAwait(false);
        return RequireSecretId(repo);
    }

    /// <remarks>
    /// <para>
    /// The tenant is passed explicitly, and it is the same one <see cref="RequireTenantId"/>
    /// gives the write path and the secret itself. The parameterless <c>GetRepo</c> overload
    /// cannot be used here: it resolves the database from the request (Genesis reads the tenant
    /// off the x-blocks-key header), while the secret and the SecretStoreItemId stamp are keyed
    /// on the context tenant from the token. Under impersonation those are two different ids -
    /// the console sends the root key while the token carries the project being impersonated -
    /// so the repository would be read from one database and stamped in another. The pointer
    /// then reads back as absent, every save retries CreateAsync and fails NAME_TAKEN against
    /// the secret it already owns, and GetMetaAsync reports HasSecrets false for a repository
    /// whose secret is sitting there active.
    /// </para>
    /// <para>
    /// The overload still excludes archived repositories, so absent, archived and
    /// belonging-to-another-tenant all collapse into the same 404. That uniformity is
    /// deliberate: distinguishing them would confirm which repository ids exist elsewhere.
    /// </para>
    /// </remarks>
    private async Task<Repo> LoadRepoAsync(string repoId)
    {
        var repo = await _repoRepository
            .GetRepo(repoId, RequireTenantId())
            .ConfigureAwait(false);

        return repo ?? throw new SecretNotFoundException(repoId);
    }

    private static string RequireSecretId(Repo repo) =>
        string.IsNullOrWhiteSpace(repo.SecretStoreItemId)
            ? throw new SecretNotFoundException(repo.ItemId, "NO_SECRET_FOR_REPO")
            : repo.SecretStoreItemId;

    private static string RequireRepoId(string repoId) =>
        string.IsNullOrWhiteSpace(repoId)
            ? throw new SecretValidationException("A repository id is required.", "REPO_ID_REQUIRED")
            : repoId;

    private static string RequireTenantId()
    {
        var tenantId = BlocksContext.GetContext()?.TenantId;

        // The package would have refused an unauthenticated context before this point; this guard
        // covers the narrower case of a context that carries no tenant, where the repository write
        // would otherwise target whichever database the provider defaulted to.
        return string.IsNullOrWhiteSpace(tenantId)
            ? throw new SecretAccessDeniedException(SecretAuditReasons.InvalidContext,
                "The request context carries no tenant, so the secret reference cannot be stored.")
            : tenantId;
    }

    #endregion

    #region Payload

    internal static string SecretNameFor(string repoId) => $"repo-{repoId}";

    /// <summary>
    /// Reads the incoming object into a validated map.
    /// </summary>
    /// <remarks>
    /// Bound as a <see cref="JsonElement"/> rather than a <c>Dictionary&lt;string, string&gt;</c> on
    /// purpose. A dictionary binding would turn a nested or numeric value into a model-binding
    /// failure - a generic 400 that says nothing about which key was wrong - and would silently
    /// keep the last of two identical keys. Walking the element keeps both cases as explicit,
    /// named errors.
    /// </remarks>
    private static Dictionary<string, string> ReadSecretSet(JsonElement element)
    {
        if (element.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            throw new SecretValidationException("A secret set is required.", "SECRETS_REQUIRED");
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new SecretValidationException("The secret set must be a JSON object.", "SECRETS_REQUIRED");
        }

        var secrets = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var property in element.EnumerateObject())
        {
            ValidateKey(property.Name);

            if (property.Value.ValueKind != JsonValueKind.String)
            {
                throw new SecretValidationException(
                    $"Secret value for key '{property.Name}' must be a string.", "SECRET_VALUE_TYPE");
            }

            // EnumerateObject yields every occurrence, so a repeated key is visible here. Silently
            // keeping the last one would let someone believe both had been stored.
            if (!secrets.TryAdd(property.Name, property.Value.GetString() ?? string.Empty))
            {
                throw new SecretValidationException(
                    $"Secret key '{property.Name}' appears more than once.", "SECRET_KEY_INVALID");
            }
        }

        if (secrets.Count == 0)
        {
            // Clearing the set is a delete, which has its own lifecycle and audit action. Storing
            // "{}" would leave "does this repository have secrets?" ambiguous.
            throw new SecretValidationException(
                "A secret set must contain at least one key. Use delete to remove the set.", "SECRETS_REQUIRED");
        }

        return secrets;
    }

    private static void ValidateKey(string key)
    {
        if (string.IsNullOrEmpty(key) || key.Length > MaxKeyLength || !KeyPattern().IsMatch(key))
        {
            throw new SecretValidationException(
                $"Secret key '{key}' is invalid. Start with a letter or underscore; letters, digits and underscore only, at most {MaxKeyLength} characters.",
                "SECRET_KEY_INVALID");
        }
    }

    private static string SerializeAndMeasure(Dictionary<string, string> secrets)
    {
        var payload = JsonSerializer.Serialize(secrets);

        // Measured in bytes, not characters: Key Vault caps the encoded payload, so a character
        // count would let a multi-byte set through and fail at the vault instead of here.
        var byteCount = Encoding.UTF8.GetByteCount(payload);

        if (byteCount > SecretDefaults.MaxValueLengthBytes)
        {
            throw new SecretValidationException(
                $"The secret set is {byteCount} bytes; the maximum is {SecretDefaults.MaxValueLengthBytes}.",
                "SECRET_SET_TOO_LARGE");
        }

        return payload;
    }

    private Dictionary<string, string> Deserialize(string raw, string repoId)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(raw)
                   ?? new Dictionary<string, string>(StringComparer.Ordinal);
        }
        catch (JsonException ex)
        {
            // Only reachable if something wrote this secret out of band, in a shape this API never
            // produces. Surfaced as a validation failure so the caller gets the standard envelope
            // rather than an unhandled 500, with the real cause in the log.
            _logger.LogError(ex, "The stored secret set for repository {RepoId} is not a JSON object.", repoId);

            throw new SecretValidationException(
                "The stored secret set could not be read.", "SECRET_SET_UNREADABLE");
        }
    }

    private static string Truncate(string value, int maxLength) =>
        string.IsNullOrEmpty(value) || value.Length <= maxLength ? value : value[..maxLength];

    #endregion
}
