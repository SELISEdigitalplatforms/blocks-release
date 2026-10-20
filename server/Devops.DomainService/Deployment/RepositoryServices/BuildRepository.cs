using Blocks.Genesis.Entities.Release;
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
    private const string BuildsCollectionName = "Builds";

    private readonly ILogger<BuildRepository> _logger;
    private readonly IConfiguration _configuration;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IBlocksSecret _blocksSecret;
    private readonly IReleaseDataAccess _access;
    public BuildRepository(IDbContextProvider dbContextProvider, ILogger<BuildRepository> logger, IConfiguration configuration, IBlocksSecret blocksSecret, IReleaseDataAccess access)
    {
        _logger = logger;
        _configuration = configuration;
        _dbContextProvider = dbContextProvider;
        _blocksSecret = blocksSecret;
        _access = access;
    }

    public async Task<Build?> GetBuild(string buildId)
    {
        var buildCollection = _dbContextProvider.GetCollection<Build>(BuildsCollectionName);
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        var scope = await _access.ReadAsync(ReleaseSchemas.Build, filter, "BuildRepository.GetBuild");
        if (!scope.Granted) return null;
        return await scope.Apply(buildCollection).FirstOrDefaultAsync();
    }

    public async Task<Build?> GetBuild(string buildId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var buildCollection = _dbContext.GetCollection<Build>(BuildsCollectionName);
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        var build = buildCollection.Find(filter).FirstOrDefault();
        return build;
    }

    /// <summary>
    /// Builds of one repository, read from the named tenant's database. The tenant is explicit rather
    /// than ambient because the queue-driven teardown runs in the worker off any request: there the
    /// ambient tenant is whatever the message's security context restored - the publisher's tenant, or
    /// nothing at all - and never the project being torn down.
    /// </summary>
    public async Task<List<Build>?> GetBuilds(string repoId, string tenantId)
    {
        var collection = _dbContextProvider.GetCollection<Build>(tenantId, BuildsCollectionName);
        return await GetBuildsAsync(collection, repoId, tenantId);
    }

    public Task<List<Build>?> GetBuilds(string repoId, Tenant project) =>
        GetBuildsAsync(ProjectBuilds(project), repoId, project.TenantId);

    private async Task<List<Build>?> GetBuildsAsync(IMongoCollection<Build> collection, string repoId, string tenantId)
    {
        var filter = Builders<Build>.Filter.Eq(b => b.RepoId, repoId);
        var scope = await _access.ReadAsync(ReleaseSchemas.Build, filter, "BuildRepository.GetBuilds", tenantId);
        if (!scope.Granted) return new List<Build>();
        return await scope.Apply(collection).ToListAsync();
    }

    public async Task SaveBuild(Build build)
    {
        var collection = _dbContextProvider.GetCollection<Build>(BuildsCollectionName);
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
        if (!await _access.InsertAllowedAsync(ReleaseSchemas.Build, "BuildRepository.SaveBuildByTenant", tenantId))
            throw new UnauthorizedAccessException("Data access policy denies creating a build.");
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Build>(BuildsCollectionName);
        await collection.InsertOneAsync(build);
    }

    public async Task<Build?> GetBuildByPipelineRunName(string pipelineRunName, string tenantId)
    {
        var filter = Builders<Build>.Filter.Eq(build => build.PipelineRunName, pipelineRunName);
        var _dbCollection = _dbContextProvider.GetDatabase(tenantId);
        var scope = await _access.ReadAsync(ReleaseSchemas.Build, filter, "BuildRepository.GetBuildByPipelineRunName", tenantId);
        if (!scope.Granted) return null;
        return await scope.Apply(_dbCollection.GetCollection<Build>(BuildsCollectionName)).FirstOrDefaultAsync();
    }

    public async Task UpdateBuildEvents(string pipelineRunName, List<BuildEventResponse> buildEventResponses, string eventGroup, string eventStatus, string tenantId)
    {
        var update = Builders<Build>.Update.Set(b => b.Events, buildEventResponses)
                                           .Set(b => b.EventName, eventGroup)
                                           .Set(b => b.Status, eventStatus)
                                           .Set(b => b.LastUpdatedDate, DateTime.UtcNow);

        var options = new UpdateOptions { IsUpsert = false };

        try
        {
            var filter = await _access.EditFilterAsync(ReleaseSchemas.Build,
                Builders<Build>.Filter.Eq(b => b.PipelineRunName, pipelineRunName), "BuildRepository.UpdateBuildEvents", tenantId);
            if (filter is null) return;
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            await _dbContext.GetCollection<Build>(BuildsCollectionName).UpdateOneAsync(filter, update, options);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError($"MongoWriteException: {e.Message}");
        }
    }

    public async Task UpdateBuildStatus(string pipelineRunName, string eventStatus, string tenantId)
    {
        try
        {
            await UpdateBuildStatusAsync(
                _dbContextProvider.GetDatabase(tenantId).GetCollection<Build>(BuildsCollectionName), pipelineRunName, eventStatus, tenantId);
        }
        catch (MongoWriteException ex)
        {
            _logger.LogError(ex, "Failed to update build status for pipeline {PipelineRunName}.", pipelineRunName);
        }
    }

    public Task UpdateBuildStatus(string pipelineRunName, string eventStatus, Tenant project) =>
        UpdateBuildStatusAsync(ProjectBuilds(project), pipelineRunName, eventStatus, project.TenantId);

    private async Task UpdateBuildStatusAsync(
        IMongoCollection<Build> collection, string pipelineRunName, string eventStatus, string tenantId)
    {
        var filter = await _access.EditFilterAsync(ReleaseSchemas.Build,
            Builders<Build>.Filter.Eq(b => b.PipelineRunName, pipelineRunName), "BuildRepository.UpdateBuildStatus", tenantId);
        if (filter is null) return;
        var update = Builders<Build>.Update.Set(b => b.Status, eventStatus)
                                           .Set(b => b.LastUpdatedDate, DateTime.UtcNow);

        var options = new UpdateOptions { IsUpsert = false };
        await collection.UpdateOneAsync(filter, update, options);
    }

    private IMongoCollection<Build> ProjectBuilds(Tenant project)
    {
        ArgumentNullException.ThrowIfNull(project);
        if (string.IsNullOrWhiteSpace(project.TenantId)
            || string.IsNullOrWhiteSpace(project.DbConnectionString)
            || string.IsNullOrWhiteSpace(project.DBName))
            throw new InvalidOperationException("Project tenant has no database placement.");

        return _dbContextProvider.GetDatabase(project.DbConnectionString, project.DBName)
            .GetCollection<Build>(BuildsCollectionName);
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
            var providersCollection = _dbContext.GetCollection<HostingProvider>("HostingProviders");

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
        if (!await _access.InsertAllowedAsync(ReleaseSchemas.RepositoryWebhook, "BuildRepository.SaveWebhook", tenantId))
            return false;
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<RepositoryWebhook>("RepositoryWebhooks");
        await collection.InsertOneAsync(webhook);
        return true;
    }
    public async Task<bool> UpdateBuildDependencyTrackProjectId(string buildId, string dependencyTrackProjectId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Build>(BuildsCollectionName);
        var filter = await _access.EditFilterAsync(ReleaseSchemas.Build,
            Builders<Build>.Filter.Eq(b => b.ItemId, buildId), "BuildRepository.UpdateBuildDependencyTrackProjectId", tenantId);
        if (filter is null) return false;
        var update = Builders<Build>.Update.Set(b => b.DependencyTrackProjectId, dependencyTrackProjectId);

        var result = await collection.UpdateOneAsync(filter, update);
        return result.MatchedCount == 1 && result.ModifiedCount == 1;
    }
}
