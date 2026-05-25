using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Entity;
using Devops.DomainService.DataGetwayDeployment.Models;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.DataGatewayDeployment.Services
{
    public class DataGatewayDeploymentRepository : IDataGatewayDeploymentRepository
    {
        private readonly ILogger<DataGatewayDeploymentRepository> _logger;
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IMongoCollection<BlocksGuid> _blocksGuidsCollection;
        private readonly IMongoCollection<Tenant> _tenantsCollection;

        public DataGatewayDeploymentRepository(
            ILogger<DataGatewayDeploymentRepository> logger,
            IDbContextProvider dbContextProvider,
            IBlocksSecret blocksSecret)
        {
            _logger = logger;
            _dbContextProvider = dbContextProvider;
            var db = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
            _blocksGuidsCollection = db.GetCollection<BlocksGuid>("BlocksGuids");
            _tenantsCollection = db.GetCollection<Tenant>("Tenants");
        }

        public async Task<Tenant?> GetTenantByIdAsync(string projectId)
        {
            try
            {
                var filter = Builders<Tenant>.Filter.Eq(b => b.TenantId, projectId);
                return await _tenantsCollection.Find(filter).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch BlocksGuid for TenantGroupId: {TenantGroupId}", projectId);
                return null;
            }
        }

        public async Task<BlocksGuid?> GetBlocksGuidAsync(string tenantGroupId)
        {
            try
            {
                var filter = Builders<BlocksGuid>.Filter.Eq(b => b.TenantGroupId, tenantGroupId);
                return await _blocksGuidsCollection.Find(filter).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch BlocksGuid for TenantGroupId: {TenantGroupId}", tenantGroupId);
                return null;
            }
        }

        public async Task<DataGatewayInstance?> GetDataGatewayInstanceAsync(string tenantId, string projectGuidId)
        {
            try
            {
                var dbContext = _dbContextProvider.GetDatabase(tenantId);
                var _dataGatewayInstanceCollection = dbContext.GetCollection<DataGatewayInstance>("DataGatewayInstances");
                return await _dataGatewayInstanceCollection.Find(x => x.TenantId == projectGuidId).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch DataGatewayInstance for TenantId: {TenantId}", projectGuidId);
                return null;
            }
        }

        public async Task<DataGatewayInstance?> AddDataGatewayInstanceAsync(DataGatewayInstance instance)
        {
            try
            {
                var dbContext = _dbContextProvider.GetDatabase(instance.TenantId);
                var _dataGatewayInstanceCollection = dbContext.GetCollection<DataGatewayInstance>("DataGatewayInstances");
                await _dataGatewayInstanceCollection.InsertOneAsync(instance);
                return instance;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add DataGatewayInstance for ProjectGuid: {ProjectGuid}", instance.ProjectGuid);
                return null;
            }
        }

        public async Task<bool> UpsertDataGatewayInstanceAsync(Tenant project, string projectKey, string pipelineRunName)
        {
            try
            {
                var existing = await GetDataGatewayInstanceAsync(project.TenantId, projectKey);
                var dbContext = _dbContextProvider.GetDatabase(project.TenantId);
                var _dataGatewayInstanceCollection = dbContext.GetCollection<DataGatewayInstance>("DataGatewayInstances");
                var newDeploymentLog = new DataGatewayInstanceDeploymentLogs
                {
                    PipelineRunName = pipelineRunName,
                    EventStartDate = DateTime.UtcNow,
                    EventFinishDate = DateTime.MinValue,
                    EventStatus = "InProgress",
                    Version = "v1"
                };

                if (existing == null)
                {
                    var instance = new DataGatewayInstance
                    {
                        ItemId = Guid.NewGuid().ToString(),
                        TenantId = project.TenantId,
                        ProjectGuid = projectKey,
                        ProjectEnv = project.Environment,
                        LastPipelineRunName = pipelineRunName,
                        LastVersion = "v1",
                        LastDeploymentStatus = "InProgress",
                        ClusterNames = new List<string> { "aks-blocks-dev" },
                        DataGatewayInstanceDeploymentLog = new List<DataGatewayInstanceDeploymentLogs> { newDeploymentLog },
                        CreatedDate = DateTime.UtcNow,
                        LastUpdatedDate = DateTime.UtcNow
                    };

                    await _dataGatewayInstanceCollection.InsertOneAsync(instance);
                }
                else
                {
                    var update = Builders<DataGatewayInstance>.Update
                        .Set(x => x.LastPipelineRunName, pipelineRunName)
                        .Set(x => x.LastVersion, "v1")
                        .Set(x => x.LastDeploymentStatus, "InProgress")
                        .Set(x => x.LastUpdatedDate, DateTime.UtcNow)
                        .AddToSet(x => x.DataGatewayInstanceDeploymentLog, newDeploymentLog);

                    await _dataGatewayInstanceCollection.UpdateOneAsync(x => x.TenantId == project.TenantId, update);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert DataGatewayInstance for project {ProjectName}", project.Name);
                return false;
            }
        }

        public async Task<bool> UpdatePipelineStatusAsync(string tenantId,string pipelineRunName, string newStatus)
        {
            try
            {
                var dbContext = _dbContextProvider.GetDatabase(tenantId);
                var _dataGatewayInstanceCollection = dbContext.GetCollection<DataGatewayInstance>("DataGatewayInstances");
                var filter = Builders<DataGatewayInstance>.Filter.ElemMatch(
                    x => x.DataGatewayInstanceDeploymentLog,
                    log => log.PipelineRunName == pipelineRunName
                );

                var update = Builders<DataGatewayInstance>.Update
                    .Set(x => x.LastDeploymentStatus, newStatus)
                    .Set(x => x.LastUpdatedDate, DateTime.UtcNow)
                    .Set("DataGatewayInstanceDeploymentLog.$.EventStatus", newStatus)
                    .Set("DataGatewayInstanceDeploymentLog.$.EventFinishDate", DateTime.UtcNow);

                var result = await _dataGatewayInstanceCollection.UpdateOneAsync(filter, update);

                if (result.MatchedCount == 0)
                {
                    _logger.LogWarning("No DataGatewayInstance found for pipelineRunName {PipelineRunName}", pipelineRunName);
                    return false;
                }

                _logger.LogInformation("Updated deployment status to '{Status}' for pipelineRunName {PipelineRunName}", newStatus, pipelineRunName);
                return result.ModifiedCount > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update pipeline status for pipelineRunName {PipelineRunName}", pipelineRunName);
                return false;
            }
        }

    }
}
