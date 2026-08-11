using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Models;

namespace Devops.DomainService.Deployment.Interfaces;

public interface IDeploymentTeardownService
{
    /// <summary>
    /// Reacts to a delete that already happened upstream: tears down the deployments the message
    /// resolves to and archives the repositories behind them, so they leave this service's repo list.
    /// Never throws for a message it cannot act on - an unresolvable message is a no-op, and a
    /// repository that fails to tear down does not stop the rest.
    /// </summary>
    public Task<DeploymentTeardownSummary> TearDownAsync(ProjectDeleteQueue message);
}
