namespace Devops.DomainService.Deployment.Models.Response;

/// <summary>
/// A request that succeeded while its GitHub webhook could not be put in the state the deployment mode asks
/// for. Sent as <c>warning</c> on the deploy and Settings responses, and left out when there is none.
/// </summary>
public class DeploymentWarning
{
    /// <summary>Push deploys are off, but the hook on GitHub could not be turned off. Pushes are ignored anyway.</summary>
    public const string WebhookStillActive = "WEBHOOK_STILL_ACTIVE";
    /// <summary>Settings were saved for a Git based repository whose hook could not be turned on.</summary>
    public const string WebhookNotWorking = "WEBHOOK_NOT_WORKING";

    public string Code { get; set; } = string.Empty;
    /// <summary>One of the <c>WebhookCodes</c> values.</summary>
    public string Reason { get; set; } = string.Empty;
    /// <summary>English text for API callers; the UI builds its own from <see cref="Code"/> and <see cref="Reason"/>.</summary>
    public string Message { get; set; } = string.Empty;
    /// <summary>GitHub's own message, when it gave one.</summary>
    public string? Detail { get; set; }
}
