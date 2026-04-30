using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Models.Request;
using Devops.DomainService.VersionControlSystems.Models.Response;

namespace Devops.DomainService.VersionControlSystems.Interfaces;

public interface IVersionControlService
{
    public Task<GithubUserResponse> GetUser();
    public Task<GithubUserResponse> GetUser(string accessToken);
    public Task<bool> ValidateAccessToken(RepositoryToken token);
    public Task<bool> RevokeOauthAccess(RepositoryToken token);
    public Task<List<GithubUserOrgResponse>> GetUserOrganizations(string accessToken);
    public Task<BaseApiResponse> GetRepositories(SearchRepositoryListRequest repoSearchQuery);
    public Task<BaseApiResponse> SearchUserRepositories(SearchRepositoryListRequest repoSearchQuery);
    public Task<List<Branch>> GetBranches(string repo);
    public Task<(bool, string)> GetRepoBranchByName(string repo, string branch);
    public Task<bool> Clone(string repo);
}