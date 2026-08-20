using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Models;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services;

/// <summary>
/// Reacts to a project or repository delete that has already happened in blocks-os. Nothing here
/// deletes a project - blocks-os owns project lifecycle and soft-deletes them. This service only
/// settles what this service owns: it destroys the deployments those repositories were running and
/// archives the repositories so they leave the repo list.
///
/// TenantGroupId is mandatory and the other two only narrow it:
/// <list type="bullet">
/// <item><description>group -> every repository of every project in the group</description></item>
/// <item><description>group + project -> every repository of that one project</description></item>
/// <item><description>group + project + resource -> that single repository</description></item>
/// <item><description>group + resource -> that resource's repository in every project of the group</description></item>
/// </list>
/// Anything without a group - a bare ProjectId, a bare ResourceId, or an empty message - is a no-op.
/// The group is what says which set of tenant databases this message is even allowed to reach, so a
/// message missing it is dropped rather than guessed at.
/// </summary>
public class DeploymentTeardownService : IDeploymentTeardownService
{
    private readonly ILogger<DeploymentTeardownService> _logger;
    private readonly ITenantLookupRepository _tenantLookupRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly BuildService _buildService;
    private readonly ISecretService _secretService;

    public DeploymentTeardownService(
        ILogger<DeploymentTeardownService> logger,
        ITenantLookupRepository tenantLookupRepository,
        IRepoRepository repoRepository,
        BuildService buildService,
        ISecretService secretService)
    {
        _logger = logger;
        _tenantLookupRepository = tenantLookupRepository;
        _repoRepository = repoRepository;
        _buildService = buildService;
        _secretService = secretService;
    }

    public async Task<DeploymentTeardownSummary> TearDownAsync(ProjectDeleteQueue message)
    {
        var summary = new DeploymentTeardownSummary();

        var tenantGroupId = Normalize(message?.TenantGroupId);
        var projectId = Normalize(message?.ProjectId);
        var resourceId = Normalize(message?.ResourceId);

        var projectIds = await ResolveProjectsAsync(tenantGroupId, projectId);
        if (projectIds.Count == 0)
        {
            _logger.LogInformation(
                "Deployment teardown message resolved to no project, nothing to do. group={TenantGroupId} project={ProjectId} resource={ResourceId}",
                tenantGroupId, projectId, resourceId);
            return summary;
        }

        foreach (var tenantId in projectIds)
        {
            summary.ProjectsVisited++;
            await TearDownProjectAsync(tenantId, resourceId, summary);
        }

        _logger.LogInformation(
            "Deployment teardown finished. group={TenantGroupId} project={ProjectId} resource={ResourceId} projects={ProjectsVisited} repos={ReposMatched} deploymentsDeleted={DeploymentsDeleted} archived={ReposArchived} failures={Failures}",
            tenantGroupId, projectId, resourceId, summary.ProjectsVisited, summary.ReposMatched,
            summary.DeploymentsDeleted, summary.ReposArchived, summary.Failures.Count);

        return summary;
    }

    /// <summary>
    /// Which tenant databases the message reaches. No group means no reachable database, whatever else
    /// the message carries. With a group, an explicit ProjectId narrows to that one project after it is
    /// checked to belong to the group. Soft-deleted projects are deliberately still in scope - they are
    /// the whole point of the message.
    /// </summary>
    private async Task<List<string>> ResolveProjectsAsync(string tenantGroupId, string projectId)
    {
        if (string.IsNullOrEmpty(tenantGroupId))
            return [];

        if (!string.IsNullOrEmpty(projectId))
        {
            var project = await _tenantLookupRepository.GetProjectAsync(projectId);

            if (project is null)
            {
                // blocks-os soft-deletes, so the record should still be there. If it is not, the caller
                // named this project explicitly, so act on it rather than dropping the message - the
                // repository read below is scoped to that tenant either way.
                _logger.LogWarning(
                    "Project {ProjectId} not found while checking it belongs to group {TenantGroupId}. Proceeding on the project id as given.",
                    projectId, tenantGroupId);
                return [projectId];
            }

            if (!string.Equals(project.TenantGroupId, tenantGroupId, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "Ignoring deployment teardown: project {ProjectId} belongs to group {ActualGroupId}, not {TenantGroupId}.",
                    projectId, project.TenantGroupId, tenantGroupId);
                return [];
            }

            return [projectId];
        }

        var projects = await _tenantLookupRepository.GetProjectsByGroupAsync(tenantGroupId);
        return projects.Select(project => project.TenantId)
                       .Where(tenantId => !string.IsNullOrWhiteSpace(tenantId))
                       .ToList();
    }

    private async Task TearDownProjectAsync(string tenantId, string resourceId, DeploymentTeardownSummary summary)
    {
        var repos = await _repoRepository.GetProjectRepos(tenantId, resourceId);

        // Archived repositories are in scope - blocks-os archives before it publishes - but one that is
        // both archived and holds no namespace was already settled by an earlier run. Skipping those
        // keeps a repeated group teardown from rewriting every repository the project ever had.
        var actionable = repos
            .Where(repo => !repo.IsArchived || !string.IsNullOrWhiteSpace(repo.DeployedNamespace))
            .ToList();

        if (actionable.Count == 0)
        {
            _logger.LogInformation(
                "Nothing left to tear down in project {ProjectId} (resource={ResourceId}, {RepoCount} repositories already settled).",
                tenantId, resourceId, repos.Count);
            return;
        }

        foreach (var repo in actionable)
        {
            summary.ReposMatched++;
            await TearDownRepoAsync(repo, tenantId, summary);
        }
    }

