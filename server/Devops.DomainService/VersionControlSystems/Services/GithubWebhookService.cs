using Blocks.Genesis.Entities.Release;
using Microsoft.Extensions.Configuration;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Rules;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Models.Response;
using Microsoft.Extensions.Logging;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Deployment.Models.Response;
using System.Net;
using System.Text.Json;
using Devops.DomainService.Shared.Services;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;

namespace Devops.DomainService.VersionControlSystems.Services;

public class GithubWebhookService : IGithubWebhookService
{
    /// <summary>Each webhook or permission call to GitHub is cancelled after this long (spec P7).</summary>
    public static readonly TimeSpan GithubCallTimeout = TimeSpan.FromSeconds(10);

    // GitHub's 422 message when a hook with the same URL is already on the repository.
    private const string HookAlreadyExists = "Hook already exists on this repository";
    // The detail of a change that failed for a reason other than GitHub's answer; never an exception message.
    private const string UnexpectedFailure = "Unexpected error";

    private static readonly JsonSerializerOptions GithubJson = new() { PropertyNameCaseInsensitive = true };

    private static readonly Dictionary<string, string> GithubHeaders = new()
    {
        { "Accept", "application/vnd.github.v3+json" },
        { "User-Agent", "BlocksDevOps" },
    };

    private readonly ILogger<GithubWebhookService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly ITokenRepository _tokenRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly ICloudBuildSecret _cloudBuildSecret;

    public GithubWebhookService(
                                ILogger<GithubWebhookService> logger,
                                IConfiguration configuration,
                                IHttpHelperServices httpHelperService,
                                ITokenRepository tokenRepository,
                                IRepoRepository repoRepository,
                                ICloudBuildSecret cloudBuildSecret
                                )

    {
        _logger = logger;
        _configuration = configuration;
        _httpHelperServices = httpHelperService;
        _tokenRepository = tokenRepository;
        _repoRepository = repoRepository;
        _cloudBuildSecret = cloudBuildSecret;
    }

    public async Task<GithubWebhook> CreateWebhook(Repo? repo)
    {
        try
        {
            if (repo is null) return null;
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrWhiteSpace(tenantId)) return null;
            var accessToken = (await _tokenRepository.getToken())?.AccessToken;
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                _logger.LogWarning($"Failed to create webhook for repo {repo.RepoUrl}. Token not found");
                return null;
            }
            var webhookRequest = NewHookRequest(HookUrlFor(tenantId), repo.DeploymentType == RepoDeploymentType.Auto);

            var url = HooksUrl(repo);
            var (data, error, response) = await _httpHelperServices.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>( CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Post, webhookRequest, GithubHeaders, accessToken);

