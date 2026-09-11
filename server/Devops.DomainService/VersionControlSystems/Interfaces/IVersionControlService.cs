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

    /// <summary>
    /// The calling Blocks user's git credential, or <c>null</c> when they have
    /// not connected GitHub or the stored token no longer validates. See
    /// <see cref="GitPushCredentialResponse"/> for what the caller owes it.
    /// </summary>
    public Task<GitPushCredentialResponse?> GetPushCredential();

    /// <summary>
    /// Creates a repository on GitHub for the calling user (or one of their
    /// recorded organisations). Returns the repository, or an error message
    /// naming why GitHub refused — a name collision is the common one.
    /// </summary>
    public Task<(GithubRepositoryResponse? repo, string? error)> CreateRepository(CreateRepositoryRequest request);
}