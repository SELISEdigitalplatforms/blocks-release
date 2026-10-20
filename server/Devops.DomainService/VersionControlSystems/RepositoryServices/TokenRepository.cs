using Blocks.Genesis;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.TokenStore;
using Devops.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.VersionControlSystems.RepositoryServices;

/// <summary>
/// One <c>BlocksRootDb.RepositoryTokens</c> row per user. A row with a <c>TokenSecretId</c> is read
/// only from Key Vault (404 reads as no token); a row without one is a legacy row and its plaintext
/// <c>AccessToken</c> is used. Saves write the vault first and never persist <c>AccessToken</c>;
/// deletes remove the row, then soft-delete the vault value.
/// </summary>
public class 
    TokenRepository : ITokenRepository
{
    private const string CollectionName = "RepositoryTokens";

    private readonly ILogger<TokenRepository> _logger;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IMongoDatabase _clientDb;
    private readonly IBlocksSecret _blocksSecret;
    private readonly GithubTokenVault _vault;

    public TokenRepository(IDbContextProvider dbContextProvider, ILogger<TokenRepository> logger,  IBlocksSecret blocksSecret, IServiceProvider serviceProvider)
        : this(dbContextProvider, logger, blocksSecret, new GithubTokenVault(serviceProvider, logger))
    {
    }

    internal TokenRepository(IDbContextProvider dbContextProvider, ILogger<TokenRepository> logger, IBlocksSecret blocksSecret, GithubTokenVault vault)
    {
        _logger = logger;
        _dbContextProvider = dbContextProvider;
        _blocksSecret = blocksSecret;
        _vault = vault;
        _clientDb = ResolvedClientDb();
    }

    private IMongoDatabase ResolvedClientDb()
    {
        return _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, "BlocksRootDb");
    }

    private static string? ContextUserId() => BlocksContext.GetContext()?.UserId;

    /// <exception cref="GithubTokenStoreException">The vault could not be used; nothing was written to MongoDB.</exception>
    public async Task<bool> saveToken(RepositoryToken repositoryToken)
    {
        ArgumentNullException.ThrowIfNull(repositoryToken);
        var tokenValue = repositoryToken.AccessToken;
        if (string.IsNullOrEmpty(tokenValue))
        {
            throw new ArgumentException("A GitHub access token is required.", nameof(repositoryToken));
        }

        var blocksUserId = ContextUserId();
        if (string.IsNullOrEmpty(blocksUserId))
        {
            _logger.LogWarning("Token not saved: no user in context.");
            return false;
        }

        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);

        // The pointer comes from the user's stored row, never from the caller's object. It is reused
        // so a re-authorization adds a vault version - unless its value is gone (a soft-deleted name
        // cannot be set again until purged), in which case a new id is created.
        var stored = await FindByUserAsync(collection, blocksUserId).ConfigureAwait(false);
        var secretId = stored?.TokenSecretId;
        if (!string.IsNullOrEmpty(secretId)
            && await _vault.GetAsync(secretId, blocksUserId).ConfigureAwait(false) is null)
        {
            secretId = null;
        }

        var createdSecretId = string.IsNullOrEmpty(secretId);
        secretId = createdSecretId ? GithubTokenVault.NewSecretId() : secretId!;

        await _vault.SetAsync(secretId, tokenValue, blocksUserId).ConfigureAwait(false);

        var previousSecretId = repositoryToken.TokenSecretId;
        repositoryToken.BlocksUserId = blocksUserId;
        repositoryToken.TokenSecretId = secretId;
        repositoryToken.AccessToken = null!;
        bool saved;
        try
        {
            saved = await UpsertAsync(collection, blocksUserId, repositoryToken).ConfigureAwait(false);
        }
        finally
        {
            repositoryToken.AccessToken = tokenValue;
        }

        if (!saved)
        {
            repositoryToken.TokenSecretId = previousSecretId;
            if (createdSecretId)
            {
                await RemoveUnreferencedSecretAsync(blocksUserId, secretId).ConfigureAwait(false);
            }
        }

        return saved;
    }

    private async Task<bool> UpsertAsync(IMongoCollection<RepositoryToken> collection, string blocksUserId, RepositoryToken repositoryToken)
    {
        try
        {
            var filter = Builders<RepositoryToken>.Filter.Eq(x => x.BlocksUserId, blocksUserId);
            var options = new ReplaceOptions { IsUpsert = true };

            var result = await collection.ReplaceOneAsync(filter, repositoryToken, options);

            if (result.IsAcknowledged)
            {
                if (result.UpsertedId != null)
                {
                    _logger.LogInformation($"New token inserted for userid {blocksUserId}");
                }
                else if (result.ModifiedCount > 0)
                {
                    _logger.LogInformation($"Token updated for userid {blocksUserId}");
                }
                else
                {
                    _logger.LogInformation($"Token already up-to-date for userid {blocksUserId}");
                }
                return true;
            }

            _logger.LogWarning($"Upsert operation was not acknowledged for userid {blocksUserId}");
            return false;
        }
        catch (Exception ex)
        {
            // saveToken writes the row with AccessToken unset, so the write exception cannot carry the token.
            _logger.LogError(ex, "Failed to save token for userid {BlocksUserId}", blocksUserId);
            return false;
        }
    }

    private async Task RemoveUnreferencedSecretAsync(string blocksUserId, string secretId)
    {
        try
        {
            await _vault.DeleteAsync(secretId, blocksUserId).ConfigureAwait(false);
        }
        catch (GithubTokenStoreException ex)
        {
            _logger.LogError(ex, "Unreferenced GitHub token secret could not be removed. BlocksUserId {BlocksUserId}, TokenSecretId {TokenSecretId}.", blocksUserId, secretId);
        }
    }

    private static async Task<RepositoryToken?> FindByUserAsync(IMongoCollection<RepositoryToken> collection, string blocksUserId)
    {
        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);
        using var cursor = await collection.FindAsync(filter).ConfigureAwait(false);
        return await cursor.FirstOrDefaultAsync().ConfigureAwait(false);
    }

    /// <summary>Legacy rows use <c>AccessToken</c>; vault-format rows use only the vault value.</summary>
    private async Task ResolveAccessTokenAsync(RepositoryToken token)
    {
        if (!string.IsNullOrEmpty(token.TokenSecretId))
        {
            token.AccessToken = (await _vault.GetAsync(token.TokenSecretId, token.BlocksUserId).ConfigureAwait(false))!;
        }
    }

    public async Task<RepositoryToken> getToken()
    {
        var blocksUserId = ContextUserId();
        if (string.IsNullOrEmpty(blocksUserId))
        {
            return null!;
        }

        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);
        var token = await FindByUserAsync(collection, blocksUserId).ConfigureAwait(false);
        if (token == null)
        {
            _logger.LogWarning($"Token not found for userid {blocksUserId}");
            return null;
        }
        else
        {
            await ResolveAccessTokenAsync(token).ConfigureAwait(false);
            return token;
        }
    }

    public async Task<string> getToken(string userId)
    {
        var blocksUserId = userId;
        if (string.IsNullOrEmpty(blocksUserId))
        {
            return null!;
        }

        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);
        var token = await FindByUserAsync(collection, blocksUserId).ConfigureAwait(false);
        if (token == null)
        {
            _logger.LogWarning($"Token not found for userid {blocksUserId}");
            return null;
        }
        else
        {
            await ResolveAccessTokenAsync(token).ConfigureAwait(false);
            return token.AccessToken;
        }
    }
    
    public async Task<List<RepositoryToken>> getTokens()
    {
        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);
        return await collection.Find(_ => true).ToListAsync();
    }
    
    public async Task UpdateUsernameAsync(string id, List<UserOrganizations> orgs)
    {
        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);
    
        var filter = Builders<RepositoryToken>.Filter.Eq(x => x.ItemId, id);
        var update = Builders<RepositoryToken>.Update.Set(x => x.Organizations, orgs);
    
        await collection.UpdateOneAsync(filter, update);
    }

    

    public Task<bool> DeleteTokenAsync()
    {
        return DeleteTokenAsync(ContextUserId()!);
    }

    /// <summary>
    /// Deletes the row, then soft-deletes its vault value. A vault failure is logged and does not
    /// fail the call.
    /// </summary>
    public async Task<bool> DeleteTokenAsync(string blocksUserId)
    {
        if (string.IsNullOrEmpty(blocksUserId))
        {
            return false;
        }

        var collection = _clientDb.GetCollection<RepositoryToken>(CollectionName);

        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);

        var deleted = await collection.FindOneAndDeleteAsync(filter).ConfigureAwait(false);
        if (deleted is null)
        {
            return false;
        }

        if (!string.IsNullOrEmpty(deleted.TokenSecretId))
        {
            try
            {
                await _vault.DeleteAsync(deleted.TokenSecretId, blocksUserId).ConfigureAwait(false);
            }
            catch (GithubTokenStoreException ex)
            {
                _logger.LogError(ex, "GitHub token row was deleted but its vault value could not be soft-deleted. BlocksUserId {BlocksUserId}, TokenSecretId {TokenSecretId}.", blocksUserId, deleted.TokenSecretId);
            }
        }

        return true;
    }

    public async Task<User> GetUserByIdAsync(string itemId)
    {
        var collection = _clientDb.GetCollection<User>("Users");

        return await collection.Find(x => x.ItemId == itemId).FirstOrDefaultAsync();
    }

}