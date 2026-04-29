using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Models.Response;

namespace Devops.DomainService.VersionControlSystems.Interfaces;

public interface IAuthService
{
    Task<BaseApiResponse> GetAccessToken(string code);
    Task<BaseApiResponse> isAuthorized();
    Task<BaseApiResponse> DeleteToken();
    Task<BaseApiResponse> SaveAccessToken(GithubAccessTokenResponse accessTokenResponse);
    Task<BaseApiResponse> RevokeOauthAccess();
}
