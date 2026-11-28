using System.Net;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services;

/// <inheritdoc cref="IDeploymentModeService"/>
public class DeploymentModeService : IDeploymentModeService
{
    /// <summary>Appended to every deploy refusal: a Blocks Cloud based deploy needs no webhook.</summary>
    public const string DeployHint = "To deploy now, switch to Blocks Cloud based deployment in Settings.";

    private const string WebhookErrorKey = "webhook";
    private const string WebhookDetailErrorKey = "webhookDetail";

    private readonly ILogger<DeploymentModeService> _logger;
    private readonly IRepoRepository _repoRepository;
    private readonly IGithubWebhookService _githubWebhookService;

    public DeploymentModeService(
        ILogger<DeploymentModeService> logger,
        IRepoRepository repoRepository,
        IGithubWebhookService githubWebhookService)
    {
        _logger = logger;
        _repoRepository = repoRepository;
        _githubWebhookService = githubWebhookService;
    }

    /// <summary>"auto" in any case is Git based; any other value is Blocks Cloud based, as Settings has always normalized it.</summary>
    public static string Normalize(string? deploymentType) =>
        string.Equals(deploymentType, RepoDeploymentType.Auto, StringComparison.OrdinalIgnoreCase)
            ? RepoDeploymentType.Auto
            : RepoDeploymentType.Manual;

    /// <summary>The English text of a reason code (spec §6.4), with the repository's full name and GitHub's message filled in.</summary>
    public static string MessageFor(string? code, string? repoName, string? detail) => code switch
    {
        WebhookCodes.NotConnected => "Connect your GitHub account to use Git based deployment.",
        WebhookCodes.TokenInvalid => "Your GitHub connection has expired. Reconnect GitHub and try again.",
        WebhookCodes.RepoNotVisible => $"Your GitHub account can't access {repoName}.",
        WebhookCodes.Permission =>
            $"Your GitHub account can't manage webhooks on {repoName}. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.",
        WebhookCodes.Unreachable => "GitHub didn't respond. Try again in a moment.",
        _ => $"GitHub couldn't set up the webhook on {repoName}: {detail}",
    };

    /// <summary>The deploy answer when the pipeline did not start although Git based deployment was just switched on.</summary>
    public static string PipelineFailedAfterTurningAutoOn(string pipelineMessage) =>
        $"Git based deployment is now on, but the deployment couldn't start: {pipelineMessage}";

    public async Task<DeployModeStep> ApplyBeforeDeployAsync(Repo repo, string? requestedType, string tenantId, string? userId)
    {
        var storedAuto = IsAuto(repo.DeploymentType);
        var targetAuto = string.IsNullOrWhiteSpace(requestedType) ? storedAuto : IsAuto(Normalize(requestedType));

        if (targetAuto)
        {
            // A healthy Git based repository is trusted as stored: no GitHub call (budget P2).
            if (storedAuto && IsHookActive(repo))
                return DeployModeStep.Unchanged;

            // Always asked of GitHub when the mode changes, even with a hook stored as active: that flag can be stale.
            var turnedOn = await _githubWebhookService.SetActiveAsync(repo, true, tenantId, userId);
            if (!turnedOn.Ok)
                return new DeployModeStep(DeployRefusal(repo, turnedOn), null, false);
            if (storedAuto)
                return DeployModeStep.Unchanged;

            // The hook is on, but a deploy that could not store Git based would claim a switch that never
            // happened: the write's own failure is the answer and nothing starts (X8).
            if (!await SaveModeAsync(repo, RepoDeploymentType.Auto, tenantId))
                return new DeployModeStep(ModeNotSaved(), null, false);
            return new DeployModeStep(null, null, true);
        }

        if (!storedAuto)
            return DeployModeStep.Unchanged;

        // Turning Git based off never blocks a deploy: pushes to a Manual repository are ignored anyway. A mode
        // write that reports no change is not fatal here: the deploy writes the repository back whole later.
        await SaveModeAsync(repo, RepoDeploymentType.Manual, tenantId);
        repo.DeploymentType = RepoDeploymentType.Manual;
        var turnedOff = await _githubWebhookService.SetActiveAsync(repo, false, tenantId, userId);
        return new DeployModeStep(null, WarningFor(DeploymentWarning.WebhookStillActive, repo, turnedOff), false);
    }

