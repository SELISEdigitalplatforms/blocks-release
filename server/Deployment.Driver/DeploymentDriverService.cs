using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Request;
using System.Net;

namespace DeploymentDriver
{
    public class DeploymentDriverService : IDeploymentDriverService
    {
        private readonly IAuthService _authService;
        private readonly IRepoRepository _repoRepository;
        private readonly IVersionControlService _githubService;
        private readonly IBuildService _buildService;

        public DeploymentDriverService(
            IAuthService authService,
            IRepoRepository repoRepository,
            IVersionControlService githubService,
            IBuildService buildService)
        {
            _authService = authService;
            _repoRepository = repoRepository;
            _githubService = githubService;
            _buildService = buildService;
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

        public async Task<BaseApiResponse> GetReposListAsync()
        {
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

        public async Task<BaseApiResponse> GetUserAsync()
        {
            var user = await _githubService.GetUser();
            if (user != null)
            {
                return new BaseApiResponse
                {
                    Data = user,
                    IsSuccess = true,
                    StatusCode = HttpStatusCode.OK
                };
            }

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "User not found",
                StatusCode = HttpStatusCode.BadRequest
            };
        }

        public async Task<BaseApiResponse> SearchRepositoriesAsync(string? search, int pageNumber = 1, int pageSize = 30)
        {
            var request = new SearchRepositoryListRequest
            {
                Search = search,
                PageNumber = pageNumber,
                PageSize = pageSize
            };

            var response = await _githubService.SearchUserRepositories(request);
            return MapResponse(response);
        }

        public async Task<BaseApiResponse> GetBranchesAsync(string repo)
        {
            var branches = await _githubService.GetBranches(repo);
            if (branches != null)
            {
                return new BaseApiResponse
                {
                    Data = branches,
                    IsSuccess = true,
                    StatusCode = HttpStatusCode.OK
                };
            }

            return new BaseApiResponse
            {
                IsSuccess = false,
                Message = "failed to get branches",
                StatusCode = HttpStatusCode.BadRequest
            };
        }

        public async Task<BaseApiResponse> GithubBranchExistsAsync(string repoId)
        {
            Repo repo = await _repoRepository.GetRepo(repoId);
            if (repo is null)
            {
                return new BaseApiResponse
                {
                    Message = "Repository not found.",
                    IsSuccess = false,
                    StatusCode = HttpStatusCode.BadRequest
                };
            }

            var (result, errorMessage) = await _githubService.GetRepoBranchByName(repo.RepoName, repo.Branch);
            return new BaseApiResponse
            {
                IsSuccess = result,
                Message = errorMessage,
                StatusCode = HttpStatusCode.OK
            };
        }

        public async Task<BaseApiResponse> UpdateRepoDomainAsync(RepoDomainUpdateRequest request)
        {
            var response = await _buildService.UpdateRepoDomain(request);
            return MapResponse(response);
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
                IsSuccess = response.IsSuccess,
                Errors = response.Errors
            };
        }
    }
}
