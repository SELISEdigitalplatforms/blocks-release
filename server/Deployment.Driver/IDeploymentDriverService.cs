namespace DeploymentDriver
{
    /// <summary>
    /// Defines operations for managing deployment authentication and authorization.
    /// </summary>
    public interface IDeploymentDriverService
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
        /// Retrieves the list of repositories for the given project key.
        /// </summary>
        /// <param name="projectKey">The project key used to scope the tenant context.</param>
        /// <returns>A response containing the list of repositories.</returns>
        Task<BaseApiResponse> GetReposListAsync();
    }
}
