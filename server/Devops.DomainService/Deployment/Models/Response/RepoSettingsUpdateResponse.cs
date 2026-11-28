using System.Text.Json.Serialization;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response;

/// <summary>What <c>POST /build/repo-settings-update</c> answers: 200 when <c>IsSuccess</c>, otherwise 400.</summary>
public class RepoSettingsUpdateResponse : BaseApiResponse
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DeploymentWarning? Warning { get; set; }
}