    /// <summary>
    /// A repository that was never deployed has no namespace to destroy and is archived directly.
    /// A teardown that fails leaves the repository unarchived on purpose: archiving it would hide a
    /// namespace that is still running from every list that could be used to retry.
    /// </summary>
    private async Task TearDownRepoAsync(Repo repo, string tenantId, DeploymentTeardownSummary summary)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(repo.DeployedNamespace))
            {
                // Passes the loaded repo, not its id. Resolving by id would go back through GetRepo,
                // which filters archived repositories out - and archived is the normal case here.
                var result = await _buildService.DeleteDeployment(repo, tenantId, repo.CreatedBy);

                if (!result.IsSuccess)
                {
                    var failure = $"{tenantId}/{repo.ItemId} ({repo.RepoName}): {result.Message}";
                    summary.Failures.Add(failure);
                    _logger.LogError(
                        "Failed to delete deployment during repo teardown, continuing. tenant={TenantId} repo={RepoId} namespace={Namespace} reason={Reason}",
                        tenantId, repo.ItemId, repo.DeployedNamespace, result.Message);
                    return;
                }

                summary.DeploymentsDeleted++;
            }

            if (await _repoRepository.ArchiveRepo(repo.ItemId, tenantId))
            {
                summary.ReposArchived++;

                // Strictly after the archive, and never inside it. Archiving is the load-bearing
                // step; a secret-store problem must not be able to undo or misreport it.
                await DeleteRepoSecretAsync(repo, tenantId, summary);
            }
            else
            {
                var failure = $"{tenantId}/{repo.ItemId} ({repo.RepoName}): archive write failed";
                summary.Failures.Add(failure);
                _logger.LogError(
                    "Deployment torn down but the repository could not be archived. tenant={TenantId} repo={RepoId}",
                    tenantId, repo.ItemId);
            }
        }
        catch (Exception ex)
        {
            // One unreachable cluster or one bad repository must not strand the rest of the group.
            summary.Failures.Add($"{tenantId}/{repo.ItemId} ({repo.RepoName}): {ex.Message}");
            _logger.LogError(ex,
                "Unexpected failure tearing down repository, continuing. tenant={TenantId} repo={RepoId}",
                tenantId, repo.ItemId);
        }
    }

    /// <summary>
    /// Soft-deletes an archived repository's secret set, best effort.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Has its own try/catch rather than relying on the caller's: an exception reaching the outer
    /// handler would record a repository that was archived successfully as a teardown failure, and
    /// would stop the remaining work for that repository. Here, the worst case is a live secret on
    /// a dead repository plus one entry in <c>Failures</c>.
    /// </para>
    /// <para>
    /// The delete is metadata-only inside the secrets package - the vault value is retained so the
    /// secret stays restorable - so this needs no Key Vault permission, only a resolvable context.
    /// </para>
    /// </remarks>
    private async Task DeleteRepoSecretAsync(Repo repo, string tenantId, DeploymentTeardownSummary summary)
    {
        // The overwhelming majority of repositories have never had secrets. Leaving early keeps
        // them on exactly the path they were on before this step existed - no context, no
        // service call, no log line.
        if (string.IsNullOrWhiteSpace(repo.SecretStoreItemId))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            // Fail closed. The secret store separates tenants by a TenantId filter alone, so a
            // guessed or defaulted tenant is worse than not deleting.
            RecordSecretFailure(repo, tenantId, summary, "no tenant on the message");
            return;
        }

        try
        {
            // A queue consumer has no HTTP request and therefore no ambient BlocksContext, and the
            // secrets package refuses to act without one by design. The synthesized identity is
            // what lands in the audit row's actor and in DeletedBy.
            await BlocksContext.ExecuteInContext(
                BuildWorkerContext(tenantId),
                () => _secretService.DeleteAsync(repo.SecretStoreItemId));

            summary.SecretsDeleted++;
        }
        catch (SecretStateException ex) when (
            string.Equals(ex.CurrentStatus, SecretStatuses.Deleted, StringComparison.Ordinal))
        {
            // Already deleted - a redelivered message, not a failure. The consumer deliberately
            // does not rethrow so redelivery is expected, and counting this would fill Failures
            // with noise and make HasFailures useless as a signal.
            _logger.LogInformation(ex,
                "Secret for repository {RepoId} was already deleted, nothing to do. tenant={TenantId}",
                repo.ItemId, tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to delete the secret for an archived repository, continuing. tenant={TenantId} repo={RepoId} secret={SecretId}",
                tenantId, repo.ItemId, repo.SecretStoreItemId);

            RecordSecretFailure(repo, tenantId, summary, ex.Message);
        }
    }

    private static void RecordSecretFailure(
        Repo repo,
        string tenantId,
        DeploymentTeardownSummary summary,
        string reason) =>
        summary.Failures.Add($"{tenantId}/{repo.ItemId} ({repo.RepoName}): secret delete failed - {reason}");

    /// <summary>
    /// The identity background secret work acts under. Recognisable on purpose, so an audit row
    /// written by teardown is not mistaken for a person's action.
    /// </summary>
    private static BlocksContext BuildWorkerContext(string tenantId) =>
        BlocksContext.Create(
            tenantId,
            roles: [],
            userId: WorkerUserId,
            isAuthenticated: true,
            requestUri: WorkerRequestUri,
            organizationId: DefaultOrganizationId,
            expireOn: DateTime.UtcNow.AddMinutes(5),
            email: null,
            permissions: [],
            userName: WorkerUserId,
            phoneNumber: null,
            displayName: WorkerUserId,
            oauthToken: null,
            originalTenantId: tenantId);

    private const string WorkerUserId = "blocks-release-worker";
    private const string WorkerRequestUri = "worker/project-delete";
    private const string DefaultOrganizationId = "default";

    private static string Normalize(string value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
}
