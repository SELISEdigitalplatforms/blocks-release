using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
namespace Devops.DomainService.Deployment.Interfaces;

public interface IBuildService
{
    public Task<BuildResponse> Build(BuildRequest request, Repo? repo);
    public Task<BuildResponse> ManualBuild(RepoBuildRequest request);
    public Task<BuildResponse> HandleWebhookEventAsync(string eventType, string rawJson, string tenantId);
    public Task<BaseApiResponse> UpdateRepoDomain(RepoDomainUpdateRequest request);
}