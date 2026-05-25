using Microsoft.Extensions.Configuration;
using Blocks.Genesis;
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

namespace Devops.DomainService.VersionControlSystems.Services;

public class GithubWebhookService : IGithubWebhookService
{
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
            var token = await _tokenRepository.getToken();
            if (token == null)
            {
                _logger.LogWarning($"Failed to create webhook for repo {repo.RepoUrl}. Token not found");
                return null;
            }
            var blocksTenantId = BlocksContext.GetContext().TenantId;
            var webhookRequest = new GithubWebhookRequest
            {
                Name = "web",
                Active = repo.DeploymentType == RepoDeploymentType.Auto? true: false,
                Events = new List<string> { "push" },
                Config = new WebhookConfig
                {
                    Url = $"{_configuration["GithubWebhookUrl"]}{blocksTenantId}",
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
            var (data, error, response) = await _httpHelperServices.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>( CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Post, webhookRequest, headers, token.AccessToken);

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
        catch (Exception ex)
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
        catch (Exception ex)
        {
            _logger.LogError($"Failed to create new webhook for {repo.RepoName} with error {ex.Message}");
            return false;
        }
    }
}