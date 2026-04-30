using Devops.DomainService.Deployment.Entities;

namespace Devops.DomainService.VersionControlSystems.Interfaces;

public interface IGithubWebhookService
{
    Task<GithubWebhook> CreateWebhook(Repo? repo);
    Task<bool> UpdateWebhookStatus(Repo repo, bool activationStatus);
    Task<bool> CreateNewWebhook(Repo repo);
}
