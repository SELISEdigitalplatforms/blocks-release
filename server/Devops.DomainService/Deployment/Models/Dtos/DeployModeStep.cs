using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Models.Dtos;

/// <summary>
/// What the deployment-mode step decided before a deploy starts its pipeline: either a <see cref="Refusal"/> to
/// return as is (nothing was started or saved), or go ahead, possibly with a <see cref="Warning"/> for the response.
/// </summary>
public sealed record DeployModeStep(BuildResponse? Refusal, DeploymentWarning? Warning, bool TurnedAutoOn)
{
    public static readonly DeployModeStep Unchanged = new(null, null, false);
}
