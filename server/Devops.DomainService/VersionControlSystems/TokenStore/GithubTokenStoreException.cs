namespace Devops.DomainService.VersionControlSystems.TokenStore;

/// <summary>
/// The GitHub token store (Azure Key Vault) could not be used: a vault failure, throttling beyond
/// the SDK's retries, or no usable Key Vault store. It never means the token is invalid, and it
/// never carries a token value or the store's own exception.
/// </summary>
public sealed class GithubTokenStoreException : Exception
{
    internal const string DefaultMessage = "The GitHub token store is unavailable.";

    public GithubTokenStoreException()
        : base(DefaultMessage)
    {
    }

    public GithubTokenStoreException(string message)
        : base(message)
    {
    }

    public GithubTokenStoreException(string message, Exception? innerException)
        : base(message, innerException)
    {
    }

    /// <summary>The vault operation that failed: <c>set</c>, <c>get</c> or <c>delete</c>.</summary>
    public string? Operation { get; init; }
}
