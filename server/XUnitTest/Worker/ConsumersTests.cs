using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Models;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Worker.Consumers;
using Xunit;
using XUnitTest.Devops.Deployment;

namespace XUnitTest.Worker
{
    /// <summary>
    /// Covers the three queue consumers. The RetrieveLog branches are deliberately not
    /// exercised: they hand off to the LogRetrievalService polling loops, which run on a
    /// five second cadence for up to thirty minutes.
    /// </summary>
    public class ConsumersTests
    {
        private readonly DeploymentServiceFactory _f = new();
        private readonly Mock<ILogger<PostBuildConsumer>> _logger = new();

        private IServiceScopeFactory ScopeFactoryWith(IBuildRepository buildRepository)
        {
            var services = new ServiceCollection();
            services.AddSingleton(_f.LogRetrievalService());
            services.AddSingleton(_f.ScaAnalyticsService());
            services.AddSingleton(buildRepository);
            return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
        }

        private PostBuildConsumer PostBuildConsumer(IBuildRepository buildRepository = null) =>
            new(_logger.Object, ScopeFactoryWith(buildRepository ?? _f.BuildRepo.Object), _f.PipelineRunService());

        private static Tenant NewTenant() => new()
        {
            TenantId = "tenant-1",
            TenantGroupId = "group-1",
            Name = "proj",
            Environment = "dev",
            DbConnectionString = "cs",
            JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
        };

        private void VerifyLogged(LogLevel level, string fragment, Times times) =>
            _logger.Verify(
                l => l.Log(
                    level,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, _) => v.ToString().Contains(fragment, StringComparison.Ordinal)),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                times);

        // ---- PostBuildConsumer ----

