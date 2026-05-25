using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Entity;
using Devops.DomainService.DataGetwayDeployment.Models;

namespace Devops.DomainService.DataGatewayDeployment.Services
{
    public interface IDataGatewayDeploymentRepository
    {
        Task<BlocksGuid?> GetBlocksGuidAsync(string tenantGroupId);
        Task<DataGatewayInstance?> GetDataGatewayInstanceAsync(string tenantId, string projectGuidId);
        Task<bool> UpsertDataGatewayInstanceAsync(Tenant project, string projectKey, string pipelineRunName);
        Task<DataGatewayInstance?> AddDataGatewayInstanceAsync(DataGatewayInstance instance);
        Task<bool> UpdatePipelineStatusAsync(string tenantId, string pipelineRunName, string newStatus);
        Task<Tenant?> GetTenantByIdAsync(string projectId);
    }
}
