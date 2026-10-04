using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using MongoDB.Driver;

namespace Devops.DomainService.Deployment.RepositoryServices;

/// <inheritdoc cref="ITenantLookupRepository"/>
public class TenantLookupRepository : ITenantLookupRepository
{
    private readonly IMongoCollection<Tenant> _tenantsCollection;

    public TenantLookupRepository(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret)
    {
        var rootDb = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
        _tenantsCollection = rootDb.GetCollection<Tenant>("Tenants");
    }

    // Read failures are rethrown with the lookup key rather than logged here: the project delete
    // consumer and Genesis both log the exception on its way to the dead-letter queue.
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
            throw new InvalidOperationException($"Failed to read projects for tenant group {tenantGroupId}.", ex);
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
            throw new InvalidOperationException($"Failed to read project {projectId}.", ex);
        }
    }
}
