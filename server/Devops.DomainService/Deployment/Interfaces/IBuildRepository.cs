using Blocks.Genesis.Entities.Release;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
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

    /// <summary>
    /// Replaces the build's <c>SastReport</c> only while it is still <c>Pending</c> with <paramref name="expectedAttempts"/>
    /// attempts, so a duplicate or stale capture message changes nothing. Sets no other field.
    /// </summary>
    /// <returns>Whether this call changed the report.</returns>
    public Task<bool> TrySaveSastReport(string buildId, int expectedAttempts, SastReport report, string tenantId);

    /// <inheritdoc cref="TrySaveSastReport"/>
    public Task<bool> TrySaveScaReport(string buildId, int expectedAttempts, ScaReport report, string tenantId);

    /// <summary>
    /// Ends one report of the build with <paramref name="pipelineRunName"/> if it is still <c>Pending</c>, setting only
    /// its status and message.
    /// </summary>
    /// <returns>The build's id, creator, repo and project when this call ended the report; otherwise null.</returns>
    public Task<Build?> TryEndPendingReport(string pipelineRunName, AnalysisReportKind kind, string status, string message, string tenantId);

    /// <inheritdoc cref="TryEndPendingReport(string, AnalysisReportKind, string, string, string)"/>
    public Task<Build?> TryEndPendingReport(string pipelineRunName, AnalysisReportKind kind, string status, string message, Tenant project);

}