            if( response.StatusCode == HttpStatusCode.Created)
            {
                _logger.LogInformation($"Successfully created webhook for repo {repo.RepoUrl}");
                return ToStoredHook(data);
            }
            else
            {
                // GitHub's 404 and 403 bodies have no "errors" array; only the top-level message is there.
                var reason = error?.errors?.FirstOrDefault(e => !string.IsNullOrWhiteSpace(e?.message))?.message ?? error?.message;
                _logger.LogError("Failed to create webhook for repo {RepoUrl}: GitHub answered {Status} {Reason}", repo.RepoUrl, (int)response.StatusCode, reason);
                return null;
            }
        }
        catch(Exception ex)
        {
            _logger.LogError($"Failed to create webhook for {ex.Message}");
            return null;
        }
    }

    public async Task<WebhookOutcome> SetActiveAsync(Repo repo, bool active, string tenantId, string? userId)
    {
        // Turning off a hook that was never stored has nothing to do on GitHub.
        if (!active && repo.GithubWebhook is null)
            return WebhookOutcome.Success(null);

        var token = string.IsNullOrWhiteSpace(userId) ? null : await _tokenRepository.getToken(userId);
        if (string.IsNullOrWhiteSpace(token))
            return WebhookOutcome.Failure(WebhookCodes.NotConnected);

        try
        {
            return active
                ? await TurnOnAsync(repo, tenantId, token)
                : await TurnOffAsync(repo, token);
        }
        // A rule refusing the hook's save reaches the caller with its message; anything else unexpected is a
        // failed webhook change, as it always was.
        catch (Exception ex) when (ex is not DataValidationException)
        {
            _logger.LogError(ex, "Changing the webhook of repository {RepoName} failed unexpectedly.", repo.RepoName);
            return WebhookOutcome.Failure(WebhookCodes.Failed, UnexpectedFailure);
        }
    }

    /// <summary>
    /// At most 3 webhook calls and 1 repository read: patch the stored hook, or create one; on a missing stored
    /// hook or an existing unstored one, adopt the repository's hook with this tenant's URL.
    /// </summary>
    private async Task<WebhookOutcome> TurnOnAsync(Repo repo, string tenantId, string token)
    {
        var hookUrl = HookUrlFor(tenantId);
        if (repo.GithubWebhook is not null)
        {
            var patched = await SendAsync(repo, HttpMethod.Patch, HookUrl(repo, repo.GithubWebhook.Id), new { active = true }, token);
            if (patched.StatusCode == HttpStatusCode.OK)
                return await SaveActiveAsync(repo, true);
            // 404 here can mean the stored hook was deleted on GitHub: look for ours before deciding.
            if (patched.StatusCode == HttpStatusCode.NotFound)
                return await AdoptAsync(repo, tenantId, hookUrl, token, createWhenMissing: true, alreadyExistsDetail: null);
            return await FailureAsync(repo, token, patched);
        }

        var created = await SendAsync(repo, HttpMethod.Post, HooksUrl(repo), NewHookRequest(hookUrl, active: true), token);
        if (created.StatusCode == HttpStatusCode.Created)
            return await SaveHookAsync(repo, tenantId, Parse<GithubWebhookSuccessResponse>(created.Body));
        if (created.StatusCode == HttpStatusCode.UnprocessableEntity && IsHookAlreadyExists(created.Body))
            return await AdoptAsync(repo, tenantId, hookUrl, token, createWhenMissing: false, alreadyExistsDetail: DetailOf(created));
        return await FailureAsync(repo, token, created);
    }

    /// <summary>
    /// Lists the repository's hooks and activates the one whose URL is exactly this tenant's; no other hook is
    /// changed. Without one, creates it (after a stale stored hook) or fails (after GitHub said one exists).
    /// </summary>
    private async Task<WebhookOutcome> AdoptAsync(
        Repo repo, string tenantId, string hookUrl, string token, bool createWhenMissing, string? alreadyExistsDetail)
    {
        // One page of up to 100 hooks, GitHub's maximum, keeps the call budget; no repository holds more in practice.
        var listed = await SendAsync(repo, HttpMethod.Get, $"{HooksUrl(repo)}?per_page=100", null, token);
        if (listed.StatusCode != HttpStatusCode.OK)
            return await FailureAsync(repo, token, listed);

        var ours = Parse<List<GithubWebhookSuccessResponse>>(listed.Body)?
            .FirstOrDefault(hook => string.Equals(hook?.config?.url, hookUrl, StringComparison.Ordinal));
        if (ours is null)
        {
            if (!createWhenMissing)
                return WebhookOutcome.Failure(WebhookCodes.Failed, alreadyExistsDetail ?? HookAlreadyExists);
            var created = await SendAsync(repo, HttpMethod.Post, HooksUrl(repo), NewHookRequest(hookUrl, active: true), token);
            return created.StatusCode == HttpStatusCode.Created
                ? await SaveHookAsync(repo, tenantId, Parse<GithubWebhookSuccessResponse>(created.Body))
                : await FailureAsync(repo, token, created);
        }

        var patched = await SendAsync(repo, HttpMethod.Patch, HookUrl(repo, ours.id), new { active = true }, token);
        if (patched.StatusCode != HttpStatusCode.OK)
            return await FailureAsync(repo, token, patched);
        ours.active = true;
        return await SaveHookAsync(repo, tenantId, ours);
    }

    /// <summary>At most 1 webhook call and 1 repository read. The stored hook stays active on any failure, as on GitHub.</summary>
    private async Task<WebhookOutcome> TurnOffAsync(Repo repo, string token)
    {
        var patched = await SendAsync(repo, HttpMethod.Patch, HookUrl(repo, repo.GithubWebhook!.Id), new { active = false }, token);
        if (patched.StatusCode == HttpStatusCode.OK)
            return await SaveActiveAsync(repo, false);
        if (patched.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
        {
            var (outcome, isAdmin) = await ExplainRefusalAsync(repo, token, patched);
            // An admin gets 404 only for a hook that no longer exists: there is nothing left to turn off.
            if (patched.StatusCode == HttpStatusCode.NotFound && isAdmin)
                return await SaveActiveAsync(repo, false);
            return outcome;
        }
        return await FailureAsync(repo, token, patched);
    }

    /// <summary>Maps a failed GitHub answer to its code (spec §6.3 step 5).</summary>
    private async Task<WebhookOutcome> FailureAsync(Repo repo, string token, HttpCallResult result)
    {
        if (result.TransportFailed)
            return WebhookOutcome.Failure(WebhookCodes.Unreachable);
        if (result.StatusCode == HttpStatusCode.Unauthorized)
            return WebhookOutcome.Failure(WebhookCodes.TokenInvalid);
        if (result.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
            return (await ExplainRefusalAsync(repo, token, result)).Outcome;
        return WebhookOutcome.Failure(WebhookCodes.Failed, DetailOf(result));
    }

    /// <summary>
    /// GitHub answers 403 or 404 both for "no such repository" and for "no webhook rights", so the repository is
    /// read to tell them apart. <c>IsAdmin</c> is true when the user turned out to be a repository admin.
    /// </summary>
    private async Task<(WebhookOutcome Outcome, bool IsAdmin)> ExplainRefusalAsync(Repo repo, string token, HttpCallResult refused)
    {
        var read = await SendAsync(repo, HttpMethod.Get, $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo.RepoName}", null, token);
        if (read.TransportFailed)
            return (WebhookOutcome.Failure(WebhookCodes.Unreachable), false);
        if (read.StatusCode == HttpStatusCode.Unauthorized)
            return (WebhookOutcome.Failure(WebhookCodes.TokenInvalid), false);
        if (read.StatusCode == HttpStatusCode.NotFound)
            return (WebhookOutcome.Failure(WebhookCodes.RepoNotVisible), false);
        if (read.StatusCode == HttpStatusCode.OK
            && Parse<GithubRepositoryPermissionsResponse>(read.Body)?.Permissions?.Admin != true)
            return (WebhookOutcome.Failure(WebhookCodes.Permission), false);
        return (WebhookOutcome.Failure(WebhookCodes.Failed, DetailOf(refused)), read.StatusCode == HttpStatusCode.OK);
    }

    /// <summary>One GitHub call with the acting user's token, cancelled after <see cref="GithubCallTimeout"/>.</summary>
    private async Task<HttpCallResult> SendAsync(Repo repo, HttpMethod method, string url, object? payload, string token)
    {
        var result = await _httpHelperServices.SendWithTimeoutAsync(
            CloudBuildConstants.GITHUB_API_BASE_URI, url, method, payload, GithubHeaders, token, GithubCallTimeout);

        // One line per refused call, naming the repository and GitHub's status. Bodies are never logged.
        if (result.TransportFailed)
            _logger.LogWarning("GitHub did not answer {Method} {Path} for repository {RepoName}.", method.Method, PathOf(url), repo.RepoName);
        else if ((int)result.StatusCode!.Value >= 400)
            _logger.LogWarning("GitHub answered {Status} to {Method} {Path} for repository {RepoName}.", (int)result.StatusCode.Value, method.Method, PathOf(url), repo.RepoName);
        return result;
    }

    private async Task<WebhookOutcome> SaveActiveAsync(Repo repo, bool active)
    {
        repo.GithubWebhook!.Active = active;
        if (!await _repoRepository.UpdateRepoGithubWebhookActive(repo.ItemId, active))
            _logger.LogWarning("The webhook of repository {RepoName} changed on GitHub but could not be saved.", repo.RepoName);
        return WebhookOutcome.Success(repo.GithubWebhook);
    }

    private async Task<WebhookOutcome> SaveHookAsync(Repo repo, string tenantId, GithubWebhookSuccessResponse? hook)
    {
        if (hook is null)
            return WebhookOutcome.Failure(WebhookCodes.Failed, UnexpectedFailure);
        repo.GithubWebhook = ToStoredHook(hook);
        if (!await _repoRepository.UpdateRepo(repo, tenantId))
            _logger.LogWarning("The webhook of repository {RepoName} was set up on GitHub but could not be saved.", repo.RepoName);
        return WebhookOutcome.Success(repo.GithubWebhook);
    }

    private static GithubWebhook ToStoredHook(GithubWebhookSuccessResponse data)
    {
        GithubWebhook repoWebhook = MapService.Map<GithubWebhookSuccessResponse, GithubWebhook>(data);
        // GitHub names these content_type and insecure_ssl, which the name-based mapper does not match.
        if (repoWebhook is not null && data?.config is not null)
        {
            repoWebhook.Config ??= new Config { Url = data.config.url };
            repoWebhook.Config.ContentType = data.config.content_type;
            repoWebhook.Config.InsecureSsl = data.config.insecure_ssl;
        }
        return repoWebhook;
    }

    private GithubWebhookRequest NewHookRequest(string hookUrl, bool active) => new()
    {
        Name = "web",
        Active = active,
        Events = new List<string> { "push" },
        Config = new WebhookConfig
        {
            Url = hookUrl,
            ContentType = "json",
            InsecureSsl = "0",
            Secret = _cloudBuildSecret.GithubWebhookSecret
        }
    };

    /// <summary>The push URL of a tenant's hooks; a hook is this tenant's only when its URL is exactly this.</summary>
    private string HookUrlFor(string tenantId) => $"{_configuration["GithubWebhookUrl"]}{tenantId}";

    private static string HooksUrl(Repo repo) => $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo.RepoName}/hooks";

    private static string HookUrl(Repo repo, long hookId) => $"{HooksUrl(repo)}/{hookId}";

    private static string PathOf(string url) => url[CloudBuildConstants.GITHUB_API_BASE_URI.Length..];

    private static bool IsHookAlreadyExists(string? body)
    {
        var error = Parse<GithubWebhookErrorResponse>(body);
        return (error?.errors?.Any(e => Contains(e?.message)) ?? false) || Contains(error?.message);

        static bool Contains(string? message) =>
            message?.Contains("Hook already exists", StringComparison.OrdinalIgnoreCase) == true;
    }

    /// <summary>GitHub's own explanation: the first error's message, else the top-level message, else the status.</summary>
    private static string DetailOf(HttpCallResult result)
    {
        var error = Parse<GithubWebhookErrorResponse>(result.Body);
        return error?.errors?.Select(e => e?.message).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m))
            ?? (string.IsNullOrWhiteSpace(error?.message) ? null : error.message)
            ?? $"HTTP {(int)(result.StatusCode ?? 0)}";
    }

    /// <summary>Reads a GitHub body without ever throwing: an empty or unexpected body is null.</summary>
    private static T? Parse<T>(string? body) where T : class
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            return JsonSerializer.Deserialize<T>(body, GithubJson);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
