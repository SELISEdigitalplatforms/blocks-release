using Blocks.Genesis.Entities.Release;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
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

    public async Task<Build?> GetBuildForView(string buildId)
    {
        var buildCollection = _dbContextProvider.GetCollection<Build>(BuildsCollectionName);
        var filter = Builders<Build>.Filter.Eq(b => b.ItemId, buildId);
        // Masked: View column (property) rules clear what the caller may not see. Never save it back.
        var scope = await _access.ReadAsync(ReleaseSchemas.Build, filter, "BuildRepository.GetBuildForView");
        if (!scope.Granted) return null;
        return scope.ForView(await FindWithoutReports(scope, buildCollection).FirstOrDefaultAsync());
    }

    /// <summary>The element names of <c>Build.SastReport</c> and <c>Build.ScaReport</c>.</summary>
    internal static readonly string[] ReportFields = RenderReportFields();

    /// <summary>
    /// The scope's find, minus the saved SAST and SCA reports. Only <c>/build/reports</c> returns report data; build
    /// reads leave it in the database, and the properties stay null in what they return.
    /// </summary>
    internal static IFindFluent<Build, Build> FindWithoutReports(ReadScope<Build> scope, IMongoCollection<Build> collection) =>
        collection.Find(scope.Filter).Project<Build>(WithoutReports(scope.Projection));

    /// <summary>The resolver's projection (if any) with the report fields removed; see <see cref="FindWithoutReports"/>.</summary>
    internal static ProjectionDefinition<Build> WithoutReports(ProjectionDefinition<Build>? projection)
    {
        if (projection is not BsonDocumentProjectionDefinition<Build> resolved)
        {
            return projection is null
                ? new BsonDocument(ReportFields.Select(f => new BsonElement(f, 0)))
                : projection; // An unknown projection shape is kept as the resolver built it.
        }

        var document = resolved.Document.DeepClone().AsBsonDocument;
        // MongoDB cannot mix inclusion and exclusion. An inclusion projection already leaves out every field it
        // does not list, so only an explicit inclusion of a report (or a path inside one) has to go.
        var isInclusion = document.Elements.Any(e =>
            e.Name != "_id" && ((e.Value.IsNumeric && e.Value.ToDouble() != 0) || e.Value is BsonBoolean { Value: true }));
        if (isInclusion)
        {
            foreach (var name in document.Names.Where(IsReportPath).ToList())
                document.Remove(name);
        }
        else
        {
            foreach (var field in ReportFields)
                document[field] = 0;
        }
        return new BsonDocumentProjectionDefinition<Build>(document);
    }

    private static bool IsReportPath(string name) =>
        ReportFields.Any(f => name == f || name.StartsWith(f + ".", StringComparison.Ordinal));

    private static string[] RenderReportFields()
    {
        var serializer = BsonSerializer.SerializerRegistry.GetSerializer<Build>();
        var args = new RenderArgs<Build>(serializer, BsonSerializer.SerializerRegistry);
        return Builders<Build>.Projection.Exclude(b => b.SastReport).Exclude(b => b.ScaReport)
            .Render(args).Names.ToArray();
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
            await _access.PrepareWriteAsync(ReleaseSchemas.Build, build, isInsert: true, "BuildRepository.SaveBuild");
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
        await _access.PrepareWriteAsync(ReleaseSchemas.Build, build, isInsert: true, "BuildRepository.SaveBuildByTenant", tenantId);
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
        await _access.PrepareWriteAsync(ReleaseSchemas.RepositoryWebhook, webhook, isInsert: true, "BuildRepository.SaveWebhook", tenantId);
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<RepositoryWebhook>("RepositoryWebhooks");
        await collection.InsertOneAsync(webhook);
        return true;
    }

    public Task<bool> TrySaveSastReport(string buildId, int expectedAttempts, SastReport report, string tenantId) =>
        TryUpdateOneAsync(
            Builders<Build>.Filter.Eq(b => b.ItemId, buildId)
            & Builders<Build>.Filter.Eq(b => b.SastReport!.Status, AnalysisReportStatus.Pending)
            & Builders<Build>.Filter.Eq(b => b.SastReport!.Attempts, expectedAttempts),
            Builders<Build>.Update.Set(b => b.SastReport, report),
            "BuildRepository.TrySaveSastReport", tenantId);

    public Task<bool> TrySaveScaReport(string buildId, int expectedAttempts, ScaReport report, string tenantId) =>
        TryUpdateOneAsync(
            Builders<Build>.Filter.Eq(b => b.ItemId, buildId)
            & Builders<Build>.Filter.Eq(b => b.ScaReport!.Status, AnalysisReportStatus.Pending)
            & Builders<Build>.Filter.Eq(b => b.ScaReport!.Attempts, expectedAttempts),
            Builders<Build>.Update.Set(b => b.ScaReport, report),
            "BuildRepository.TrySaveScaReport", tenantId);

    private async Task<bool> TryUpdateOneAsync(
        FilterDefinition<Build> filter, UpdateDefinition<Build> update, string callSite, string tenantId)
    {
        var scoped = await _access.EditFilterAsync(ReleaseSchemas.Build, filter, callSite, tenantId);
        if (scoped is null) return false;
        var result = await _dbContextProvider.GetDatabase(tenantId).GetCollection<Build>(BuildsCollectionName)
            .UpdateOneAsync(scoped, update, new UpdateOptions { IsUpsert = false });
        return result.ModifiedCount == 1;
    }

    public Task<Build?> TryEndPendingReport(string pipelineRunName, AnalysisReportKind kind, string status, string message, string tenantId) =>
        TryEndPendingReportAsync(_dbContextProvider.GetDatabase(tenantId).GetCollection<Build>(BuildsCollectionName),
            pipelineRunName, kind, status, message, tenantId);

    public Task<Build?> TryEndPendingReport(string pipelineRunName, AnalysisReportKind kind, string status, string message, Tenant project) =>
        TryEndPendingReportAsync(ProjectBuilds(project), pipelineRunName, kind, status, message, project.TenantId);

    private async Task<Build?> TryEndPendingReportAsync(
        IMongoCollection<Build> collection, string pipelineRunName, AnalysisReportKind kind, string status, string message, string tenantId)
    {
        var byRun = Builders<Build>.Filter.Eq(b => b.PipelineRunName, pipelineRunName);
        var (filter, update) = kind == AnalysisReportKind.Sast
            ? (byRun & Builders<Build>.Filter.Eq(b => b.SastReport!.Status, AnalysisReportStatus.Pending),
               Builders<Build>.Update.Set(b => b.SastReport!.Status, status).Set(b => b.SastReport!.Message, message))
            : (byRun & Builders<Build>.Filter.Eq(b => b.ScaReport!.Status, AnalysisReportStatus.Pending),
               Builders<Build>.Update.Set(b => b.ScaReport!.Status, status).Set(b => b.ScaReport!.Message, message));

        var scoped = await _access.EditFilterAsync(ReleaseSchemas.Build, filter, "BuildRepository.TryEndPendingReport", tenantId);
        if (scoped is null) return null;

        // Only what the caller's notification needs comes back, never the reports.
        var options = new FindOneAndUpdateOptions<Build>
        {
            IsUpsert = false,
            ReturnDocument = ReturnDocument.After,
            Projection = Builders<Build>.Projection
                .Include(b => b.ItemId).Include(b => b.CreatedBy).Include(b => b.RepoId).Include(b => b.ProjectId)
        };
        return await collection.FindOneAndUpdateAsync(scoped, update, options);
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
