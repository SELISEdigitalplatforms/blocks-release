using Blocks.Genesis.Entities.Release;
using Devops.DomainService.VersionControlSystems.Models.Dtos;

namespace Devops.DomainService.VersionControlSystems.Interfaces;

public interface IGithubWebhookService
{
    /// <summary>Creates the push hook for the signed-in user (<c>GET /github/CreateWebhook</c>); null when GitHub refuses.</summary>
    Task<GithubWebhook> CreateWebhook(Repo? repo);

    /// <summary>
    /// Turns the repository's push hook on or off on GitHub with <paramref name="userId"/>'s token and stores the
    /// result. Turning on creates the hook, or adopts the one whose URL is exactly this tenant's, when none is
    /// stored. A timeout or network failure is a failure, never a success.
    /// </summary>
    Task<WebhookOutcome> SetActiveAsync(Repo repo, bool active, string tenantId, string? userId);
}
