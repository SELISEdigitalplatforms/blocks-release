using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

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
        services.AddTransient<ITenantLookupRepository, TenantLookupRepository>();

        services.AddScoped<IAuthService,AuthService>();
        services.AddScoped<IVersionControlService, GithubService>();
        services.AddScoped<IGithubWebhookService,GithubWebhookService>();
        services.AddScoped<LogRetrievalService>();
        services.AddScoped<BuildService>();
        services.AddScoped<IBuildService, BuildService>();
        services.AddScoped<IDeploymentTeardownService, DeploymentTeardownService>();

        // Scoped, like the secrets package's own services: they read the request-scoped
        // BlocksContext, so a singleton would capture the first caller's tenant and serve that
        // identity to everyone afterwards.
        services.AddScoped<IRepoSecretService, RepoSecretService>();
        
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

        services.AddSingleton<IKubernetes>(sp =>
        {
            var env = sp.GetRequiredService<IHostEnvironment>();

            if (env.IsDevelopment())
            {
                try
                {
                    var kubeConfig = KubernetesClientConfiguration.BuildConfigFromConfigFile();
                    return new Kubernetes(kubeConfig);
                }
                catch
                {
                    return null!;
                }
            }
            try
            {
                var config = KubernetesClientConfiguration.InClusterConfig();
                return new Kubernetes(config);
            }
            catch
            {
                try
                {
                    var kubeConfig = KubernetesClientConfiguration.BuildConfigFromConfigFile();
                    return new Kubernetes(kubeConfig);
                }
                catch
                {
                    return null!;
                }
            }
        });

    }
}