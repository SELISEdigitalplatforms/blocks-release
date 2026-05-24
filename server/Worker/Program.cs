using Blocks.Genesis;
using Devops.DomainService;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Shared.Models;
using DomainService.Dtos;
using DomainService.Migration;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Dtos;
using DomainService.Shared.Entities;
using DomainService.Utilities;
using DomainService.Worker;
using Iam.DomainService.Accounts;
using Iam.DomainService.Dtos;
using Iam.DomainService.Shared.Dtos;
using Iam.DomainService.Users;
using Mfa.DomainService.Configuration;
using Worker;
using Worker.Configuration;
using Worker.Consumers;
using Worker.Consumers.Identifier;
using Worker.Consumers.Users;
using SeliseBlocks.ConfigurationDriver;

const string _serviceName = "blocks-deployment-worker";

var vaultType = ResolveVaultType();
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
                options.SecretKey        = "blocks-Secret";
            });
        })
        .ConfigureServices((services) =>
        {
            services.AddHttpClient();

            services.Configure<VerioSystemSettings>(services.BuildServiceProvider().GetRequiredService<IConfiguration>().GetSection("VerioSystemSettings"));

            services.AddSingleton<IConsumer<RefreshTokenEvent>, RefreshTokenWorkerService>();
            services.AddSingleton<IConsumer<UserAuthenticationTimelineEvent>, UserAuthenticationTimelineWorkerService>();
            services.AddSingleton<IConsumer<MfaActionEvent>, UpdateMfaConfigurationService>();

            services.AddSingleton<IConsumer<ResourceMutationEvent>, ResourceMutationConsumer>();
            services.AddSingleton<IConsumer<ResourceSetToPermissionMutationEvent>, ResourceSetToPermissionMutationConsumer>();
            services.AddSingleton<IConsumer<UserMutationEvent>, UserMutationConsumer>();
            services.AddSingleton<IConsumer<AccountActivityEvent>, AccountActivityWorkerService>();
            services.AddSingleton<IConsumer<CreateUserByEmailEvent>, CreateUserByEmailConsumer>();
            services.AddSingleton<IConsumer<CreateUserRequest>, CreateUserConsumer>();
            services.AddSingleton<IConsumer<CreateUserViaSsoEvent>, CreateUserViaSsoConsumer>();
            services.AddSingleton<IConsumer<UserStatusChangedEvent>, UserStatusChangedConsumer>();

            services.AddHostedService<PeriodicPingBackgroundService>();

            services.RegisterAllServices();
            services.RegisterApplicationServices(cloudBuildSecret);
            // Worker doesn't host the SignalR hub itself — fan out via HTTP POST to the API's
            // internal broadcast endpoint, which forwards to connected DeploymentLogHub clients.
            services.AddSingleton<IDeploymentHubService, HttpDeploymentHubService>();

            services.AddSingleton<IConsumer<PostBuildQueue>, PostBuildConsumer>();
            services.AddSingleton<IConsumer<LogNotificationQueue>, LogNotificationConsumer>();

            #region Identifier Service Consumers
            services.AddApplicationServices();
            services.AddSingleton<IConsumer<Tenant>, ConfigureProjectConsumer>();
            services.AddSingleton<IConsumer<DisableDomainBindingRequest>, DisableDomainBindingConsumer>();
            services.AddSingleton<IConsumer<RestoreProjectRequest>, RestoreProjectConsumer>();
            services.AddSingleton<IConsumer<CreateUserByEmailPostEvent_Identifier>, CreateUserByEmailPostConsumer>();
            services.AddSingleton<IConsumer<ConfigureDomainRequest>, DomainConfigureConsumer>();
            services.AddSingleton<IConsumer<MigrationCompletionEvent>, MigrationCompletionConsumer>();
            services.AddSingleton<IConsumer<EnvironmentDataMigrationEvent>, EnvironmentDataMigrationEventConsumer>();
            services.AddSingleton<IConsumer<PublishScheduleCommand>, DataCleanupConsumer>();
            services.AddSingleton<IConsumer<UpdateResourceUsageCommand_Identifier>, UpdateResourceUsageConsumer>();

            var workerMessageConfig = IdpConstants.GetMessageConfiguration(secret.MessageConnectionString);
            var cloudBuildMessageConfig = CloudBuildConstants.GetWorkerMessageConfiguration(secret.MessageConnectionString);

            if (workerMessageConfig.RabbitMqConfiguration != null && cloudBuildMessageConfig.RabbitMqConfiguration != null)
                workerMessageConfig.RabbitMqConfiguration.ConsumerSubscriptions.AddRange(cloudBuildMessageConfig.RabbitMqConfiguration.ConsumerSubscriptions);
            else if (workerMessageConfig.AzureServiceBusConfiguration != null && cloudBuildMessageConfig.AzureServiceBusConfiguration != null)
                workerMessageConfig.AzureServiceBusConfiguration.Queues.AddRange(cloudBuildMessageConfig.AzureServiceBusConfiguration.Queues);

            ApplicationConfigurations.ConfigureWorker(services, workerMessageConfig);
            //ApplicationConfigurations.ConfigureWorker(services, IdentifierConstants.GetMessageConfiguration(secret.MessageConnectionString));
            #endregion
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
