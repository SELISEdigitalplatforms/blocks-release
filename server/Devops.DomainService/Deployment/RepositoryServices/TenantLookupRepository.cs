using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.Deployment.RepositoryServices;

/// <inheritdoc cref="ITenantLookupRepository"/>
public class TenantLookupRepository : ITenantLookupRepository
{
    private readonly ILogger<TenantLookupRepository> _logger;
    private readonly IMongoCollection<Tenant> _tenantsCollection;

    public TenantLookupRepository(
        ILogger<TenantLookupRepository> logger,
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret)
    {
        _logger = logger;
        var rootDb = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
        _tenantsCollection = rootDb.GetCollection<Tenant>("Tenants");
    }

    public async Task<List<Tenant>> GetProjectsByGroupAsync(string tenantGroupId)
    {
        if (string.IsNullOrWhiteSpace(tenantGroupId))
            return [];

        try
        {
            var filter = Builders<Tenant>.Filter.Eq(t => t.TenantGroupId, tenantGroupId);
            return await _tenantsCollection.Find(filter).ToListAsync();
        }
        catch (MongoException ex)
        {
            _logger.LogError(ex, "Failed to read projects for tenant group {TenantGroupId}.", tenantGroupId);
            return [];
        }
    }

    public async Task<Tenant?> GetProjectAsync(string projectId)
    {
        if (string.IsNullOrWhiteSpace(projectId))
            return null;

        try
        {
            var filter = Builders<Tenant>.Filter.Eq(t => t.TenantId, projectId);
            return await _tenantsCollection.Find(filter).FirstOrDefaultAsync();
        }
        catch (MongoException ex)
        {
            _logger.LogError(ex, "Failed to read project {ProjectId}.", projectId);
            return null;
        }
    }
}
