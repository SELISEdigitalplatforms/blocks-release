using Devops.DomainService.Deployment.Models.Request;

namespace Devops.DomainService.VersionControlSystems.Models.Request;

public class CreateGithubWebhookRequest : ProjectKeyQuery
{
    public string repoName { get; set; }
}