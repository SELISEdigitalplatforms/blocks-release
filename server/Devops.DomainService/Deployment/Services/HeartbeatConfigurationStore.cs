using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using MongoDB.Driver;

namespace Devops.DomainService.Deployment.Services;

public class HeartbeatConfigurationStore : IHeartbeatConfigurationStore
{
    private readonly IMongoCollection<MonitorConfiguration> _monitorConfigurations;

    public HeartbeatConfigurationStore(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        var db = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
        _monitorConfigurations = db.GetCollection<MonitorConfiguration>(MonitorProvisioningService.MonitorConfigurationsCollection);
    }

    private static FilterDefinition<MonitorConfiguration> HeartbeatById(string itemId) =>
        Builders<MonitorConfiguration>.Filter.And(
            Builders<MonitorConfiguration>.Filter.Eq(m => m.ItemId, itemId),
            Builders<MonitorConfiguration>.Filter.Eq(m => m.MonitorConfigurationType, MonitorConfigurationTypes.InboundPing));

    public async Task<MonitorConfiguration?> GetAsync(string itemId) =>
        await _monitorConfigurations.Find(HeartbeatById(itemId)).FirstOrDefaultAsync();

    public Task UpdateEditableFieldsAsync(MonitorConfiguration heartbeat)
    {
        var update = Builders<MonitorConfiguration>.Update
            .Set(m => m.Name, heartbeat.Name)
            .Set(m => m.IntervalInSeconds, heartbeat.IntervalInSeconds)
            .Set(m => m.GracePeriodInSeconds, heartbeat.GracePeriodInSeconds)
            .Set(m => m.IsActive, heartbeat.IsActive)
            .Set(m => m.LastUpdatedDate, heartbeat.LastUpdatedDate)
            .Set(m => m.LastUpdatedBy, heartbeat.LastUpdatedBy);

        return _monitorConfigurations.UpdateOneAsync(HeartbeatById(heartbeat.ItemId), update);
    }

    public async Task<bool> DeleteAsync(string itemId)
    {
        var result = await _monitorConfigurations.DeleteOneAsync(HeartbeatById(itemId));
        return result.DeletedCount > 0;
    }
}
