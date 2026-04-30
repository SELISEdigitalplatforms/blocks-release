

using Blocks.Genesis;

namespace Devops.DomainService.DataGatewayDeployment.Services
{
    public interface IDataGatewayDeploymentService
    {
        /// <summary>
        /// Initiates the creation of a DataGateway instance manually for a specific project.
        /// </summary>
        /// <param name="projectKey">The ID of the project (tenant) for which to create the DataGateway instance.</param>
        Task<bool> InitiateManualDataGatewayInstanceCreation(string projectKey);

        /// <summary>
        /// Initiates the creation of a DataGateway instance automatically using tenant data.
        /// </summary>
        /// <param name="project">The tenant object representing the project details.</param>
        Task<bool> InitiateDataGatewayInstanceCreation(Tenant project);
    }
}
