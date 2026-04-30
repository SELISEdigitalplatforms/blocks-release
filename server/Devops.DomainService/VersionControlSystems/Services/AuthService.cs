using Blocks.Genesis;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using System.Net;
using Devops.DomainService.VersionControlSystems.Models.Response;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.VersionControlSystems.Services;

public class AuthService: IAuthService
{
    private readonly ILogger<AuthService> _logger;
    private readonly ITokenRepository _tokenRepository;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly IConfiguration _configuration;
    private readonly IVersionControlService _versionControlService;

    private string clientId;
    private string clientSecret;

    public AuthService(ITokenRepository tokenRepository,
        IConfiguration configuration,
        IVersionControlService versionControlService,
        IHttpHelperServices httpHelperServices,
        ILogger<AuthService> logger,
        ICloudBuildSecret cloudBuildSecret)
    {
        _logger = logger;
        _tokenRepository = tokenRepository;
        _httpHelperServices = httpHelperServices;
        _configuration = configuration;
        clientId = cloudBuildSecret.GithubClientId;
        clientSecret = cloudBuildSecret.GithubClientSecret;
        _versionControlService = versionControlService;
    }

    public async Task<BaseApiResponse> GetAccessToken(string code)
    {
        try
        {
            var headers = new Dictionary<string, string>
                {
                    { "Content-Type", "application/json" },
                    { "Accept", "application/json" }
                };
            var url = $"{CloudBuildConstants.GITHUB_BASE_URI}/login/oauth/access_token";
            var payload = new
            {
                client_id = clientId,
                client_secret = clientSecret,
                code = code,
            };
            var (accessTokenResult, response) = await _httpHelperServices.MakeHttpRequest<GithubAccessTokenResponse>(CloudBuildConstants.GITHUB_BASE_URI, url, HttpMethod.Post, payload, headers);
            if (response.StatusCode == HttpStatusCode.OK && accessTokenResult.AccessToken is not null)
            {
                _logger.LogInformation($"Successfully retrieved access token for user {BlocksContext.GetContext().UserId}");
                return await SaveAccessToken(accessTokenResult);
            }
            _logger.LogError($"Failed to retrieve access token for {accessTokenResult.ErrorDescription}");
            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = $"{accessTokenResult.Error}{accessTokenResult.ErrorDescription}",
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Error", accessTokenResult.ErrorDescription}
                }
            };
        }
        catch (Exception ex) 
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = ex.Message,
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Exception", ex.Message }
                }
            };
        }
    }

    public async Task<BaseApiResponse> isAuthorized()
    {
        try
        {
            var result = await _tokenRepository.getToken();
            if (result is not null)
            {
                var validation = await _versionControlService.ValidateAccessToken(result);
                if (validation)
                {
                    return new BaseApiResponse
                    {
                        IsSuccess = true,
                        StatusCode = HttpStatusCode.OK
                    };
                }
            }

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "User is not authorized.",
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Authorization", "User is not authorized." }
                }
            };
        }
        catch
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "Failed to get user data.",
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Exception", "Failed to get user data." }
                }
            };
        }
    }


    public async Task<BaseApiResponse> DeleteToken()
    {
        try
        {
            var result = await _tokenRepository.DeleteTokenAsync();
            if (result)
            {
                _logger.LogInformation($"Successfully deleted access token for user {BlocksContext.GetContext().UserId}.");

                return new BaseApiResponse
                {
                    IsSuccess = true,
                    StatusCode = HttpStatusCode.OK
                };
            }
            _logger.LogError($"Failed to delete access token for user {BlocksContext.GetContext().UserId}.");

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "Failed to remove access token.",
                StatusCode = HttpStatusCode.OK
            };
        }
        catch (Exception ex)
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = ex.Message,
                StatusCode = HttpStatusCode.BadRequest
            };
        }
    }

    public async Task<BaseApiResponse> SaveAccessToken(GithubAccessTokenResponse accessTokenResponse)
    {
        RepositoryToken repositoryToken = await _tokenRepository.getToken();

        var user = await _versionControlService.GetUser(accessTokenResponse.AccessToken);
        var userOrg = await _versionControlService.GetUserOrganizations(accessTokenResponse.AccessToken);
        var userOrganizations = new List<UserOrganizations>();
        foreach (var item in userOrg)
        {
            var org = new UserOrganizations();
            org.OrgId = item.id.ToString();
            org.OrgNodeId = item.node_id;
            org.OrgUserName = item.login;
            org.AvatarUrl = item.avatar_url;
            org.OrgDescription = item.description;
            userOrganizations.Add(org);
        }

        if (repositoryToken == null)
        {
            repositoryToken = new RepositoryToken
            {
                ItemId = Guid.NewGuid().ToString(),
                AccessToken = accessTokenResponse.AccessToken,
                Source = "Github",
                Scope = accessTokenResponse.Scope,
                BlocksUserId = BlocksContext.GetContext().UserId,
                UserName = user?.login,
                CreatedBy = BlocksContext.GetContext().UserId,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                Organizations = userOrganizations,
                LastUpdatedBy = BlocksContext.GetContext().UserId
            };
        }
        else
        {
            repositoryToken.AccessToken = accessTokenResponse.AccessToken;
            repositoryToken.Scope = accessTokenResponse.Scope;
            repositoryToken.LastUpdatedDate = DateTime.UtcNow;
            repositoryToken.Organizations = userOrganizations;
            repositoryToken.LastUpdatedBy = BlocksContext.GetContext().UserId;
            repositoryToken.UserName = user?.login;
        }

        var result = await _tokenRepository.saveToken(repositoryToken);

        if (result)
        {
            return new BaseApiResponse
            {
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            };
        }

        return new BaseApiResponse
        {
            IsSuccess = false,
            Message = "Failed to save access token.",
            StatusCode = HttpStatusCode.BadRequest
        };
    }


    public async Task<BaseApiResponse> RevokeOauthAccess()
    {
        try
        {
            var result = await _tokenRepository.getToken();
            if (result is not null)
            {
                var validation = await _versionControlService.RevokeOauthAccess(result);
                if (validation)
                {
                    return new BaseApiResponse
                    {
                        IsSuccess = true,
                        StatusCode = HttpStatusCode.OK
                    };
                }
            }

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "Authorization removal failed.",
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Authorization", "Authorization removal failed." }
                }
            };
        }
        catch
        {
            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "Failed to get user data.",
                StatusCode = HttpStatusCode.BadRequest,
                Errors = new Dictionary<string, string>
                {
                    { "Exception", "Failed to get user data." }
                }
            };
        }
    }

}