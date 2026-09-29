using Devops.DomainService.Deployment.Models.Request;

namespace ReleaseDriver
{
    /// <summary>
    /// Defines operations for managing deployment authentication and authorization.
    /// </summary>
    public interface IReleaseDriverService
    {
        /// <summary>
        /// Checks whether the current user is authorized (has a valid access token).
        /// </summary>
        /// <returns>A response indicating whether the user is authorized.</returns>
        Task<BaseApiResponse> IsAuthorizeAsync();

        /// <summary>
        /// Exchanges an OAuth authorization code for an access token and persists it.
        /// </summary>
        /// <param name="code">The OAuth authorization code returned by the provider.</param>
        /// <returns>A response indicating success or failure of the token exchange.</returns>
        Task<BaseApiResponse> GetAccessTokenAsync(string code);

        /// <summary>
        /// Revokes the current user's OAuth access from the provider.
        /// </summary>
        /// <returns>A response indicating success or failure of the revocation.</returns>
        Task<BaseApiResponse> RemoveAuthorizationAsync();

        /// <summary>
        /// Deletes the stored access token for the current user.
        /// </summary>
        /// <returns>A response indicating success or failure of the deletion.</returns>
        Task<BaseApiResponse> DeleteAuthorizationAsync();

        /// <summary>
        /// Retrieves the list of repositories. Archived repositories are excluded.
        /// </summary>
        /// <returns>A response containing the list of repositories.</returns>
        Task<BaseApiResponse> GetReposListAsync();

        /// <summary>
        /// Retrieves a repository together with its paged build history.
        /// </summary>
        /// <param name="repoId">The identifier of the repository to retrieve.</param>
        /// <param name="branch">Optional branch filter.</param>
        /// <param name="pageNumber">The page number to retrieve (defaults to 1).</param>
        /// <param name="pageSize">The number of builds per page (defaults to 30).</param>
        /// <returns>A response containing the repository, builds, and total build count.</returns>
        Task<BaseApiResponse> GetRepoDetailsAsync(
            string repoId,
            string? branch = null,
            int pageNumber = 1,
            int pageSize = 30);

        /// <summary>
        /// Retrieves the test or analysis report produced by a build.
        /// </summary>
        /// <param name="buildId">The identifier of the build.</param>
        /// <param name="type">The report type, such as sast, sca-container, sca-libraries, or dast.</param>
        /// <returns>A response containing the requested report.</returns>
        Task<BaseApiResponse> GetReportsAsync(string buildId, string type);

        /// <summary>
        /// Retrieves the authenticated GitHub user.
        /// </summary>
        /// <returns>A response containing the GitHub user details.</returns>
        Task<BaseApiResponse> GetUserAsync();

        /// <summary>
        /// Searches the authenticated user's GitHub repositories.
        /// </summary>
        /// <param name="search">Optional search term to filter repositories.</param>
        /// <param name="pageNumber">The page number to retrieve (defaults to 1).</param>
        /// <param name="pageSize">The number of repositories per page (defaults to 30).</param>
        /// <returns>A response containing the matching repositories.</returns>
        Task<BaseApiResponse> SearchRepositoriesAsync(string? search, int pageNumber = 1, int pageSize = 30);

        /// <summary>
        /// Retrieves the branches for the specified GitHub repository.
        /// </summary>
        /// <param name="repo">The full repository name.</param>
        /// <returns>A response containing the repository branches.</returns>
        Task<BaseApiResponse> GetBranchesAsync(string repo);

        /// <summary>
        /// Checks whether the configured branch exists for the given repository.
        /// </summary>
        /// <param name="repoId">The identifier of the repository to check.</param>
        /// <returns>A response indicating whether the branch exists.</returns>
        Task<BaseApiResponse> GithubBranchExistsAsync(string repoId);

        /// <summary>
        /// Updates the custom deployment domains for the given repositories.
        /// </summary>
        /// <param name="request">The repositories and custom domains to update.</param>
        /// <returns>A response indicating success or failure of the update.</returns>
        Task<BaseApiResponse> UpdateRepoDomainAsync(RepoDomainUpdateRequest request);
    }
}
