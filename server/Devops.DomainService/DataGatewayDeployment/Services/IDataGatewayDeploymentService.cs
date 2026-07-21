

using Blocks.Genesis;

namespace Devops.DomainService.DataGatewayDeployment.Services
{
    public interface IDataGatewayDeploymentService
    {
        /// <summary>
        /// Initiates the creation of a DataGateway instance manually for the project (tenant)
        /// resolved from the current BlocksContext.
        /// </summary>
        Task<bool> InitiateManualDataGatewayInstanceCreation();

        /// <summary>
        /// Initiates the creation of a DataGateway instance automatically using tenant data.
        /// </summary>
        /// <param name="project">The tenant object representing the project details.</param>
        Task<bool> InitiateDataGatewayInstanceCreation(Tenant project);
    }
}
