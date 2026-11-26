using Blocks.Genesis.Entities.Release;

namespace Devops.DomainService.VersionControlSystems.Models.Dtos;

/// <summary>
/// Why a webhook change failed. The values are part of the API contract (<c>errors.webhook</c> and
/// <c>warning.reason</c>): callers and the UI key on them, so they never change.
/// </summary>
public static class WebhookCodes
{
    /// <summary>The acting user has no stored GitHub token.</summary>
    public const string NotConnected = "GITHUB_NOT_CONNECTED";
    /// <summary>GitHub answered 401 to the acting user's token.</summary>
    public const string TokenInvalid = "GITHUB_TOKEN_INVALID";
    /// <summary>GitHub does not show the repository to the acting user.</summary>
    public const string RepoNotVisible = "GITHUB_REPO_NOT_VISIBLE";
    /// <summary>The acting user can see the repository but cannot manage its webhooks.</summary>
    public const string Permission = "GITHUB_WEBHOOK_PERMISSION";
    /// <summary>GitHub refused for another reason; its own message is the detail.</summary>
    public const string Failed = "GITHUB_WEBHOOK_FAILED";
    /// <summary>A GitHub call timed out or failed at the network level.</summary>
    public const string Unreachable = "GITHUB_UNREACHABLE";
}

/// <summary>
/// The result of turning a repository's GitHub webhook on or off. <see cref="Hook"/> is the hook as stored after
/// a success (null when the repository has none); <see cref="Code"/> and <see cref="Detail"/> explain a failure.
/// </summary>
public sealed record WebhookOutcome(bool Ok, string? Code, string? Detail, GithubWebhook? Hook)
{
    public static WebhookOutcome Success(GithubWebhook? hook) => new(true, null, null, hook);

    public static WebhookOutcome Failure(string code, string? detail = null) => new(false, code, detail, null);
}
