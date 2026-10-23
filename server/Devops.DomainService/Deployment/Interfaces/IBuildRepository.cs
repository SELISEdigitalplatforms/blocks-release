using Blocks.Genesis.Entities.Release;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Interfaces;

public interface IBuildRepository
{
    public Task<Build?> GetBuild(string buildId);
    public Task<Build?> GetBuild(string buildId, string tenantId);
    /// <summary>The build as the caller may see it: properties a View column rule hides are cleared. Never save it back.</summary>
    public Task<Build?> GetBuildForView(string buildId);
    public Task<List<Build>?> GetBuilds(string repoId, string tenantId);
    public Task<List<Build>?> GetBuilds(string repoId, Tenant project);
    public Task SaveBuild(Build pod);
    public Task SaveBuild(Build pod, string tenantId);
    public Task<Build?> UpdateBuild(Build pod);
    public Task<Build?> GetBuildByPipelineRunName(string pipelineRunName, string tenantId);

    public Task UpdateBuildEvents(string pipelineRunName, List<BuildEventResponse> buildEventResponses, string eventGroup, string eventStatus, string tenantId);
    public Task UpdateBuildStatus(string pipelineRunName, string eventStatus, string tenantId);
    public Task UpdateBuildStatus(string pipelineRunName, string eventStatus, Tenant project);
    public Task<List<HostingProvider>> GetHostingProviders();
    public Task<bool> SaveWebhook(RepositoryWebhook repositoryWebhook, string tenantId);
    public Task<bool> UpdateBuildDependencyTrackProjectId(string buildId, string dependencyTrackProjectId, string tenantId);

}
