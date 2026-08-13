using Blocks.Genesis;
using ReleaseDriver;
using Devops.DomainService;
using Microsoft.Extensions.DependencyInjection;

namespace Blocks.Extensions.DependencyInjection
{
    public static class ReleaseDriverServiceExtension
    {
        public static async Task RegisterBlocksReleaseServicesAsync(
            this IServiceCollection services,
            VaultType vaultType = VaultType.Azure)
        {
            var cloudBuildSecret = await CloudBuildSecret.ProcessBlocksSecret(vaultType);
            services.RegisterApplicationServices(cloudBuildSecret);
            services.AddScoped<IReleaseDriverService, ReleaseDriverService>();
        }
    }
}
