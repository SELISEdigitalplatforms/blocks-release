using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Pipelines.Sockets.Unofficial.Arenas;

namespace Devops.DomainService.Deployment.RepositoryServices;

public class RepoRepository : IRepoRepository
{
    private readonly ILogger<RepoRepository> _logger;
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IConfiguration _configuration;
    private readonly IBlocksSecret _blocksSecret;

    private static readonly FilterDefinition<Repo> NotArchived =
        Builders<Repo>.Filter.Ne(r => r.IsArchived, true);

    public RepoRepository(IDbContextProvider dbContextProvider, IConfiguration configuration, ILogger<RepoRepository> logger, IBlocksSecret blocksSecret)
    {
        _logger = logger;
        _dbContextProvider = dbContextProvider;
        _configuration = configuration;
        _blocksSecret = blocksSecret;
    }

    public async Task<Repo?> GetRepo(string repoId)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId) & NotArchived;
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<Repo?> GetRepo(string repoId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId) & NotArchived;
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<Repo?> GetRepoByBranch(string tenantId, string repoFullName, string branch)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.RepoName, repoFullName) &
                     Builders<Repo>.Filter.Eq(r => r.Branch, branch) &
                     NotArchived;
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<List<Repo>?> GetRepos()
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        return await collection.Find(NotArchived).ToListAsync();
    }

    // Page bounds live here rather than in the controller so that no caller, present or
    // future, can drive this query with a negative skip or an unbounded limit.
    private const int MinPageSize = 1;
    private const int MaxPageSize = 100;

    public async Task<List<Build>?> GetRepoBuildList(
        string RepoId,
        string? branch,
        int pageNumber,
        int pageSize)
    {
        var collection = _dbContextProvider.GetCollection<Build>("Builds");

        var filter = BuildListFilter(RepoId, branch);

        var safePageNumber = Math.Max(1, pageNumber);
        var safePageSize = Math.Clamp(pageSize, MinPageSize, MaxPageSize);

        // Computed in long: (pageNumber - 1) * pageSize overflows int for page numbers near
        // int.MaxValue and lands NEGATIVE, which is precisely the negative skip the clamp
        // above exists to prevent. An absurd page is bounded to a page that simply has no
        // documents rather than throwing.
        var skip = (long)(safePageNumber - 1) * safePageSize;
        var safeSkip = skip > int.MaxValue ? int.MaxValue : (int)skip;

        // CreatedDate alone is not a total order - two builds can share a timestamp - so
        // _id breaks the tie and makes paging deterministic. The raw field name is used
        // rather than a mapped property so the sort does not depend on how the base entity
        // maps its identifier.
        var sort = Builders<Build>.Sort
            .Descending(b => b.CreatedDate)
            .Descending("_id");

        return await collection
            .Find(filter)
            .Sort(sort)
            .Skip(safeSkip)
            .Limit(safePageSize)
            .ToListAsync();
    }

    public async Task<long> GetRepoBuildCount(string RepoId, string? branch)
    {
        var collection = _dbContextProvider.GetCollection<Build>("Builds");

        // Deliberately the same filter the list uses. A count built from its own copy of the
        // predicate is the classic way for a total to drift out of step with the rows it is
        // meant to describe, and a client would page into an empty tail because of it.
        return await collection.CountDocumentsAsync(BuildListFilter(RepoId, branch));
    }

    private static FilterDefinition<Build> BuildListFilter(string RepoId, string? branch)
    {
        var filter = Builders<Build>.Filter.Eq(r => r.RepoId, RepoId);
        if (!string.IsNullOrWhiteSpace(branch))
        {
            filter &= Builders<Build>.Filter.Eq(r => r.Branch, branch);
        }

        return filter;
    }

    public async Task<IReadOnlyList<RepoWithBuildsResponse>> GetReposWithBuildsAsync(string projectId)
    {
        CancellationToken ct = default;
        var blocksUserId = BlocksContext.GetContext().UserId;
        var repoCollection = _dbContextProvider.GetCollection<Repo>("Repos");
        var buildsCollection = _dbContextProvider.GetCollection<Build>("Builds");
        var repoFilter = Builders<Repo>.Filter.Eq(r => r.BlocksUserId, blocksUserId) &
                         Builders<Repo>.Filter.Eq(r => r.ProjectId, projectId) &
                         NotArchived;

        var pipeline = repoCollection.Aggregate()                        // FROM repos
            .Match(repoFilter)                             // only this user, archived repos excluded
            .Lookup<Repo, Build, RepoWithBuildsResponse>(                // JOIN builds
                foreignCollection: buildsCollection,
                localField: r => r.ItemId,
                foreignField: b => b.RepoId,
                @as: rw => rw.Builds)
            .Project(rw => new RepoWithBuildsResponse()
            {
                ItemId = rw.ItemId,
                BlocksUserId = rw.BlocksUserId,
                ProjectId = rw.ProjectId,
                RepoName = rw.RepoName,
                Builds = rw.Builds      // keep only caller’s builds
                              .Where(b => b.BlocksUserId == blocksUserId)
                              .ToList(),
                DefaultDeploymentUrl = rw.DefaultDeploymentUrl,
                DeploySettings = rw.DeploySettings
            });

        return await pipeline.ToListAsync(ct);
    }

    public async Task SaveRepo(Repo repo)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        try
        {
            var filter = Builders<Repo>.Filter.Eq(r => r.ProjectId, repo.ProjectId) &
             Builders<Repo>.Filter.Eq(r => r.RepoName, repo.RepoName);

            bool exists = await collection.Find(filter).AnyAsync();

            if (!exists)
                await collection.InsertOneAsync(repo);
        }
        catch (MongoWriteException e)
        {
            _logger.LogError(e.Message);
        }
    }

    public async Task<bool> UpdateRepo(RepoUpdateRequest request)
    {
        try
        {
            var collection = _dbContextProvider.GetCollection<Repo>("Repos");

            var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, request.RepoId);
            var updateBuilder = Builders<Repo>.Update;
            UpdateDefinition<Repo>? update = null;

            // Dynamically build update only for non-null values
            if (request.deploySettings is not null)
                update = (update == null ? updateBuilder.Set(r => r.DeploySettings, request.deploySettings)
                                         : update.Set(r => r.DeploySettings, request.deploySettings));

            if (!string.IsNullOrWhiteSpace(request.DeploymentType))
                update = (update == null ? updateBuilder.Set(r => r.DeploymentType, request.DeploymentType)
                                         : update.Set(r => r.DeploymentType, request.DeploymentType));

            if (!string.IsNullOrWhiteSpace(request.CustomDomain))
                update = (update == null ? updateBuilder.Set(r => r.CustomDeploymentUrl, request.CustomDomain)
                                         : update.Set(r => r.CustomDeploymentUrl, request.CustomDomain));

            if (!string.IsNullOrWhiteSpace(request.LastDeploymentStatus))
                update = (update == null ? updateBuilder.Set(r => r.LastDeploymentStatus, request.LastDeploymentStatus)
                                         : update.Set(r => r.LastDeploymentStatus, request.LastDeploymentStatus));

            if (request.LastDeploymentDate is not null)
                update = (update == null ? updateBuilder.Set(r => r.LastDeploymentDate, request.LastDeploymentDate)
                                         : update.Set(r => r.LastDeploymentDate, request.LastDeploymentDate));

            if (update == null)
                return false;

            var result = await collection.UpdateOneAsync(filter, update);
            return true;
        }
        catch(Exception ex)
        {
            _logger.LogError($"Failed to update repo {ex.Message}");
            return false;
        }
        
    }

    public async Task<bool> UpdateRepo(RepoUpdateRequest request, string tenantId)
    {
        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var collection = _dbContext.GetCollection<Repo>("Repos");

            var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, request.RepoId);
            var updateBuilder = Builders<Repo>.Update;
            UpdateDefinition<Repo>? update = null;

            // Dynamically build update only for non-null values
            if (request.deploySettings is not null)
                update = (update == null ? updateBuilder.Set(r => r.DeploySettings, request.deploySettings)
                                         : update.Set(r => r.DeploySettings, request.deploySettings));

            if (!string.IsNullOrWhiteSpace(request.DeploymentType))
                update = (update == null ? updateBuilder.Set(r => r.DeploymentType, request.DeploymentType)
                                         : update.Set(r => r.DeploymentType, request.DeploymentType));

            if (!string.IsNullOrWhiteSpace(request.CustomDomain))
                update = (update == null ? updateBuilder.Set(r => r.CustomDeploymentUrl, request.CustomDomain)
                                         : update.Set(r => r.CustomDeploymentUrl, request.CustomDomain));

            if (!string.IsNullOrWhiteSpace(request.LastDeploymentStatus))
                update = (update == null ? updateBuilder.Set(r => r.LastDeploymentStatus, request.LastDeploymentStatus)
                                         : update.Set(r => r.LastDeploymentStatus, request.LastDeploymentStatus));
            if (request.LastDeploymentDate is not null)
                update = (update == null ? updateBuilder.Set(r => r.LastDeploymentDate, request.LastDeploymentDate)
                                         : update.Set(r => r.LastDeploymentDate, request.LastDeploymentDate));

            if (update == null)
                return false;

            var result = await collection.UpdateOneAsync(filter, update);
            return result.MatchedCount == 1 && result.ModifiedCount == 1;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to update repo {ex.Message}");
            return false;
        }

    }

    public async Task<bool> UpdateRepo(Repo repo)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repo.ItemId);
        var result = await collection.ReplaceOneAsync(filter, repo, cancellationToken: default);
        return result.MatchedCount == 1;
    }

    /// <summary>
    /// Clears the recorded deployment namespace and stamps the display status, in one atomic update against
    /// the caller's tenant database - the same database <see cref="GetRepo(string, string)"/> reads from.
    /// UpdateRepo(RepoUpdateRequest, tenantId) cannot be reused here: it skips null values, so it cannot clear a field.
    /// </summary>
    public async Task<bool> ClearDeployedNamespace(string repoId, string tenantId, string lastDeploymentStatus)
    {
        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var collection = _dbContext.GetCollection<Repo>("Repos");

            var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
            var update = Builders<Repo>.Update
                .Set(r => r.DeployedNamespace, null)
                .Set(r => r.LastDeploymentStatus, lastDeploymentStatus);

            var result = await collection.UpdateOneAsync(filter, update);
            return result.MatchedCount == 1;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to clear deployed namespace for repo {RepoId}.", repoId);
            return false;
        }
    }

    /// <summary>
    /// Every repository of one project, read from that project's own tenant database rather than the
    /// caller's - the queue-driven teardown has no ambient tenant context to fall back on.
    /// Passing a resourceId narrows to the repository imported from that resource.
    ///
    /// Deliberately NOT filtered by <see cref="NotArchived"/>, unlike every other read here. blocks-os
    /// archives a repository on its own side before it publishes the delete, so an archived repository
    /// is the normal case for teardown - filtering them out would leave their namespaces running with
    /// nothing left in any list to find them by. This is the one read whose job is not to answer
    /// "what should the user see".
    /// </summary>
    public async Task<List<Repo>> GetProjectRepos(string tenantId, string? resourceId = null)
    {
        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var collection = _dbContext.GetCollection<Repo>("Repos");

            var filter = Builders<Repo>.Filter.Eq(r => r.ProjectId, tenantId);

            if (!string.IsNullOrWhiteSpace(resourceId))
                filter &= Builders<Repo>.Filter.Eq(r => r.SourceRepoId, resourceId);

            return await collection.Find(filter).ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read repositories for project {ProjectId}.", tenantId);
            return [];
        }
    }

    /// <summary>
    /// Marks a repository archived so it drops out of every read. Deliberately separate from
    /// <see cref="ClearDeployedNamespace"/>: tearing a deployment down and retiring the repository
    /// are different decisions, and the interactive delete-deployment path only does the former.
    /// </summary>
    public async Task<bool> ArchiveRepo(string repoId, string tenantId)
    {
        try
        {
            var _dbContext = _dbContextProvider.GetDatabase(tenantId);
            var collection = _dbContext.GetCollection<Repo>("Repos");

            var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
            var update = Builders<Repo>.Update
                .Set(r => r.IsArchived, true)
                .Set(r => r.LastUpdatedDate, DateTime.UtcNow);

            var result = await collection.UpdateOneAsync(filter, update);
            return result.MatchedCount == 1;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to archive repo {RepoId}.", repoId);
            return false;
        }
    }

    public async Task<BulkOperationSummary> UpdateRepoDomain(RepoDomainUpdateRequest request)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        var projectId = BlocksContext.GetContext()?.TenantId;

        var bulkOps = request.repoWithDomains
            .Where(rd => !string.IsNullOrWhiteSpace(rd.RepoId) && !string.IsNullOrWhiteSpace(rd.CustomDeploymentDomain))
            .Select(rd => new UpdateOneModel<Repo>(
                Builders<Repo>.Filter.Eq(r => r.ItemId, rd.RepoId) &
                Builders<Repo>.Filter.Eq(r => r.ProjectId, projectId),
                Builders<Repo>.Update.Set(r => r.CustomDeploymentUrl, rd.CustomDeploymentDomain)))
            .ToList();

        var result = await collection.BulkWriteAsync(bulkOps, new BulkWriteOptions { IsOrdered = false });

        return new BulkOperationSummary
        {
            RequestedCount = bulkOps.Count,
            MatchedCount = (int)result.MatchedCount,
            ModifiedCount = (int)result.ModifiedCount,
            IsAcknowledged = result.IsAcknowledged
        };
    }

    public async Task<BulkOperationSummary> UpsertRepoCustomDomainsAsync(List<RepoCustomDomain> domains)
    {
        var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
        var collection = _dbContext.GetCollection<RepoCustomDomain>("RepoCustomDomains");

        var bulkOps = domains.Select(d => new ReplaceOneModel<RepoCustomDomain>(
        Builders<RepoCustomDomain>.Filter.Eq(x => x.ItemId, d.ItemId), d)
        { IsUpsert = true }).ToList();

        var result = await collection.BulkWriteAsync(bulkOps);
        return new BulkOperationSummary
        {
            RequestedCount = bulkOps.Count,
            MatchedCount = (int)result.MatchedCount,
            ModifiedCount = (int)result.ModifiedCount,
            IsAcknowledged = result.IsAcknowledged
        };
    }

    public async Task<List<RepoCustomDomain>> GetRepoCustomDomainsAsync(List<RepoWithDomain> domains, string projectId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
        var collection = _dbContext.GetCollection<RepoCustomDomain>("RepoCustomDomains");

        var repoIds = domains
            .Where(x => !string.IsNullOrWhiteSpace(x.RepoId))
            .Select(x => x.RepoId)
            .ToList();

        if (!repoIds.Any())
            return new List<RepoCustomDomain>();

        var filter = Builders<RepoCustomDomain>.Filter.And(
                Builders<RepoCustomDomain>.Filter.Eq(r => r.ProjectId, projectId),
                Builders<RepoCustomDomain>.Filter.In(r => r.RepoId, repoIds)
            );
        return await collection.Find(filter).ToListAsync();
    }

    public async Task<bool> GetRepoCustomDomainExists(List<RepoWithDomain> domains)
    {
        var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
        var collection = _dbContext.GetCollection<RepoCustomDomain>("RepoCustomDomains");

        var domainsToCheck = domains
            .Where(x => !string.IsNullOrWhiteSpace(x.CustomDeploymentDomain))
            .Select(x => x.CustomDeploymentDomain.Trim().ToLower())
            .Distinct()
            .ToList();

        if (!domainsToCheck.Any())
            return true;

        var existingDomains = await collection.Find(x =>
            domainsToCheck.Contains(x.CustomDeploymentDomain.ToLower()))
            .ToListAsync();

        foreach (var item in domains)
        {
            var domain = item.CustomDeploymentDomain?.Trim().ToLower();

            if (string.IsNullOrEmpty(domain))
                continue;

            var conflict = existingDomains
                .FirstOrDefault(x => x.CustomDeploymentDomain.ToLower() == domain && x.RepoId != item.RepoId);

            if (conflict != null)
                return false;
        }

        return true;
    }

    public async Task<DeploySettings> GetDeploySettings(string hostingProviderId, string regionId, string machineConfigId)
    {
        try
        {
            CancellationToken ct = default;
            var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
            var providersCollection = _dbContext.GetCollection<HostingProvider>("HostingProviders");
            var hpId = hostingProviderId;
            var regId = regionId;
            var mcId = machineConfigId;

            // 2. Fetch the hosting‑provider document (single trip to Mongo)
            //    – keep only the one region we care about (ElemMatch)
            //      so we don’t pull unnecessary data across the wire.
            var proj = Builders<HostingProvider>.Projection
                .ElemMatch(h => h.Region, r => r.Id == regId)   // keep just this region
                .Include(h => h.Id)
                .Include(h => h.Name)
                .Include(h => h.Status);

            var provider = await providersCollection
                .Find(h => h.Id == hpId)
                .Project<HostingProvider>(proj)                  // still materialises as HostingProvider
                .FirstOrDefaultAsync(ct);

            if (provider is null)
                throw new InvalidOperationException($"Hosting provider {hpId} not found.");

            var region = provider.Region?.FirstOrDefault();      // only one due to ElemMatch
            if (region is null)
                throw new InvalidOperationException(
                    $"Region {regId} is not attached to hosting provider {hpId}.");

            // 3. Locate the machine config inside the region
            var machine = region.MachineSpecs?
                .FirstOrDefault(m => m.Id == mcId);

            if (machine is null)
                throw new InvalidOperationException(
                    $"MachineConfig {mcId} is not attached to region {regId}.");

            // 4. Assemble the DTO
            return new DeploySettings
            {
                HostingProvider = provider,
                Region = region,
                MachineConfig = machine,
            };
        }
        catch(Exception ex)
        {
            _logger.LogError($"Failed to fetch deploy settings {ex.Message}");
            return null;
        }
    }

    public async Task<List<string>> GetProjectPeopleList(string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(_configuration["RootTenantId"]);
        var collection = _dbContext.GetCollection<ProjectPeople>("ProjectPeoples");

        var filter = Builders<ProjectPeople>.Filter.Eq(r => r.TenantId, tenantId);
        var result = await collection.Find(filter).ToListAsync();

        return result.Select(p => p.UserId).ToList();
    }

    public async Task<bool> UpdateRepoDependencyTrackProjectUuid(string repoId, string dependencyTrackProjectUuid, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
        var update = Builders<Repo>.Update.Set(r => r.DependencyTrackProjectUuid, dependencyTrackProjectUuid);

        var result = await collection.UpdateOneAsync(filter, update);
        return result.MatchedCount == 1 && result.ModifiedCount == 1;
    }

    public async Task<bool> UpdateRepoSecretStoreItemId(string repoId, string secretStoreItemId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
        var update = Builders<Repo>.Update.Set(r => r.SecretStoreItemId, secretStoreItemId);

        // MatchedCount only: re-pointing a repository at the id it already holds is a no-op in
        // Mongo (ModifiedCount 0) but is still a success from the caller's point of view. The
        // DependencyTrack sibling above checks both because it is only ever called with a value
        // that differs; this one is reached on the create path where a retry can repeat the id.
        var result = await collection.UpdateOneAsync(filter, update);
        return result.MatchedCount == 1;
    }
}