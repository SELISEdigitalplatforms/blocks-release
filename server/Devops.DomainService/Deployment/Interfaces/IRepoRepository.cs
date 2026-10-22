using Blocks.Genesis.Entities.Release;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Models;

namespace Devops.DomainService.Deployment.Interfaces;

public interface IRepoRepository
{
    public Task<Repo> GetRepo(string repoId);
    /// <summary>The repo as the caller may see it: properties a View column rule hides are cleared. Never save it back.</summary>
    public Task<Repo?> GetRepoForView(string repoId);
    public Task<Repo> GetRepo(string repoId, string tenantId);
    public Task<Repo?> GetRepoByBranch(string tenantId, string repoName, string branch);
    public Task<List<Repo>?> GetRepos();
    public Task<List<Build>?> GetRepoBuildList(
        string RepoId,
        string? branch,
        int pageNumber,
        int pageSize);

    /// <summary>
    /// How many builds <see cref="GetRepoBuildList"/> pages over for the same repository and
    /// branch. A paged client cannot know how many pages exist without it.
    /// </summary>
    public Task<long> GetRepoBuildCount(string RepoId, string? branch);
    public Task SaveRepo(Repo repo);
    public Task<bool> UpdateRepo(RepoUpdateRequest repo);
    public Task<bool> UpdateRepo(RepoUpdateRequest repo,string tenantId);
    public Task<bool> UpdateRepo(Repo repo);
    public Task<bool> UpdateRepo(Repo repo, string tenantId);
    /// <summary>Checks the repo against the Repo schema's validation rules before anything is written; throws when one is refused.</summary>
    public Task CheckRepoAsync(Repo repo, string tenantId);
    public Task<bool> ClearDeployedNamespace(string repoId, string tenantId, string lastDeploymentStatus);
    public Task<bool> ClearDeployedNamespace(string repoId, Tenant project, string lastDeploymentStatus);
    public Task<List<Repo>> GetProjectRepos(string tenantId, string? resourceId = null);
    public Task<List<Repo>> GetProjectRepos(Tenant project, string? resourceId = null);
    public Task<bool> ArchiveRepo(string repoId, string tenantId);
    public Task<bool> ArchiveRepo(string repoId, Tenant project);
    public Task<IReadOnlyList<RepoWithBuildsResponse>> GetReposWithBuildsAsync(string projectId);
    public Task<DeploySettings> GetDeploySettings(string hostingProviderId, string regionId, string machineConfigId);
    /// <summary>Checks the domains against the Repo schema's validation rules before anything is written; throws when one is refused.</summary>
    public Task<List<RepoWithDomain>> CheckRepoDomainsAsync(RepoDomainUpdateRequest request);
    public Task<BulkOperationSummary> UpdateRepoDomain(RepoDomainUpdateRequest repowithdomain);
    public Task<List<RepoCustomDomain>> GetRepoCustomDomainsAsync(List<RepoWithDomain> domains, string pojectId);
    public Task<bool> GetRepoCustomDomainExists(List<RepoWithDomain> domains);
    public Task<BulkOperationSummary> UpsertRepoCustomDomainsAsync(List<RepoCustomDomain> repoCustomDomains);
    public Task<List<string>> GetProjectPeopleList(string tenantId);
    public Task<bool> UpdateRepoDependencyTrackProjectUuid(string repoId, string dependencyTrackProjectUuid, string tenantId);
    public Task<bool> UpdateRepoSecretStoreItemId(string repoId, string secretStoreItemId, string tenantId);



}
