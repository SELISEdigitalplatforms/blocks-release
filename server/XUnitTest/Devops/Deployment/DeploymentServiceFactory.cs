using System.Collections.Generic;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.TestingTools;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentValidation;
using k8s;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Builds the deployment object graph (BuildService, TestReportService and the
    /// concrete services they depend on) from mocks. Infrastructure concretes
    /// (Kubernetes, message broker) are supplied as mocks and are never exercised by
    /// the tests that use this factory; only the repository/validator/HTTP delegating
    /// paths are asserted.
    /// </summary>
    public sealed class DeploymentServiceFactory
    {
        public Mock<IBuildRepository> BuildRepo { get; } = new();
        public Mock<IRepoRepository> RepoRepo { get; } = new();
        public Mock<IVersionControlService> Vcs { get; } = new();
        public Mock<IGithubWebhookService> Webhook { get; } = new();
        public Mock<IHttpHelperServices> Http { get; } = new();
        public Mock<ICloudBuildSecret> Secret { get; } = new();
        public Mock<ITokenRepository> TokenRepo { get; } = new();
        public Mock<IMessageClient> MessageClient { get; } = new();
        public Mock<INotificationService> Notification { get; } = new();
        public Mock<IDataGatewayDeploymentRepository> DataGatewayRepo { get; } = new();
        public Mock<ITenantLookupRepository> TenantLookup { get; } = new();
        public Mock<IDbContextProvider> DbProvider { get; } = new();
        public Mock<IValidator<RepoDomainUpdateRequest>> DomainValidator { get; } = new();
        public Mock<IValidator<BuildRequest>> BuildValidator { get; } = new();
        public Mock<IServiceScopeFactory> ScopeFactory { get; } = new();
        public Mock<IKubernetes> Kubernetes { get; } = new();
        public Mock<ICustomObjectsOperations> CustomObjects { get; } = new();
        public Mock<ICoreV1Operations> CoreV1 { get; } = new();
        public IConfiguration Config { get; }

        private PipelineRunService _pipelineRunService;

        public DeploymentServiceFactory()
        {
            Config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["RootTenantId"] = "root",
                    ["ScaToolsApiBaseUri"] = "https://sca.example.com"
                })
                .Build();

            Kubernetes.SetupGet(k => k.CustomObjects).Returns(CustomObjects.Object);
            Kubernetes.SetupGet(k => k.CoreV1).Returns(CoreV1.Object);
        }

        /// <summary>
        /// Cached so a test can arrange the Kubernetes mocks and have the same instance reached
        /// through BuildService and LogRetrievalService.
        /// </summary>
        public PipelineRunService PipelineRunService() =>
            _pipelineRunService ??= new(Kubernetes.Object, TokenRepo.Object, Config, Secret.Object);

        public DependencyTrackAnalyticsService ScaAnalyticsService()
        {
            var repoService = new DependencyTrackRepositoryService(DbProvider.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);
            return new DependencyTrackAnalyticsService(
                new Mock<ILogger<DependencyTrackAnalyticsService>>().Object,
                Http.Object, BuildRepo.Object, RepoRepo.Object, repoService, Secret.Object, Config);
        }

        public TestReportService TestReportService() =>
            new(BuildRepo.Object,
                new SASTStrategy(Http.Object, Secret.Object, Config),
                ScaAnalyticsService(),
                new DASTStrategy());

        public LogRetrievalService LogRetrievalService() =>
            new(BuildRepo.Object, RepoRepo.Object, PipelineRunService(), TestReportService(),
                MessageClient.Object, Notification.Object, DataGatewayRepo.Object);

        public BuildService BuildService() =>
            new(new Mock<ILogger<BuildService>>().Object,
                BuildRepo.Object, RepoRepo.Object, Vcs.Object,
                PipelineRunService(), Webhook.Object,
                DomainValidator.Object, MessageClient.Object);

        public DeploymentTeardownService DeploymentTeardownService() =>
            new(new Mock<ILogger<DeploymentTeardownService>>().Object,
                TenantLookup.Object, RepoRepo.Object, BuildService());
    }
}
