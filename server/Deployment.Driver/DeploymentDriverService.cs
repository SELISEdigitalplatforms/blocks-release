using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.VersionControlSystems.Interfaces;
using System.Net;

namespace DeploymentDriver
{
    public class DeploymentDriverService : IDeploymentDriverService
    {
        private readonly IAuthService _authService;
        private readonly IRepoRepository _repoRepository;
        private readonly ChangeControllerContext _changeControllerContext;

        public DeploymentDriverService(
            IAuthService authService,
            IRepoRepository repoRepository,
            ChangeControllerContext changeControllerContext)
        {
            _authService = authService;
            _repoRepository = repoRepository;
            _changeControllerContext = changeControllerContext;
        }

        public async Task<BaseApiResponse> IsAuthorizeAsync()
        {
            var response = await _authService.isAuthorized();
            return MapResponse(response);
        }

        public async Task<BaseApiResponse> GetAccessTokenAsync(string code)
        {
            var response = await _authService.GetAccessToken(code);
            return MapResponse(response);
        }

        public async Task<BaseApiResponse> RemoveAuthorizationAsync()
        {
            var response = await _authService.RevokeOauthAccess();
            return MapResponse(response);
        }

        public async Task<BaseApiResponse> DeleteAuthorizationAsync()
        {
            var response = await _authService.DeleteToken();
            return MapResponse(response);
        }

        public async Task<BaseApiResponse> GetReposListAsync(string projectKey)
        {
            _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = projectKey });
            var repoList = await _repoRepository.GetRepos();
            if (repoList != null)
            {
                return new BaseApiResponse
                {
                    Data = repoList,
                    IsSuccess = true,
                    StatusCode = HttpStatusCode.OK
                };
            }

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "Failed to get repos."
            };
        }

        private static BaseApiResponse MapResponse(Devops.DomainService.Shared.Entities.BaseApiResponse? response)
        {
            if (response is null)
            {
                return new BaseApiResponse();
            }

            return new BaseApiResponse
            {
                Data = response.Data,
                Message = response.Message,
                StatusCode = response.StatusCode,
                IsSuccess = response.IsSuccess
            };
        }
    }
}
