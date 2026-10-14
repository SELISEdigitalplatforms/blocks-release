
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.AnalyticsTool.Services.Sca
{
    public class DependencyTrackRepositoryService
    {
        private readonly ILogger<DependencyTrackRepositoryService> _logger;
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IKeyValueStore _keyValueStore;
        private const string KeyPrefix = "dependency-track-project:";

        public DependencyTrackRepositoryService(IDbContextProvider dbContextProvider, IKeyValueStore keyValueStore, ILogger<DependencyTrackRepositoryService> logger)
        {
            _dbContextProvider = dbContextProvider;
            _keyValueStore = keyValueStore;
            _logger = logger;
        }

        public async Task<bool> SaveDependencyTrackProject(DependencyTrackProjects dependencyTrackProjects)
        {
            try
            {
                var projectId = BlocksContext.GetContext().TenantId;
                await _keyValueStore.SetAsync(KeyPrefix + projectId, dependencyTrackProjects);
                _logger.LogInformation($"DependencyTrack project saved for userid {projectId}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to save DependencyTrack project: {ex.Message}");
                return false;
            }
        }

        public async Task<DependencyTrackProjects> GetDependencyTrackProject(string projectId)
        {
            var kvReadFailed = false;
            try
            {
                projectId = BlocksContext.GetContext().TenantId;
                if (string.IsNullOrWhiteSpace(projectId))
                {
                    // Same as today: no tenant means no project (C2), never a key value store call.
                    _logger?.LogError("Failed to get DependencyTrack project: tenant id is missing");
                    return null;
                }

                DependencyTrackProjects result;
                try
                {
                    result = await _keyValueStore.GetAsync<DependencyTrackProjects>(KeyPrefix + projectId);
                }
                catch (Exception kvEx)
                {
                    // A null here would make the caller create a new team and overwrite the only KV row.
                    // Log and rethrow so the call fails and nothing is written (CL-release-03).
                    _logger?.LogError($"Failed to read DependencyTrack project from key value store: {kvEx.Message}");
                    kvReadFailed = true;
                    throw;
                }

                if (result == null)
                {
                    // Fallback to the old collection until the migration cleanup drops it.
                    var dbContext = _dbContextProvider.GetDatabase(projectId);
                    var collection = dbContext.GetCollection<DependencyTrackProjects>("DependencyTrackProjects");
                    var filter = Builders<DependencyTrackProjects>.Filter.Eq(x => x.ProjectId, projectId);
                    result = await collection.Find(filter).FirstOrDefaultAsync();
                }
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
            catch (Exception ex) when (!kvReadFailed)
            {
                _logger?.LogError($"Failed to get DependencyTrack project: {ex.Message}");
                return null;
            }
        }
    }
}
