using Blocks.Genesis;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using FluentValidation;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Services;
using Microsoft.Extensions.Logging;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using System.Text.Json;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Shared.Utilities;

namespace Devops.DomainService.Deployment.Services;

public class BuildService : IBuildService
{
    private readonly ILogger<BuildService> _logger;
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly PipelineRunService _pipelineRunService;
    private readonly IGithubWebhookService _githubWebhookService;
    private readonly IVersionControlService _githubService;
    private readonly IValidator<RepoDomainUpdateRequest> _repoDomainUpdateRequestValidator;
    private readonly IMessageClient _messageClient;

    public BuildService(
                        ILogger<BuildService> logger,   
                        IBuildRepository buildRepository,
                        IRepoRepository repoRepository,
                        IVersionControlService githubService,
                        PipelineRunService pipelineRunService,
                        IGithubWebhookService githubWebhookService,
                        IValidator<RepoDomainUpdateRequest> repoDomainUpdateRequestValidator,
                        IMessageClient messageClient)
    {
        _logger = logger;
        _buildRepository = buildRepository;
        _repoRepository = repoRepository;
        _repoDomainUpdateRequestValidator = repoDomainUpdateRequestValidator;
        _githubService = githubService;
        _pipelineRunService = pipelineRunService;
        _githubWebhookService = githubWebhookService;
        _messageClient = messageClient;
    }