    public async Task<RepoSettingsUpdateResponse> SaveSettingsAsync(Repo repo, RepoUpdateRequest request, string tenantId, string? userId)
    {
        var storedAuto = IsAuto(repo.DeploymentType);
        var targetAuto = string.IsNullOrWhiteSpace(request.DeploymentType) ? storedAuto : IsAuto(request.DeploymentType);

        if (targetAuto && !storedAuto)
        {
            // Git based is switched on only with a working hook: nothing is saved when GitHub refuses.
            var turnedOn = await _githubWebhookService.SetActiveAsync(repo, true, tenantId, userId);
            if (!turnedOn.Ok)
                return SettingsRefusal(repo, turnedOn);
            return await _repoRepository.UpdateRepo(request) ? SettingsSaved(null) : SettingsNotSaved();
        }

        if (!await _repoRepository.UpdateRepo(request))
            return SettingsNotSaved();

        if (!targetAuto && storedAuto)
        {
            var turnedOff = await _githubWebhookService.SetActiveAsync(repo, false, tenantId, userId);
            return SettingsSaved(WarningFor(DeploymentWarning.WebhookStillActive, repo, turnedOff));
        }

        if (targetAuto && !IsHookActive(repo))
        {
            // A Git based repository without a working hook is repaired on the way, best effort.
            var repaired = await _githubWebhookService.SetActiveAsync(repo, true, tenantId, userId);
            return SettingsSaved(WarningFor(DeploymentWarning.WebhookNotWorking, repo, repaired));
        }

        return SettingsSaved(null);
    }

    private static bool IsAuto(string? deploymentType) =>
        string.Equals(deploymentType, RepoDeploymentType.Auto, StringComparison.OrdinalIgnoreCase);

    private static bool IsHookActive(Repo repo) => repo.GithubWebhook?.Active == true;

    /// <summary>
    /// Saves the mode alone, and keeps it on the in-memory repository too: the deploy later writes that
    /// repository back whole, which must not undo the change.
    /// </summary>
    private async Task<bool> SaveModeAsync(Repo repo, string mode, string tenantId)
    {
        var saved = await _repoRepository.UpdateRepo(new RepoUpdateRequest { RepoId = repo.ItemId, DeploymentType = mode }, tenantId);
        if (saved)
            repo.DeploymentType = mode;
        else
            _logger.LogWarning("The deployment mode {Mode} of repository {RepoId} was not saved before the deploy.", mode, repo.ItemId);
        return saved;
    }

    private static BuildResponse ModeNotSaved() => new()
    {
        IsSuccess = false,
        StatusCode = HttpStatusCode.BadRequest,
        Message = "Failed to update.",
    };

    private static DeploymentWarning? WarningFor(string warningCode, Repo repo, WebhookOutcome outcome)
    {
        if (outcome.Ok)
            return null;
        var reasonText = MessageFor(outcome.Code, repo.RepoName, outcome.Detail);
        return new DeploymentWarning
        {
            Code = warningCode,
            Reason = outcome.Code ?? WebhookCodes.Failed,
            Message = warningCode == DeploymentWarning.WebhookStillActive
                ? $"Push deploys are off. The GitHub webhook on {repo.RepoName} is still active: {reasonText}"
                : $"Settings saved, but Git based deployment isn't working: {reasonText}",
            Detail = outcome.Detail,
        };
    }

    private static Dictionary<string, string> RefusalErrors(WebhookOutcome outcome)
    {
        var errors = new Dictionary<string, string> { [WebhookErrorKey] = outcome.Code ?? WebhookCodes.Failed };
        if (!string.IsNullOrWhiteSpace(outcome.Detail))
            errors[WebhookDetailErrorKey] = outcome.Detail;
        return errors;
    }

    private static BuildResponse DeployRefusal(Repo repo, WebhookOutcome outcome) => new()
    {
        IsSuccess = false,
        StatusCode = HttpStatusCode.BadRequest,
        Message = $"{MessageFor(outcome.Code, repo.RepoName, outcome.Detail)} {DeployHint}",
        Errors = RefusalErrors(outcome),
    };

    private static RepoSettingsUpdateResponse SettingsRefusal(Repo repo, WebhookOutcome outcome) => new()
    {
        IsSuccess = false,
        StatusCode = HttpStatusCode.BadRequest,
        Message = MessageFor(outcome.Code, repo.RepoName, outcome.Detail),
        Errors = RefusalErrors(outcome),
    };

    private static RepoSettingsUpdateResponse SettingsSaved(DeploymentWarning? warning) => new()
    {
        IsSuccess = true,
        StatusCode = HttpStatusCode.OK,
        Message = "Repository updated successfully.",
        Warning = warning,
    };

    private static RepoSettingsUpdateResponse SettingsNotSaved() => new()
    {
        IsSuccess = false,
        StatusCode = HttpStatusCode.BadRequest,
        Message = "Failed to update.",
    };
}
