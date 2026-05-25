using Blocks.Genesis;
using DeploymentDriver;
using Devops.DomainService;
using Microsoft.Extensions.DependencyInjection;

namespace Blocks.Extensions.DependencyInjection
{
    public static class DeploymentDriverServiceExtension
    {
        public static async Task RegisterBlocksDeploymentServicesAsync(
            this IServiceCollection services,
            VaultType vaultType = VaultType.Azure)
        {
            var cloudBuildSecret = await CloudBuildSecret.ProcessBlocksSecret(vaultType);
            services.RegisterApplicationServices(cloudBuildSecret);
            services.AddScoped<IDeploymentDriverService, DeploymentDriverService>();
        }
    }
}