        [Fact]
        public async Task PostBuildConsumer_BuildNotFound_LogsErrorAndStops()
        {
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1")).ReturnsAsync((Build)null);

            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = PipelineEventTypes.DeletePipeLine
            });

            VerifyLogged(LogLevel.Error, "No build found for pipeline run-1", Times.Once());
        }

        [Fact]
        public async Task PostBuildConsumer_RetrieveDependencyTrackId_LooksUpScaProject()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ReturnsAsync(new Build { ItemId = "build-1", RepoId = "repo-1", RepoName = "org/repo", Branch = "main", ProjectId = "tenant-1" });
            _f.Http
                .Setup(h => h.MakeHttpRequest<ScaLookupResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ReturnsAsync((null, new HttpResponseMessage(HttpStatusCode.NotFound)));

            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = PipelineEventTypes.RetrieveDependencyTrackId
            });

            _f.Http.Verify(h => h.MakeHttpRequest<ScaLookupResponse>(
                It.IsAny<string>(), It.Is<string>(u => u.Contains("org-repo", StringComparison.Ordinal)),
                HttpMethod.Get, It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task PostBuildConsumer_DeletePipeLine_DoesNotThrow()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ReturnsAsync(new Build { ItemId = "build-1" });

            var act = async () => await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = PipelineEventTypes.DeletePipeLine
            });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task PostBuildConsumer_UnknownRepoDeploymentEvent_LogsWarning()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ReturnsAsync(new Build { ItemId = "build-1" });

            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = (PipelineEventTypes)99
            });

            VerifyLogged(LogLevel.Warning, "Unknown build event type", Times.Once());
        }

        [Fact]
        public async Task PostBuildConsumer_DataGatewayDeletePipeLine_SkipsBuildLookup()
        {
            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.DataGatewayPipeline,
                PipelineEventType = PipelineEventTypes.DeletePipeLine
            });

            _f.BuildRepo.Verify(b => b.GetBuildByPipelineRunName(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task PostBuildConsumer_UnknownDataGatewayEvent_LogsWarning()
        {
            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.DataGatewayPipeline,
                PipelineEventType = (PipelineEventTypes)99
            });

            VerifyLogged(LogLevel.Warning, "Unknown build event type", Times.Once());
        }

        [Fact]
        public async Task PostBuildConsumer_UnknownPipelineType_LogsWarning()
        {
            await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = (PipelineTypes)99,
                PipelineEventType = PipelineEventTypes.DeletePipeLine
            });

            VerifyLogged(LogLevel.Warning, "Unknown pipeline type", Times.Once());
        }

        [Fact]
        public async Task PostBuildConsumer_RepositoryThrows_LogsErrorAndSwallows()
        {
            _f.BuildRepo
                .Setup(b => b.GetBuildByPipelineRunName("run-1", "tenant-1"))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = async () => await PostBuildConsumer().Consume(new PostBuildQueue
            {
                ProjectKey = "tenant-1",
                PipelineRunName = "run-1",
                PipelineType = PipelineTypes.RepoDeployment,
                PipelineEventType = PipelineEventTypes.DeletePipeLine
            });

            await act.Should().NotThrowAsync();
            VerifyLogged(LogLevel.Error, "Failed to process message from queue", Times.Once());
        }

        [Fact]
        public async Task PostBuildConsumer_NullTask_LogsErrorAndSwallows()
        {
            var act = async () => await PostBuildConsumer().Consume(null);

            await act.Should().NotThrowAsync();
            VerifyLogged(LogLevel.Error, "Failed to process message from queue", Times.Once());
        }

        // ---- PostProjectCreateConsumer ----

        [Fact]
        public async Task PostProjectCreateConsumer_DelegatesToDataGatewayService()
        {
            var logger = new Mock<ILogger<PostProjectCreateConsumer>>();
            var service = new Mock<IDataGatewayDeploymentService>();
            var project = NewTenant();
            service.Setup(s => s.InitiateDataGatewayInstanceCreation(project)).ReturnsAsync(true);

            await new PostProjectCreateConsumer(logger.Object, service.Object).Consume(project);

            service.Verify(s => s.InitiateDataGatewayInstanceCreation(project), Times.Once);
        }

        [Fact]
        public async Task PostProjectCreateConsumer_ServiceThrows_IsSwallowed()
        {
            var logger = new Mock<ILogger<PostProjectCreateConsumer>>();
            var service = new Mock<IDataGatewayDeploymentService>();
            service
                .Setup(s => s.InitiateDataGatewayInstanceCreation(It.IsAny<Tenant>()))
                .ThrowsAsync(new InvalidOperationException("pipeline down"));

            var act = async () => await new PostProjectCreateConsumer(logger.Object, service.Object)
                .Consume(NewTenant());

            await act.Should().NotThrowAsync();
            logger.Verify(
                l => l.Log(
                    LogLevel.Error,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, _) => v.ToString().Contains("pipeline down", StringComparison.Ordinal)),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                Times.Once);
        }

        [Fact]
        public async Task PostProjectCreateConsumer_NullProject_IsSwallowed()
        {
            var logger = new Mock<ILogger<PostProjectCreateConsumer>>();
            var service = new Mock<IDataGatewayDeploymentService>();

            var act = async () => await new PostProjectCreateConsumer(logger.Object, service.Object).Consume(null);

            await act.Should().NotThrowAsync();
            service.Verify(s => s.InitiateDataGatewayInstanceCreation(It.IsAny<Tenant>()), Times.Never);
        }

        // ---- LogNotificationConsumer ----

        [Fact]
        public async Task LogNotificationConsumer_ForwardsQueuePayloadToNotificationService()
        {
            var notification = new Mock<INotificationService>();
            var message = new BuildEventResponse { EventGroup = EventGroups.Deploy, EventType = EventTypes.Log };
            var task = new LogNotificationQueue
            {
                Message = message,
                UserIds = new List<string> { "user-1" },
                TenantId = "tenant-1",
                RepoId = "repo-1",
                BuildStatus = "Running"
            };

            await new LogNotificationConsumer(notification.Object).Consume(task);

            notification.Verify(n => n.NotifyPipeLineLogData(message, task.UserIds, "tenant-1", "repo-1", "Running"), Times.Once);
        }
    }
}
