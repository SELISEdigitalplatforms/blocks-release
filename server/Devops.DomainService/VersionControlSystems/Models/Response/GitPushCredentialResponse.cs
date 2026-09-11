namespace Devops.DomainService.VersionControlSystems.Models.Response;

/// <summary>
/// The credential a git client uses to authenticate an HTTPS push or fetch
/// against GitHub on behalf of the calling Blocks user.
/// <para>
/// This is the stored OAuth access token — the decision taken for Studio's
/// background runs was to push as the app owner, and an OAuth-app token is
/// the only credential this integration holds. Two consequences the caller
/// must respect: the token does not expire on its own, and its <c>repo</c>
/// scope reaches every repository the owner can write to, not just the one
/// being pushed. It is therefore handed to git through an askpass/credential
/// helper for the lifetime of one process only, and never written to
/// <c>.git/config</c>, a remote URL, or any file. A GitHub App with
/// installation tokens would remove both caveats; this shape leaves room for
/// that by carrying <see cref="ExpiresAt"/> already.
/// </para>
/// </summary>
public class GitPushCredentialResponse
{
    /// <summary>Basic-auth username. GitHub accepts any value when the password is a token; this is the conventional one.</summary>
    public string Username { get; set; } = "x-access-token";

    public string Token { get; set; }

    /// <summary>GitHub login of the account the token belongs to — for `user.name` and for telling the owner whose account is pushing.</summary>
    public string Login { get; set; }

    /// <summary>Null for an OAuth-app token, which never expires until revoked.</summary>
    public DateTime? ExpiresAt { get; set; }
}
