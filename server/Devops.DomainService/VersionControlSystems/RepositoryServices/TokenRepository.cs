using Blocks.Genesis;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.VersionControlSystems.RepositoryServices;

public class 
    TokenRepository : ITokenRepository
{
    private readonly ILogger<TokenRepository> _logger;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IMongoDatabase _clientDb;
    private readonly IBlocksSecret _blocksSecret;

    public TokenRepository(IDbContextProvider dbContextProvider, ILogger<TokenRepository> logger,  IBlocksSecret blocksSecret)
    {
        _logger = logger;
        _dbContextProvider = dbContextProvider;
        _blocksSecret = blocksSecret;
        _clientDb = ResolvedClientDb();
    }

    private IMongoDatabase ResolvedClientDb()
    {
        return _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, "BlocksRootDb");
    }
    public async Task<bool> saveToken(RepositoryToken repositoryToken)
    {
        try
        {
            var blocksUserId = BlocksContext.GetContext().UserId;
            var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");

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
            _logger.LogError($"Failed to save token: {ex.Message}");
            return false;
        }
    }

    public async Task<RepositoryToken> getToken()
    {
        var blocksUserId = BlocksContext.GetContext().UserId;
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");
        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);
        var dbToken = await collection.FindAsync(filter);
        var token = dbToken.FirstOrDefault();
        if (token == null)
        {
            _logger.LogWarning($"Token not found for userid {blocksUserId}");
            return null;
        }
        else
        {
            return token;
        }
    }

    public async Task<string> getToken(string userId)
    {
        var blocksUserId = userId;
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");
        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);
        var dbToken = await collection.FindAsync(filter);
        var token = dbToken.FirstOrDefault();
        if (token == null)
        {
            _logger.LogWarning($"Token not found for userid {blocksUserId}");
            return null;
        }
        else
        {
            return token.AccessToken;
        }
    }
    
    public async Task<List<RepositoryToken>> getTokens()
    {
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");
        return await collection.Find(_ => true).ToListAsync();
    }
    
    public async Task UpdateUsernameAsync(string id, List<UserOrganizations> orgs)
    {
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");
    
        var filter = Builders<RepositoryToken>.Filter.Eq(x => x.ItemId, id);
        var update = Builders<RepositoryToken>.Update.Set(x => x.Organizations, orgs);
    
        await collection.UpdateOneAsync(filter, update);
    }

    

    public async Task<bool> DeleteTokenAsync()
    {
        var blocksUserId = BlocksContext.GetContext().UserId;
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");

        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);

        var deleteResult = await collection.DeleteOneAsync(filter);

        return deleteResult.DeletedCount > 0;
    }

    public async Task<bool> DeleteTokenAsync(string blocksUserId)
    {
        var collection = _clientDb.GetCollection<RepositoryToken>("RepositoryTokens");

        var filter = Builders<RepositoryToken>.Filter.Eq(nameof(RepositoryToken.BlocksUserId), blocksUserId);

        var deleteResult = await collection.DeleteOneAsync(filter);

        return deleteResult.DeletedCount > 0;
    }

    public async Task<User> GetUserByIdAsync(string itemId)
    {
        var collection = _clientDb.GetCollection<User>("Users");

        return await collection.Find(x => x.ItemId == itemId).FirstOrDefaultAsync();
    }

}