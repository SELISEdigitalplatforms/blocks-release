using Microsoft.Extensions.DependencyInjection;

using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.RepositoryServices;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Services;
using Devops.DomainService.Validators;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.Services;
using FluentValidation;
using k8s;
using Devops.DomainService.TestingTools;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.DataGetwayDeployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.AnalyticsTool.Services.Sast;

namespace Devops.DomainService;

public static class ServiceRegistry
{
    public static void RegisterApplicationServices(this IServiceCollection services, ICloudBuildSecret cloudBuildSecret)
    {
        services.AddSingleton<ICloudBuildSecret>(cloudBuildSecret);

        services.AddTransient<ITokenRepository, TokenRepository>();
        services.AddTransient<IBuildRepository, BuildRepository>();
        services.AddTransient<IRepoRepository, RepoRepository>();

        services.AddScoped<IAuthService,AuthService>();
        services.AddScoped<IVersionControlService, GithubService>();
        services.AddScoped<IGithubWebhookService,GithubWebhookService>();
        services.AddScoped<LogRetrievalService>();
        services.AddScoped<BuildService>();
        services.AddScoped<IBuildService, BuildService>();
        
        services.AddScoped<TestReportService>();
        services.AddScoped<SASTStrategy>();
        services.AddScoped<DASTStrategy>();
        services.AddScoped<DependencyTrackAnalyticsService>();
        

        services.AddSingleton<INotificationService,NotificationService>();
        services.AddSingleton<IHttpHelperServices, HttpHelperServices>();
        services.AddSingleton<PipelineRunService>();
        services.AddSingleton<VcsRepositoryService>();
        services.AddSingleton<DependencyTrackAuthService>();
        services.AddSingleton<DependencyTrackRepositoryService>();
        services.AddSingleton<IDataGatewayDeploymentService, DataGatewayDeploymentService>();
        services.AddSingleton<IDataGatewayDeploymentRepository, DataGatewayDeploymentRepository>();

        services.AddSingleton<IValidator<BuildRequest>, BuildRequestValidator>();
        services.AddSingleton<IValidator<RepoDomainUpdateRequest>, RepoDomainUpdateValidator>();
        services.AddSingleton<IDeploymentHubService, NullDeploymentHubService>();
        services.AddSingleton<ISonarQubeAuthService, SonarQubeAuthService>();

        // Kubernetes credentials come from the vaulted "KubeConfig" secret (base64-encoded
        // kubeconfig YAML), with the developer's local kubeconfig as the only backup. When
        // neither is usable the client stays null so startup still succeeds, matching the
        // previous behaviour - callers already guard against an unavailable cluster.
        services.AddSingleton<IKubernetes>(_ =>
        {
            if (!string.IsNullOrWhiteSpace(cloudBuildSecret.KubeConfig))
            {
                try
                {
                    using var stream = new MemoryStream(Convert.FromBase64String(cloudBuildSecret.KubeConfig));
                    var vaultConfig = KubernetesClientConfiguration.LoadKubeConfigAsync(stream)
                                                                   .GetAwaiter().GetResult();
                    return new Kubernetes(KubernetesClientConfiguration.BuildConfigFromConfigObject(vaultConfig));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Kubernetes: vaulted KubeConfig is unusable ({ex.GetType().Name}: {ex.Message}). Falling back to the local kubeconfig.");
                }
            }
            else
            {
                Console.WriteLine("Kubernetes: no KubeConfig secret found in the vault. Falling back to the local kubeconfig.");
            }

            try
            {
                return new Kubernetes(KubernetesClientConfiguration.BuildConfigFromConfigFile());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Kubernetes: no local kubeconfig either ({ex.GetType().Name}: {ex.Message}). Kubernetes client is unavailable.");
                return null!;
            }
        });

    }
}