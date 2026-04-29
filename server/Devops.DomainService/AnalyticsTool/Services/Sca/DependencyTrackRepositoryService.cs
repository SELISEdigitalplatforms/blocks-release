
using Blocks.Genesis;
using Devops.DomainService.TestingTools.Entity;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.AnalyticsTool.Services.Sca
{
    public class DependencyTrackRepositoryService
    {
        private readonly ILogger<DependencyTrackRepositoryService> _logger;
        private readonly IDbContextProvider _dbContextProvider;
        public DependencyTrackRepositoryService(IDbContextProvider dbContextProvider, ILogger<DependencyTrackRepositoryService> logger)
        {
            _dbContextProvider = dbContextProvider;
            _logger = logger;
        }

        public async Task<bool> SaveDependencyTrackProject(DependencyTrackProjects dependencyTrackProjects)
        {
            try
            {
                var projectId = BlocksContext.GetContext().TenantId;
                var dbContext = _dbContextProvider.GetDatabase(projectId);
                var collection = dbContext.GetCollection<DependencyTrackProjects>("DependencyTrackProjects");
                var filter = Builders<DependencyTrackProjects>.Filter.Eq(x => x.ProjectId, projectId) & Builders<DependencyTrackProjects>.Filter.Eq(x => x.ItemId, dependencyTrackProjects.ItemId);
                var options = new ReplaceOptions { IsUpsert = true };
                var result = await collection.ReplaceOneAsync(filter, dependencyTrackProjects, options);
                if (result.IsAcknowledged)
                {
                    if (result.UpsertedId != null)
                    {
                        _logger.LogInformation($"New DependencyTrack project inserted for userid {projectId}");
                    }
                    else if (result.ModifiedCount > 0)
                    {
                        _logger.LogInformation($"DependencyTrack project updated for userid {projectId}");
                    }
                    else
                    {
                        _logger.LogInformation($"DependencyTrack project already up-to-date for userid {projectId}");
                    }
                    return true;
                }
                _logger.LogWarning($"Upsert operation was not acknowledged for userid {projectId}");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to save DependencyTrack project: {ex.Message}");
                return false;
            }
        }

        public async Task<DependencyTrackProjects> GetDependencyTrackProject(string projectId)
        {
            try
            {
                var dbContext = _dbContextProvider.GetDatabase(projectId);
                var collection = dbContext.GetCollection<DependencyTrackProjects>("DependencyTrackProjects");
                var filter = Builders<DependencyTrackProjects>.Filter.Eq(x => x.ProjectId, projectId);

                var result = await collection.Find(filter).FirstOrDefaultAsync();
                if (result != null)
                {
                    _logger?.LogInformation($"DependencyTrack project found for projectId {projectId}");
                }
                else
                {
                    _logger?.LogWarning($"No DependencyTrack project found for projectId {projectId}");
                }
                return result;
            }
            catch (Exception ex)
            {
                _logger?.LogError($"Failed to get DependencyTrack project: {ex.Message}");
                return null;
            }
        }

    }
}