    public async Task<BuildResponse> Build(BuildRequest request, Repo? repo = null)
    {
        _logger.LogInformation("Build(): Starting build process for repo.");

        try
        {
            var blocksContext = BlocksContext.GetContext();
            var tenantId = string.IsNullOrWhiteSpace(blocksContext.TenantId) ? repo.ProjectId : blocksContext.TenantId;
            var blocksUserId = string.IsNullOrWhiteSpace(blocksContext.UserId) ? repo.CreatedBy : blocksContext.UserId;
            var (pipelineRunNameGuid, buildImageName, paramNamespace, errorMessage) = await _pipelineRunService.CreateNamespaceAsync(repo);
         
            if (pipelineRunNameGuid == null || buildImageName == null) 
            {
                _logger.LogInformation($"Failed to initiate pipeline.");
                return new BuildResponse
                {
                    Message = $"Failed to initiate pipeline. {errorMessage}",
                    IsSuccess = false,
                    StatusCode = HttpStatusCode.BadRequest
                };
            }
            var webhook = await _githubWebhookService.CreateWebhook(repo);
            var repoUpdate = await this.RepositoryUpdateForBuild(repo, request, webhook, paramNamespace);

            if (!repoUpdate)
            {
                // The namespace is the only handle the delete path will ever have on this deployment, so a
                // failed write is worth shouting about even though the pipeline itself is already running.
                _logger.LogError(
                    "Failed to persist deployment namespace '{ParamNamespace}' for repo {RepoId}. Deleting this deployment from the product will not be possible until it is redeployed.",
                    paramNamespace, repo.ItemId);
            }

            Build build = await SaveBuild(repo, request, buildImageName, blocksUserId, pipelineRunNameGuid);


            try
            {
                PostBuildQueue postBuildQueue = new PostBuildQueue
                {
                    ProjectKey = build.ProjectId,
                    PipelineRunName = build.PipelineRunName,
                    PipelineType = PipelineTypes.RepoDeployment,
                    PipelineEventType = PipelineEventTypes.RetrieveLog
                };
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue> { ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER, Payload = postBuildQueue});
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to push data to queue. Error: {ex.Message}");
            }

            BuildResponse buildResponse = new BuildResponse
            {
                buildId = build.ItemId,
                Message = "Pipeline created successfully",
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            };
            return buildResponse;
        }
        catch (Exception e)
        {
            _logger.LogError($"Internal server error: {e.Message}");
            return new BuildResponse
            {
                Message = e.Message,
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest
            };
        }
    }

    /// <summary>
    /// Tears a deployment down completely: cancels any in-flight build, deletes the Kubernetes namespace the
    /// deployment owns, then clears the recorded namespace. The namespace acted on is only ever the one
    /// captured at deploy time - it is never recomputed or derived.
    /// </summary>
    public async Task<BaseApiResponse> DeleteDeployment(string repoId)
    {
        if (string.IsNullOrWhiteSpace(repoId))
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = "Repo id is required"
            };
        }

        var blocksContext = BlocksContext.GetContext();
        var tenantId = blocksContext?.TenantId;
        var blocksUserId = blocksContext?.UserId;

        var repo = await _repoRepository.GetRepo(repoId, tenantId);
        if (repo is null)
        {
            // 404 rather than 403 so a caller cannot probe for another tenant's repositories.
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.NotFound,
                Message = "Repository not found."
            };
        }

        var namespaceName = repo.DeployedNamespace;

        if (string.IsNullOrWhiteSpace(namespaceName))
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = "This deployment has no recorded namespace. Redeploy the repository before deleting."
            };
        }

        if (PipelineRunService.IsProtectedNamespace(namespaceName))
        {
            _logger.LogError(
                "Refused to delete protected namespace '{NamespaceName}' recorded on repo {RepoId}.",
                namespaceName, repoId);
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = $"Refusing to delete protected namespace '{namespaceName}'."
            };
        }

        // Cancel first. A namespace deleted underneath a running pipeline gets recreated by its deploy-app
        // step, leaving a live deployment the product believes is gone and can no longer reach.
        var (cancelledBuilds, cancelFailure) = await CancelInFlightBuilds(repoId, tenantId);
        if (cancelFailure is not null)
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = cancelFailure
            };
        }

        var (deleted, alreadyGone, deleteError) = await _pipelineRunService.DeleteNamespaceAsync(namespaceName);
        if (!deleted)
        {
            _logger.LogError(
                "Delete deployment failed. user={BlocksUserId} tenant={TenantId} repo={RepoId} namespace={NamespaceName} outcome=k8s-rejected reason={DeleteError}",
                blocksUserId, tenantId, repoId, namespaceName, deleteError);
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = $"Failed to delete deployment: {deleteError}"
            };
        }

        var cleared = await _repoRepository.ClearDeployedNamespace(repoId, tenantId, EventStatus.DELETED);
        if (!cleared)
        {
            _logger.LogError(
                "Delete deployment partially failed. user={BlocksUserId} tenant={TenantId} repo={RepoId} namespace={NamespaceName} outcome=db-write-failed",
                blocksUserId, tenantId, repoId, namespaceName);
            return new BaseApiResponse
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = "The deployment was removed from the cluster but its record could not be updated. Retry the delete to reconcile."
            };
        }

        _logger.LogInformation(
            "Delete deployment succeeded. user={BlocksUserId} tenant={TenantId} repo={RepoId} namespace={NamespaceName} alreadyGone={AlreadyGone} cancelledBuilds={CancelledBuilds}",
            blocksUserId, tenantId, repoId, namespaceName, alreadyGone, string.Join(",", cancelledBuilds));

        return new BaseApiResponse
        {
            IsSuccess = true,
            StatusCode = HttpStatusCode.OK,
            Message = DeleteOutcomeMessage(alreadyGone, cancelledBuilds.Count),
            Data = new
            {
                RepoId = repoId,
                Namespace = namespaceName,
                AlreadyGone = alreadyGone,
                CancelledBuilds = cancelledBuilds
            }
        };
    }

    private static string DeleteOutcomeMessage(bool alreadyGone, int cancelledCount)
    {
        if (alreadyGone)
            return "Deployment was already deleted.";

        return cancelledCount > 0
            ? "In-progress build cancelled. Deployment deletion started."
            : "Deployment deletion started.";
    }

    /// <summary>
    /// Cancels every build of this repo that has not reached a terminal status.
    /// </summary>
    /// <returns>The PipelineRuns actually cancelled, and a failure message if any cancellation was rejected.</returns>
    private async Task<(List<string> Cancelled, string Failure)> CancelInFlightBuilds(string repoId, string tenantId)
    {
        var cancelled = new List<string>();

        var builds = await _buildRepository.GetBuilds(repoId);
        if (builds is null || builds.Count == 0)
            return (cancelled, null);

        var inFlightRunNames = builds
            .Where(build => !string.IsNullOrWhiteSpace(build.PipelineRunName)
                            && !PipeLineTaskConstants.TermialStatus.Contains(build.Status, StringComparer.OrdinalIgnoreCase))
            .Select(build => build.PipelineRunName)
            .ToList();

        foreach (var pipelineRunName in inFlightRunNames)
        {
            // Ask before cancelling. A build record whose status was never advanced to a terminal value
            // looks in-flight forever, and cancelling it would demand `patch` on pipelineruns for a run
            // that finished long ago. Reading only needs `get`, which the status polling already uses.
            var (isRunning, stateError) = await _pipelineRunService.IsPipelineRunRunningAsync(pipelineRunName);

            if (stateError is not null)
            {
                // Deleting the namespace without knowing whether a pipeline is live risks it being
                // recreated by deploy-app, so an unreadable state stops the delete just like a failed cancel.
                return (cancelled, $"Could not determine whether the build '{pipelineRunName}' is still running: {stateError}. Deployment was not deleted.");
            }

            if (!isRunning)
            {
                // Finished or already reaped. Its recorded status is merely stale, and we cannot tell what it
                // finished as, so leave it rather than mislabelling a success as cancelled.
                continue;
            }

            var (success, alreadyGone, error) = await _pipelineRunService.CancelPipelineRunAsync(pipelineRunName);

            if (!success)
            {
                return (cancelled, $"Could not cancel the in-progress build '{pipelineRunName}': {error}. Deployment was not deleted.");
            }

            if (alreadyGone)
            {
                // It finished between the check and the cancel - nothing was running, nothing to relabel.
                continue;
            }

            await _buildRepository.UpdateBuildStatus(pipelineRunName, EventStatus.CANCELLED, tenantId);
            cancelled.Add(pipelineRunName);
        }

        return (cancelled, null);
    }

    public async Task<Build?> SaveBuild(Repo repo, BuildRequest request, string buildImageName, string blocksUserId, string pipelineRunNameGuid)
    {
        var build = new Build
        {
            ItemId = Guid.NewGuid().ToString(),
            RepoId = repo.ItemId,
            RepoName = repo.RepoName,
            RepoUrl = repo.RepoUrl,
            Branch = request.branch,
            ImageName = buildImageName,
            BlocksUserId = blocksUserId,
            PipelineRunName = pipelineRunNameGuid,
            CreatedDate = DateTime.UtcNow,
            LastUpdatedDate = DateTime.UtcNow,
            CreatedBy = blocksUserId,
            DefaultDeploymentUrl = repo.DefaultDeploymentUrl,
            CustomDeploymentUrl = repo.CustomDeploymentUrl,
            ProjectId = repo.ProjectId,
            ProjectName = repo.ProjectName
        };
        await _buildRepository.SaveBuild(build);

        return build;
    }

    public async Task<Build?> GetBuildWithRepo(string buildId)
    {
        var builds = await _buildRepository.GetBuild(buildId);
        if (builds != null)
            return builds;
        return null;
    }

    public async Task<IReadOnlyList<RepoWithBuildsResponse>> GetRepos(string projectId)
    {
        var result = await _repoRepository.GetReposWithBuildsAsync(projectId);
        return result;
    }


    public async Task<BaseApiResponse> UpdateRepo(RepoUpdateRequest request)
    {
        Repo repo = await _repoRepository.GetRepo(request.RepoId);
        if (repo != null) 
        {
            if (!string.IsNullOrWhiteSpace(request.HostingProviderId) && !string.IsNullOrWhiteSpace(request.RegionId) && !string.IsNullOrWhiteSpace(request.MachineConfigId))
            request.deploySettings = await _repoRepository.GetDeploySettings(request.HostingProviderId, request.RegionId, request.MachineConfigId);

            if (!string.IsNullOrWhiteSpace(request.DeploymentType))
            {
                if(string.Equals(request.DeploymentType, RepoDeploymentType.Auto, StringComparison.OrdinalIgnoreCase))
                {
                    request.DeploymentType = RepoDeploymentType.Auto;
                }
                else
                {
                    request.DeploymentType = RepoDeploymentType.Manual;
                }
            }
            var result = await _repoRepository.UpdateRepo(request);

            if (result)
            {
                await RepoWebhookUpdate(request,repo);
                return new BaseApiResponse()
                {
                    IsSuccess = true,
                    Message = "Repository updated successfully.",
                    StatusCode = HttpStatusCode.OK
                };
            }
            return new BaseApiResponse()
            {
                IsSuccess = true,
                Message = "Failed to update.",
                StatusCode = HttpStatusCode.OK
            };
        }

        return new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Repository not found.",
            StatusCode = HttpStatusCode.BadRequest
        };
    }


    public async Task<BuildResponse> ManualBuild(RepoBuildRequest request)
    {
        Repo repo = await _repoRepository.GetRepo(request.RepoId);
        if (repo != null)
        {
            BuildRequest buildRequest = new BuildRequest()
            {
                repoName = repo.RepoName,
                repoUrl = repo.RepoUrl,
                branch = repo.Branch,
                deploymentUrl = repo.DefaultDeploymentUrl,
                projectName = repo.ProjectName,
                hostingProviderId = repo?.DeploySettings?.HostingProvider.Id,
                regionId = repo?.DeploySettings?.Region.Id,
                machineConfigId = repo?.DeploySettings?.MachineConfig.Id,
                deploymentType = repo.DeploymentType
            };
            return await Build(buildRequest, repo);
        }
        return new BuildResponse
        {
            Message = "Repo not found.",
            IsSuccess = false, 
            StatusCode = HttpStatusCode.OK
        };
    }

    public async Task<BuildResponse> RunBuild(RepoBuildRequest request)
    {
        try
        {
            Repo repo = await _repoRepository.GetRepo(request.RepoId);

            if (repo != null)
            {
                var (branchExists, errorMessage) = await _githubService.GetRepoBranchByName(repo.RepoName, repo.Branch);
                if (!branchExists)
                {
                    return new BuildResponse
                    {
                        Message = $"Failed to initiate build. {errorMessage}",
                        IsSuccess = false,
                        StatusCode = HttpStatusCode.BadRequest
                    };
                }
                BuildRequest buildRequest = new BuildRequest()
                {
                    repoName = repo.RepoName,
                    repoUrl = repo.RepoUrl,
                    branch = repo.Branch,
                    deploymentUrl = repo.DefaultDeploymentUrl,
                    projectName = repo.ProjectName,
                    hostingProviderId = repo?.DeploySettings?.HostingProvider?.Id ?? request.hostingProviderId,
                    regionId = repo?.DeploySettings?.Region?.Id ?? request.regionId,
                    machineConfigId = repo?.DeploySettings?.MachineConfig?.Id ?? request.machineConfigId,
                    deploymentType = repo.DeploymentType
                };
                return await Build(buildRequest, repo);
            }
            return new BuildResponse
            {
                Message = "Repo not found.",
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest
            };
        }
        catch (Exception ex)
        {
            return new BuildResponse
            {
                IsSuccess = false,
                Message = ex.Message,
                StatusCode = HttpStatusCode.BadRequest
            };
        }
        
    }
    public async Task<BaseApiResponse> UpdateRepoDomain(RepoDomainUpdateRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(BlocksContext.GetContext()?.TenantId))
            {
                return new BuildResponse
                {
                    IsSuccess = false,
                    Message = "Tenant context not found.",
                    StatusCode = HttpStatusCode.BadRequest
                };
            }

            var validationResult = await _repoDomainUpdateRequestValidator.ValidateAsync(request);

            if (!validationResult.IsValid)
            {
                return new BuildResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => string.IsNullOrWhiteSpace(e.PropertyName) ? "validation_error" : e.PropertyName, e => e.ErrorMessage)
                };
            }

            List<RepoCustomDomain> repoCustomDomains = new List<RepoCustomDomain>();

            repoCustomDomains = await TransformToRepoCustomDomains(request);
            var saveresult = await _repoRepository.UpsertRepoCustomDomainsAsync(repoCustomDomains);

            var bulkUpdateResult = await _repoRepository.UpdateRepoDomain(request);
            if (saveresult.IsAcknowledged && bulkUpdateResult.IsAcknowledged)
            {
                return new BuildResponse
                {
                    IsSuccess = true,
                    Message = $"Modified: {bulkUpdateResult.ModifiedCount} repository custom domains",
                    StatusCode = HttpStatusCode.OK
                };
            }
            return new BuildResponse
            {
                IsSuccess = false,
                Message = "Something went wrong.",
                StatusCode = HttpStatusCode.OK
            };
        }
        catch (Exception ex)
        {
            return new BuildResponse
            {
                IsSuccess = false,
                Message = ex.Message,
                StatusCode = HttpStatusCode.BadRequest
            };
        }
    }

    public async Task<List<RepoCustomDomain>> TransformToRepoCustomDomains(RepoDomainUpdateRequest request)
    {
        var result = new List<RepoCustomDomain>();

        var projectId = BlocksContext.GetContext()?.TenantId;
        if (request?.repoWithDomains == null || string.IsNullOrWhiteSpace(projectId))
            return result;

        var existingDomains = await _repoRepository.GetRepoCustomDomainsAsync(request.repoWithDomains, projectId);

        foreach (var repo in request.repoWithDomains)
        {
            if (string.IsNullOrWhiteSpace(repo.RepoId) || string.IsNullOrWhiteSpace(repo.CustomDeploymentDomain))
                continue;

            var existing = existingDomains.FirstOrDefault(e =>
                e.RepoId == repo.RepoId &&
                e.ProjectId == projectId &&
                e.ProjectEnv == request.ProjectEnv
            );

            if (existing != null)
            {
                existing.CustomDeploymentDomain = repo.CustomDeploymentDomain;
                result.Add(existing);
            }
            else
            {
                var domainEntry = new RepoCustomDomain
                {
                    ItemId = Guid.NewGuid().ToString(),
                    ProjectId = projectId,
                    ProjectEnv = request.ProjectEnv,
                    RepoId = repo.RepoId,
                    RepoUrl = repo.RepoUrl,
                    CustomDeploymentDomain = repo.CustomDeploymentDomain
                };
                result.Add(domainEntry);
            }
        }
        return result;
    }

    private async Task<bool> RepositoryUpdateForBuild(Repo repo, BuildRequest request, GithubWebhook webhook, string paramNamespace = null)
    {
        DeploySettings deploySettings = null;

        if (repo.DeploySettings == null)
        {
            deploySettings = await _repoRepository.GetDeploySettings(
                request.hostingProviderId,
                request.regionId,
                request.machineConfigId
            );
            repo.DeploySettings = deploySettings;
        }
        repo.LastDeploymentDate = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(paramNamespace))
        {
            // Stored verbatim from the builder. Never recompute this later - see PipelineRunSettings.ParamNamespace.
            repo.DeployedNamespace = paramNamespace;
        }

        if (webhook is not null)
        {
            repo.GithubWebhook = webhook;
        }
        return await _repoRepository.UpdateRepo(repo);
    }

    public async Task<BuildResponse> HandleWebhookEventAsync(string eventType, string rawJson, string tenantId)
    {
        switch (eventType)
        {
            case "push":

                var pushEvent = JsonSerializer.Deserialize<PushEvent>(rawJson)!;
                string[] parts = pushEvent.Ref.Split('/');
                string branch = parts[parts.Length - 1];

                Repo repo = await _repoRepository.GetRepoByBranch(tenantId, pushEvent.repository.fullName, branch);
                if (repo is not null && repo.DeploymentType == RepoDeploymentType.Auto)
                {
                    BuildRequest buildRequest = new BuildRequest()
                    {
                        repoName = repo.RepoName,
                        repoUrl = repo.RepoUrl,
                        branch = repo.Branch,
                        deploymentUrl = repo.DefaultDeploymentUrl,
                        projectName = repo.ProjectName,
                        hostingProviderId = repo?.DeploySettings?.HostingProvider.Id,
                        regionId = repo?.DeploySettings?.Region.Id,
                        machineConfigId = repo?.DeploySettings?.MachineConfig.Id,
                        deploymentType = repo.DeploymentType
                    };
                    _logger.LogInformation($"{pushEvent.commits?.Count ?? 0} commit(s) pushed to {pushEvent.Ref} in {pushEvent.repository.fullName} by {pushEvent.pusher.name}");
                    await SaveWbhook(rawJson, repo, tenantId);
                    return await Build(buildRequest, repo);
                }
                break;

            default:
                _logger.LogInformation($"Unhandled event type: {eventType}");
                break;
        }

        return new BuildResponse
        {
            Message = "Build not triggered.",
            IsSuccess = false,
            StatusCode = HttpStatusCode.OK
        }; ;
    }


    public async Task<bool> RepoWebhookUpdate(RepoUpdateRequest request, Repo repo)
    {
        var updatedRepo = await _repoRepository.GetRepo(repo.ItemId);
        if(string.Equals(request.DeploymentType, RepoDeploymentType.Auto, StringComparison.OrdinalIgnoreCase))
        {
            return await _githubWebhookService.UpdateWebhookStatus(updatedRepo, true);
        }
        if (string.Equals(request.DeploymentType, RepoDeploymentType.Manual, StringComparison.OrdinalIgnoreCase))
        {
            return await _githubWebhookService.UpdateWebhookStatus(updatedRepo, false);
        }
        return false;
    }

    public async Task<bool> SaveWbhook(string rawJson, Repo repo, string tenantId)
    {
        try
        {
            _logger.LogInformation($"Saving webhook information.");
            RepositoryWebhook repoSitoryWebhook = FromWebhookPayload(rawJson, repo);
            bool result = await _buildRepository.SaveWebhook(repoSitoryWebhook, tenantId);
            _logger.LogInformation($"Saved webhook information successfully");
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to save webhook information for {ex.Message}");
            return false;
        }
    }

    private static RepositoryWebhook FromWebhookPayload(string jsonPayload, Repo repo)
    {
        using var doc = JsonDocument.Parse(jsonPayload);
        var root = doc.RootElement;

        var repoWebhook = new RepositoryWebhook
        {
            ItemId = Guid.NewGuid().ToString(),
            RepoId = repo.ItemId,
            RepoUrl = root.GetProperty("repository").GetProperty("html_url").GetString(),

            Ref = root.GetProperty("ref").GetString(),
            BeforeSha = root.GetProperty("before").GetString(),
            AfterSha = root.GetProperty("after").GetString(),

            HeadCommitSha = root.GetProperty("head_commit").GetProperty("id").GetString(),
            HeadCommitMessage = root.GetProperty("head_commit").GetProperty("message").GetString(),
            HeadCommitTimestamp = root.GetProperty("head_commit").GetProperty("timestamp").GetDateTime(),
            HeadCommitUrl = root.GetProperty("head_commit").GetProperty("url").GetString(),

            AuthorName = root.GetProperty("head_commit").GetProperty("author").GetProperty("name").GetString(),
            AuthorEmail = root.GetProperty("head_commit").GetProperty("author").GetProperty("email").GetString(),

            CommitterName = root.GetProperty("head_commit").GetProperty("committer").GetProperty("name").GetString(),
            CommitterEmail = root.GetProperty("head_commit").GetProperty("committer").GetProperty("email").GetString(),

            PusherName = root.GetProperty("pusher").GetProperty("name").GetString(),
            PusherEmail = root.GetProperty("pusher").GetProperty("email").GetString(),
            CreatedDate = DateTime.UtcNow,
            LastUpdatedDate = DateTime.UtcNow
        };

        return repoWebhook;
    }
}
