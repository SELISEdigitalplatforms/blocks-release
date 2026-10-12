namespace Devops.DomainService.VersionControlSystems.TokenStore;

/// <summary>
/// The user-facing messages and error keys of the GitHub token responses. They are part of the
/// response contract that blocks-os reads through the release driver, so they must not drift.
/// </summary>
public static class GithubTokenMessages
{
    /// <summary><c>isAuthorized</c> when the token store cannot be read.</summary>
    public const string Validate = "Could not validate your GitHub connection. Please try again later.";

    /// <summary><c>isAuthorized</c> when there is no usable token or GitHub rejects it.</summary>
    public const string Reauthenticate = "Your GitHub authorization is no longer valid. Please re-authenticate.";

    /// <summary>Connect, revoke and webhook builds when the token store cannot be used.</summary>
    public const string Unavailable = "This operation is not possible right now. Please try again later.";

    /// <summary>Error key for a token-store (Key Vault) failure. Never means "invalid token".</summary>
    public const string TokenStoreErrorKey = "TokenStore";

    /// <summary>Error key for a missing or rejected GitHub authorization.</summary>
    public const string AuthorizationErrorKey = "Authorization";
}
