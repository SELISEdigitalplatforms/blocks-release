using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Deployment.Interfaces;

/// <summary>
/// Keeps a repository's GitHub push webhook in step with its deployment mode (Git based = <c>Auto</c>, Blocks
/// Cloud based = <c>Manual</c>) and says truthfully what happened. Turning Git based on needs a working hook
/// and is refused otherwise; turning it off always succeeds, with a warning when the hook stays on.
/// </summary>
public interface IDeploymentModeService
{
    /// <summary>
    /// The mode step of a deploy (run-build or manual), run after the repository's rules and before the
    /// pipeline. <paramref name="requestedType"/> is the caller's <c>deploymentType</c>: blank keeps the stored
    /// mode, "auto" in any case is Git based, anything else Blocks Cloud based.
    /// </summary>
    Task<DeployModeStep> ApplyBeforeDeployAsync(Repo repo, string? requestedType, string tenantId, string? userId);

    /// <summary>
    /// Saves a Settings request, turning the hook on before the save when Git based is switched on (refused,
    /// with nothing saved, when that fails) and off or repaired after it otherwise.
    /// </summary>
    Task<RepoSettingsUpdateResponse> SaveSettingsAsync(Repo repo, RepoUpdateRequest request, string tenantId, string? userId);
}
