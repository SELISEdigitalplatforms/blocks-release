using Blocks.Secrets;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.VersionControlSystems.TokenStore;

/// <summary>
/// Reads, writes and soft-deletes GitHub token values in Azure Key Vault through
/// <see cref="ISecretValueStore"/>. The store is resolved from the request's provider only when an
/// operation runs, and only a Key Vault store is accepted. Every failure surfaces as
/// <see cref="GithubTokenStoreException"/>. Logs carry the user id and secret id, never a token
/// or the message of a failed store operation; a failure to construct the store is logged in full.
/// </summary>
internal sealed class GithubTokenVault
{
    internal const string SecretIdPrefix = "github-token-";

    private readonly IServiceProvider? _serviceProvider;
    private readonly ILogger _logger;
    private readonly Func<object, bool> _isKeyVaultStore;

    public GithubTokenVault(IServiceProvider? serviceProvider, ILogger logger)
        : this(serviceProvider, logger, static store => store is KeyVaultSecretValueStore)
    {
    }

    internal GithubTokenVault(IServiceProvider? serviceProvider, ILogger logger, Func<object, bool> isKeyVaultStore)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _isKeyVaultStore = isKeyVaultStore;
    }

    /// <summary>A new secret id: <c>github-token-{32 lowercase hex}</c>.</summary>
    public static string NewSecretId() => SecretIdPrefix + Guid.NewGuid().ToString("N");

    public async Task SetAsync(string secretId, string value, string? blocksUserId)
    {
        var store = ResolveStore("set");
        try
        {
            await store.SetAsync(secretId, value, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex) when (IsStoreFailure(ex))
        {
            throw Unavailable("set", blocksUserId, secretId, ex);
        }
    }

    /// <summary>The stored token, or <c>null</c> when the vault has no value for the id (404).</summary>
    public async Task<string?> GetAsync(string secretId, string? blocksUserId)
    {
        var store = ResolveStore("get");
        try
        {
            var value = await store.GetAsync(secretId, CancellationToken.None).ConfigureAwait(false);
            if (value is null)
            {
                _logger.LogWarning("GitHub token value not found in the token store for BlocksUserId {BlocksUserId}, TokenSecretId {TokenSecretId}.", blocksUserId, secretId);
            }

            return value;
        }
        catch (Exception ex) when (IsStoreFailure(ex))
        {
            throw Unavailable("get", blocksUserId, secretId, ex);
        }
    }

    /// <summary>Soft-deletes the value. Never purges.</summary>
    public async Task DeleteAsync(string secretId, string? blocksUserId)
    {
        var store = ResolveStore("delete");
        try
        {
            await store.DeleteAsync(secretId, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex) when (IsStoreFailure(ex))
        {
            throw Unavailable("delete", blocksUserId, secretId, ex);
        }
    }

    private static bool IsStoreFailure(Exception ex) =>
        ex is SecretVaultException or OperationCanceledException or ArgumentException;

    private GithubTokenStoreException Unavailable(string operation, string? blocksUserId, string secretId, Exception ex)
    {
        // The store's exception is neither logged nor chained: its message is not ours to vouch for.
        _logger.LogError("GitHub token store {Operation} failed ({ErrorType}) for BlocksUserId {BlocksUserId}, TokenSecretId {TokenSecretId}.", operation, ex.GetType().Name, blocksUserId, secretId);
        return new GithubTokenStoreException(GithubTokenStoreException.DefaultMessage) { Operation = operation };
    }

    private ISecretValueStore ResolveStore(string operation)
    {
        object? resolved;
        try
        {
            resolved = _serviceProvider?.GetService(typeof(ISecretValueStore));
        }
        catch (Exception ex)
        {
            // For example Secrets__ValueStore=KeyVault without KeyVault__KeyVaultUrl.
            // No token is passed to the store while it is resolved, so this exception cannot carry one.
            _logger.LogError(ex, "GitHub token store could not be constructed for {Operation}. Set KeyVault__KeyVaultUrl and Secrets__ValueStore=KeyVault.", operation);
            throw new GithubTokenStoreException(GithubTokenStoreException.DefaultMessage) { Operation = operation };
        }

        if (resolved is not ISecretValueStore store || !_isKeyVaultStore(store))
        {
            _logger.LogError("The registered secret value store {StoreType} is not Azure Key Vault, so GitHub token {Operation} is refused. Set KeyVault__KeyVaultUrl and Secrets__ValueStore=KeyVault.", resolved?.GetType().Name ?? "(none)", operation);
            throw new GithubTokenStoreException(GithubTokenStoreException.DefaultMessage) { Operation = operation };
        }

        return store;
    }
}
