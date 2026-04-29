using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.Deployment.RepositoryServices;

public class BuildRepository : IBuildRepository
{
    private readonly ILogger<BuildRepository> _logger;
    private readonly IConfiguration _configuration;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IMongoCollection<Build> _buildsCollection;
    public BuildRepository(IDbContextProvider dbContextProvider, ILogger<BuildRepository> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        _dbContextProvider = dbContextProvider;
        _buildsCollection = _dbContextProvider.GetCollection<Build>("Builds");
    }

    public async Task<Build?> GetBuild(string buildId)
    {
        var buildCollection = _dbContextProvider.GetCollection<Build>("Builds");
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        var build = buildCollection.Find(filter).FirstOrDefault();
        return build;
    }

    public async Task<Build?> GetBuild(string buildId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var buildCollection = _dbContext.GetCollection<Build>("Builds");
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        var build = buildCollection.Find(filter).FirstOrDefault();
        return build;
    }

    public async Task<List<Build>?> GetBuilds(string repoId)
    {

        var collection = _dbContextProvider.GetCollection<Build>("Builds");
        var filter = Builders<Build>.Filter.Eq(b => b.RepoId, repoId);
        var builds = await collection.Find(filter).ToListAsync();
        return builds;
    }

    public async Task SaveBuild(Build build)
    {
        var collection = _dbContextProvider.GetCollection<Build>("Builds");
        try
        {
            await collection.InsertOneAsync(build);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError($"Failed to save build for {e.Message}");
        }
    }

    public async Task SaveBuild(Build build, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Build>("Builds");
        try
        {
            await collection.InsertOneAsync(build);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError($"Failed to save build for {e.Message}");
        }

    }

    public async Task<Build?> GetBuildByPipelineRunName(string pipelineRunName, string tenantId)
    {
        var filter = Builders<Build>.Filter.Eq(build => build.PipelineRunName, pipelineRunName);
        var _dbCollection = _dbContextProvider.GetDatabase(tenantId);
        return await _dbCollection.GetCollection<Build>("Builds").Find(filter).FirstOrDefaultAsync();
    }

    public async Task UpdateBuildEvents(string pipelineRunName, List<BuildEventResponse> buildEventResponses, string eventGroup, string eventStatus, string tenantId)
    {
        var filter = Builders<Build>.Filter.Eq(b => b.PipelineRunName, pipelineRunName);
        var update = Builders<Build>.Update.Set(b => b.Events, buildEventResponses)
                                           .Set(b => b.EventName, eventGroup)
                                           .Set(b => b.Status, eventStatus)
                                           .Set(b => b.LastUpdatedDate, DateTime.UtcNow);

        var options = new UpdateOptions { IsUpsert = false };

        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var result = await _dbContext.GetCollection<Build>("Builds").UpdateOneAsync(filter, update, options);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError($"MongoWriteException: {e.Message}");
        }
    }

    public async Task UpdateBuildStatus(string pipelineRunName, string eventStatus, string tenantId)
    {
        var filter = Builders<Build>.Filter.Eq(b => b.PipelineRunName, pipelineRunName);
        var update = Builders<Build>.Update.Set(b => b.Status, eventStatus)
                                           .Set(b => b.LastUpdatedDate, DateTime.UtcNow);

        var options = new UpdateOptions { IsUpsert = false };

        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var result = await _dbContext.GetCollection<Build>("Builds").UpdateOneAsync(filter, update, options);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError($"MongoWriteException: {e.Message}");
        }
    }

    public Task<Build?> UpdateBuild(Build pod)
    {
        throw new NotImplementedException();
    }

    public async Task<List<HostingProvider>> GetHostingProviders()
    {
        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
            var providersCollection = _dbContextProvider.GetCollection<HostingProvider>("HostingProviders");

            var filter = Builders<HostingProvider>.Filter.Eq(p => p.Status, "active");

            return await providersCollection.Find(filter).ToListAsync();
        }
        catch(Exception ex) 
        {
            _logger.LogError($"Failed to retrieve HostingProviders data: {ex.Message}");
            return [];
        }
    }

    public async Task<bool> SaveWebhook(RepositoryWebhook webhook, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<RepositoryWebhook>("RepositoryWebhooks");
        await collection.InsertOneAsync(webhook);
        return true;
    }
    public async Task<bool> UpdateBuildDependencyTrackProjectId(string buildId, string dependencyTrackProjectId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Build>("Builds");
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        var update = Builders<Build>.Update.Set(b => b.DependencyTrackProjectId, dependencyTrackProjectId);

        var result = await collection.UpdateOneAsync(filter, update);
        return result.MatchedCount == 1 && result.ModifiedCount == 1;
    }
}