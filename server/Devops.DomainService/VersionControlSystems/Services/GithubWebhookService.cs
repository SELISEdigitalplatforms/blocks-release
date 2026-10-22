using Blocks.Genesis.Entities.Release;
using Microsoft.Extensions.Configuration;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Rules;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Microsoft.Extensions.Logging;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Deployment.Models.Response;
using System.Net;
using Devops.DomainService.Shared.Services;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;

namespace Devops.DomainService.VersionControlSystems.Services;

public class GithubWebhookService : IGithubWebhookService
{
    private readonly ILogger<GithubWebhookService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly ITokenRepository _tokenRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly ICloudBuildSecret _cloudBuildSecret;
    private readonly INotificationService? _notificationService;

    public GithubWebhookService(
                                ILogger<GithubWebhookService> logger,
                                IConfiguration configuration,
                                IHttpHelperServices httpHelperService,
                                ITokenRepository tokenRepository,
                                IRepoRepository repoRepository,
                                ICloudBuildSecret cloudBuildSecret,
                                INotificationService? notificationService = null
                                )

    {
        _logger = logger;
        _configuration = configuration;
        _httpHelperServices = httpHelperService;
        _tokenRepository = tokenRepository;
        _repoRepository = repoRepository;
        _cloudBuildSecret = cloudBuildSecret;
        _notificationService = notificationService;
    }

    public Task<GithubWebhook> CreateWebhook(Repo? repo) =>
        CreateWebhookAndReportAsync(repo, BlocksContext.GetContext()?.TenantId, BlocksContext.GetContext()?.UserId,
            async () => (await _tokenRepository.getToken())?.AccessToken);

    public Task<GithubWebhook> CreateWebhook(Repo? repo, string tenantId, string userId) =>
        CreateWebhookAndReportAsync(repo, tenantId, userId, () => _tokenRepository.getToken(userId));

    /// <summary>
    /// Creates the webhook; when none could be created, tells the acting user (best effort).
    /// The project admins are not looked up here, so the acting user is the only recipient.
    /// </summary>
    private async Task<GithubWebhook> CreateWebhookAndReportAsync(
        Repo? repo, string? tenantId, string? userId, Func<Task<string?>> resolveToken)
    {
        var webhook = await CreateWebhookCore(repo, tenantId, resolveToken);
        if (webhook is null && repo is not null && !string.IsNullOrWhiteSpace(tenantId))
        {
            await NotificationService.SafeSendAsync(_notificationService, _logger, tenantId, "release-github-access-failed", new[] { userId },
                NotificationService.BuildPayload("release-github-access-failed", "Repository webhook not created",
                    "The repository webhook could not be created. Check the GitHub authorization.", false,
                    ("repoId", repo.ItemId), ("projectId", tenantId)));
        }
        return webhook;
    }

    private async Task<GithubWebhook> CreateWebhookCore(
        Repo? repo, string? tenantId, Func<Task<string?>> resolveToken)
    {
        try
        {
            if (repo is null) return null;
            if (string.IsNullOrWhiteSpace(tenantId)) return null;
            var accessToken = await resolveToken();
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                _logger.LogWarning($"Failed to create webhook for repo {repo.RepoUrl}. Token not found");
                return null;
            }
            var webhookRequest = new GithubWebhookRequest
            {
                Name = "web",
                Active = repo.DeploymentType == RepoDeploymentType.Auto? true: false,
                Events = new List<string> { "push" },
                Config = new WebhookConfig
                {
                    Url = $"{_configuration["GithubWebhookUrl"]}{tenantId}",
                    ContentType = "json",
                    InsecureSsl = "0",
                    Secret = _cloudBuildSecret.GithubWebhookSecret
                }
            };

            var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo.RepoName}/hooks";

            var headers = new Dictionary<string, string>
                {
                    { "Accept", "application/vnd.github.v3+json" },
                    { "User-Agent", "BlocksDevOps"},            
                };
            var (data, error, response) = await _httpHelperServices.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>( CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Post, webhookRequest, headers, accessToken);

            if( response.StatusCode == HttpStatusCode.Created)
            {
                GithubWebhook repoWebhook = MapService.Map<GithubWebhookSuccessResponse, GithubWebhook>(data);
                _logger.LogInformation($"Successfully created webhook for repo {repo.RepoUrl}");
                return repoWebhook;
            }
            else
            {
                _logger.LogError($"Failed to create webhook for repo {repo.RepoUrl} for {error.errors[0].message}.");
                return null;
            }
        }
        catch(Exception ex)
        {
            _logger.LogError($"Failed to create webhook for {ex.Message}");
            return null;
        }
    }

    public async Task<bool> UpdateWebhookStatus(Repo repo, bool activationStatus)
    {
        try
        {
            if (repo.GithubWebhook is null)
            {
                await CreateNewWebhook(repo);
            }
            var token = await _tokenRepository.getToken();
            if (token == null)
            {
                _logger.LogWarning($"Failed to create webhook for repo {repo.RepoUrl}. Token not found");
                return false;
            }
            var blocksTenantId = BlocksContext.GetContext().TenantId;
            

            var webhookId = repo.GithubWebhook.Id;

            var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo.RepoName}/hooks/{webhookId}";

            var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"},
            };

            var webhookUpdateRequest = new
            {
                active = activationStatus
            };
            var (data, error, response) = await _httpHelperServices.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Patch, webhookUpdateRequest, headers, token.AccessToken);

            if (response.StatusCode == HttpStatusCode.OK)
            {
                _logger.LogInformation($"Successfully updated webhook status for repo {repo.RepoUrl}");
                return false;
            }
            else if (response.StatusCode == HttpStatusCode.NotFound)
            {
                await CreateNewWebhook(repo);
                _logger.LogInformation($"Successfully updated webhook status for repo {repo.RepoUrl}");
                return false;
            }
            else
            {
                _logger.LogError($"Failed to update webhook status for repo {repo.RepoUrl} for {error.message}.");
                return false;
            }
        }
        // A rule refusing the repo write reaches the caller with its message, not as a quiet "false".
        catch (Exception ex) when (ex is not DataValidationException)
        {
            _logger.LogError($"Failed to update webhook status for {repo.RepoName} with error {ex.Message}");
            return false;
        }

    }

    public async Task<bool> CreateNewWebhook(Repo repo)
    {
        try
        {
            var webhook = await CreateWebhook(repo);
            if (webhook != null)
            {
                repo.GithubWebhook = webhook;
                return await _repoRepository.UpdateRepo(repo);
            }
            return false;
        }
        catch (Exception ex) when (ex is not DataValidationException)
        {
            _logger.LogError($"Failed to create new webhook for {repo.RepoName} with error {ex.Message}");
            return false;
        }
    }
}
