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

    public RepoRepository(IDbContextProvider dbContextProvider, IConfiguration configuration, ILogger<RepoRepository> logger)
    {
        _logger = logger;
        _dbContextProvider = dbContextProvider;
        _configuration = configuration;
    }

    public async Task<Repo?> GetRepo(string repoId)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<Repo?> GetRepo(string repoId, string tenantId)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.ItemId, repoId);
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<Repo?> GetRepoByBranch(string tenantId, string repoFullName, string branch)
    {
        var _dbContext = _dbContextProvider.GetDatabase(tenantId);
        var collection = _dbContext.GetCollection<Repo>("Repos");
        var filter = Builders<Repo>.Filter.Eq(r => r.RepoName, repoFullName) &
                     Builders<Repo>.Filter.Eq(r => r.Branch, branch);
        var repo = await collection.Find(filter).FirstOrDefaultAsync();
        return repo;
    }

    public async Task<List<Repo>?> GetRepos()
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");
        return await collection.Find(_ => true).ToListAsync();
    }

    public async Task<List<Build>?> GetRepoBuildList(string repoId)
    {
        var collection = _dbContextProvider.GetCollection<Build>("Builds");
        var filter = Builders<Build>.Filter.Eq(r => r.RepoId, repoId);
        return await collection.Find(filter).ToListAsync();
    }

    public async Task<IReadOnlyList<RepoWithBuildsResponse>> GetReposWithBuildsAsync(string projectId)
    {
        CancellationToken ct = default;
        var blocksUserId = BlocksContext.GetContext().UserId;
        var repoCollection = _dbContextProvider.GetCollection<Repo>("Repos");
        var buildsCollection = _dbContextProvider.GetCollection<Build>("Builds");
        var pipeline = repoCollection.Aggregate()                        // FROM repos
            .Match(r => r.BlocksUserId == blocksUserId &&
                        r.ProjectId == projectId)          // only this user
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
            // var existingRepo = await collection.Find(r => r.Name == repo.Name).FirstOrDefaultAsync();
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

    public async Task<BulkOperationSummary> UpdateRepoDomain(RepoDomainUpdateRequest request)
    {
        var collection = _dbContextProvider.GetCollection<Repo>("Repos");

        var bulkOps = request.repoWithDomains
            .Where(rd => !string.IsNullOrWhiteSpace(rd.RepoId) && !string.IsNullOrWhiteSpace(rd.CustomDeploymentDomain))
            .Select(rd => new UpdateOneModel<Repo>(
                Builders<Repo>.Filter.Eq(r => r.ItemId, rd.RepoId) &
                Builders<Repo>.Filter.Eq(r => r.ProjectId, request.ProjectKey),
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
}