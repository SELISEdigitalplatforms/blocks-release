using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.DataGetwayDeployment.Models;
using Devops.DomainService.DataGetwayDeployment.Services;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentAssertions;
using k8s;
using k8s.Autorest;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.DataGatewayDeployment
{
    /// <summary>
    /// Covers the DataGateway pipeline orchestration. The concrete PipelineRunService is
    /// built over a mocked IKubernetes so the submit call can be made to succeed or fail.
    /// </summary>
    public class DataGatewayDeploymentServiceTests : IDisposable
    {
        private readonly Mock<ILogger<DataGatewayDeploymentService>> _logger = new();
        private readonly Mock<IDataGatewayDeploymentRepository> _repository = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IKubernetes> _k8s = new();
        private readonly Mock<ICustomObjectsOperations> _customObjects = new();
        private readonly Mock<ITokenRepository> _tokenRepository = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                ["DatagatewayClusterNames"] = "cluster-a",
                ["DatagatewayClusterRevision"] = "main"
            })
            .Build();

        public DataGatewayDeploymentServiceTests()
        {
            _k8s.SetupGet(k => k.CustomObjects).Returns(_customObjects.Object);
            _secret.SetupGet(s => s.SeliseGithubPat).Returns("pat@");
        }

        public void Dispose() => BlocksContext.ClearContext();

        private void SetContext(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        private void SetupSubmitSucceeds() =>
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new HttpOperationResponse<object>
                {
                    Body = new Dictionary<string, object> { ["metadata"] = "created" },
                    Request = new HttpRequestMessage(),
                    Response = new HttpResponseMessage()
                });

        private void SetupSubmitFails() =>
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("cluster rejected the pipeline run"));

        private DataGatewayDeploymentService Service() =>
            new(_logger.Object,
                new PipelineRunService(_k8s.Object, _tokenRepository.Object, _configuration, _secret.Object),
                _repository.Object, _tenants.Object, _configuration, _messageClient.Object);

        private static Tenant NewTenant(string tenantId = "tenant-1", string environment = "dev") => new()
        {
            TenantId = tenantId,
            TenantGroupId = "group-1",
            Name = "proj",
            Environment = environment,
            DbConnectionString = "cs",
            JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
        };

        // ---- InitiateDataGatewayInstanceCreation ----

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_Success_UpsertsInstanceAndQueuesRetrieveLog()
        {
            var project = NewTenant();
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync(new BlocksGuid { EncodedValue = "abc123" });
            _repository
                .Setup(r => r.UpsertDataGatewayInstanceAsync(project, It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            SetupSubmitSucceeds();

            var result = await Service().InitiateDataGatewayInstanceCreation(project);

            result.Should().BeTrue();
            // The environment code is prefixed to the encoded tenant group guid.
            _repository.Verify(r => r.UpsertDataGatewayInstanceAsync(project, "dabc123", It.IsAny<string>()), Times.Once);
            _messageClient.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<PostBuildQueue>>(c =>
                    c.Payload.ProjectKey == "tenant-1" &&
                    c.Payload.PipelineType == PipelineTypes.DataGatewayPipeline &&
                    c.Payload.PipelineEventType == PipelineEventTypes.RetrieveLog)), Times.Once);
        }

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_UnknownEnvironment_UsesFallbackCode()
        {
            var project = NewTenant(environment: "sandbox");
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync(new BlocksGuid { EncodedValue = "abc123" });
            _repository
                .Setup(r => r.UpsertDataGatewayInstanceAsync(It.IsAny<Tenant>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            SetupSubmitSucceeds();

            await Service().InitiateDataGatewayInstanceCreation(project);

            _repository.Verify(r => r.UpsertDataGatewayInstanceAsync(project, "nabc123", It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_NoBlocksGuid_ReturnsFalse()
        {
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync((BlocksGuid)null);

            var result = await Service().InitiateDataGatewayInstanceCreation(NewTenant());

            result.Should().BeFalse();
            _repository.Verify(r => r.UpsertDataGatewayInstanceAsync(
                It.IsAny<Tenant>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_PipelineCreationFails_ReturnsFalse()
        {
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync(new BlocksGuid { EncodedValue = "abc123" });
            SetupSubmitFails();

            var result = await Service().InitiateDataGatewayInstanceCreation(NewTenant());

            result.Should().BeFalse();
            _repository.Verify(r => r.UpsertDataGatewayInstanceAsync(
                It.IsAny<Tenant>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()), Times.Never);
        }

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_QueueThrows_ReturnsFalse()
        {
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync(new BlocksGuid { EncodedValue = "abc123" });
            _repository
                .Setup(r => r.UpsertDataGatewayInstanceAsync(It.IsAny<Tenant>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            SetupSubmitSucceeds();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PostBuildQueue>>()))
                .ThrowsAsync(new InvalidOperationException("broker unavailable"));

            var result = await Service().InitiateDataGatewayInstanceCreation(NewTenant());

            // The instance is already stored, but the caller is told the flow did not complete.
            result.Should().BeFalse();
            _repository.Verify(r => r.UpsertDataGatewayInstanceAsync(
                It.IsAny<Tenant>(), It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task InitiateDataGatewayInstanceCreation_RepositoryThrows_ReturnsFalse()
        {
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ThrowsAsync(new InvalidOperationException("mongo down"));

            (await Service().InitiateDataGatewayInstanceCreation(NewTenant())).Should().BeFalse();
        }

        // ---- InitiateManualDataGatewayInstanceCreation ----

        [Fact]
        public async Task InitiateManualDataGatewayInstanceCreation_NoTenantContext_ReturnsFalse()
        {
            SetContext(string.Empty);

            var result = await Service().InitiateManualDataGatewayInstanceCreation();

            result.Should().BeFalse();
            _repository.Verify(r => r.GetTenantByIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task InitiateManualDataGatewayInstanceCreation_TenantNotFound_ReturnsFalse()
        {
            SetContext("tenant-1");
            _repository.Setup(r => r.GetTenantByIdAsync("tenant-1")).ReturnsAsync((Tenant)null);

            (await Service().InitiateManualDataGatewayInstanceCreation()).Should().BeFalse();
        }

        [Fact]
        public async Task InitiateManualDataGatewayInstanceCreation_TenantFound_RunsCreationFlow()
        {
            SetContext("tenant-1");
            var project = NewTenant();
            _repository.Setup(r => r.GetTenantByIdAsync("tenant-1")).ReturnsAsync(project);
            _repository.Setup(r => r.GetBlocksGuidAsync("group-1")).ReturnsAsync(new BlocksGuid { EncodedValue = "abc123" });
            _repository
                .Setup(r => r.UpsertDataGatewayInstanceAsync(project, It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            SetupSubmitSucceeds();

            (await Service().InitiateManualDataGatewayInstanceCreation()).Should().BeTrue();
        }

        [Fact]
        public async Task InitiateManualDataGatewayInstanceCreation_RepositoryThrows_ReturnsFalse()
        {
            SetContext("tenant-1");
            _repository.Setup(r => r.GetTenantByIdAsync("tenant-1")).ThrowsAsync(new InvalidOperationException("mongo down"));

            (await Service().InitiateManualDataGatewayInstanceCreation()).Should().BeFalse();
        }
    }
}
