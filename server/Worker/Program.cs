using Blocks.Genesis;
using Devops.DomainService;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Shared.Models;
using Worker;
using Worker.Configuration;
using Worker.Consumers;
using SeliseBlocks.ConfigurationDriver;

const string _serviceName = "blocks-release-worker";

var vaultType = ApplicationConfigurations.ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, vaultType);
var cloudBuildSecret = await CloudBuildSecret.ProcessBlocksSecret(vaultType);

await CreateHostBuilder(args).Build().RunAsync();

IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration((context, builder) =>
        {
            // ApplicationConfigurations.ConfigureWorkerEnv(builder, args);
            builder.AddMongoDbConfiguration(options =>
            {
                options.ConnectionString = secret.DatabaseConnectionString;
                options.DatabaseName     = secret.RootDatabaseName;
                options.CollectionName   = "Secrets";
                options.SecretKey        = "blocks-secret-release";
            });
        })
        .ConfigureServices((services) =>
        {
            services.AddHttpClient();

            services.Configure<VerioSystemSettings>(services.BuildServiceProvider().GetRequiredService<IConfiguration>().GetSection("VerioSystemSettings"));

            services.AddHostedService<PeriodicPingBackgroundService>();

            services.RegisterApplicationServices(cloudBuildSecret);
            // Worker doesn't host the SignalR hub itself — fan out via HTTP POST to the API's
            // internal broadcast endpoint, which forwards to connected DeploymentLogHub clients.
            services.AddSingleton<IDeploymentHubService, HttpDeploymentHubService>();

            services.AddSingleton<IConsumer<PostBuildQueue>, PostBuildConsumer>();
            services.AddSingleton<IConsumer<LogNotificationQueue>, LogNotificationConsumer>();

            var workerMessageConfig = CloudBuildConstants.GetWorkerMessageConfiguration(secret.MessageConnectionString);
            ApplicationConfigurations.ConfigureWorker(services, workerMessageConfig);
        });

static VaultType ResolveVaultType()
{
    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
    {
        return parsedVaultType;
    }

    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
        ? VaultType.OnPrem
        : VaultType.Azure;
}
