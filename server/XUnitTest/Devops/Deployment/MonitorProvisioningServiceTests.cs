using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Unit tests for <see cref="MonitorProvisioningService"/>: the monitor a first deployment creates must
    /// look exactly like one blocks-monitor's "Add monitor" form would create with its defaults.
    /// </summary>
    public class MonitorProvisioningServiceTests
    {
        private readonly Mock<IMongoCollection<MonitorConfiguration>> _monitors = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly MonitorProvisioningService _sut;

        public MonitorProvisioningServiceTests()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");
            secret.SetupGet(s => s.RootDatabaseName).Returns("root");

            var rootDb = new Mock<IMongoDatabase>();
            rootDb.Setup(d => d.GetCollection<MonitorConfiguration>("MonitorConfigurations", null))
                  .Returns(_monitors.Object);

            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase("mongodb://localhost", "root")).Returns(rootDb.Object);

            _sut = new MonitorProvisioningService(
                new Mock<ILogger<MonitorProvisioningService>>().Object, provider.Object, secret.Object,
                _messageClient.Object);
        }

        private static Repo ARepo() => new()
        {
            ItemId = "repo-1",
            ProjectId = "tenant-1",
            RepoName = "nuzattasnim/VanGuard",
            RepoUrl = "https://github.com/nuzattasnim/VanGuard",
            DefaultDeploymentUrl = "https://vanguard.default.example.com",
            CustomDeploymentUrl = null
        };

        private void SetupExistingCount(long count) =>
            _monitors.Setup(c => c.CountDocumentsAsync(
                         It.IsAny<FilterDefinition<MonitorConfiguration>>(),
                         It.IsAny<CountOptions>(),
                         It.IsAny<CancellationToken>()))
                     .ReturnsAsync(count);

        [Theory]
        [InlineData("https://github.com/nuzattasnim/VanGuard", "VanGuard")]
        [InlineData("https://github.com/nuzattasnim/VanGuard/", "VanGuard")]
        [InlineData("", "nuzattasnim/VanGuard")]
        [InlineData(null, "nuzattasnim/VanGuard")]
        public void MonitorName_TakesTheLastSegmentOfTheRepoUrl(string repoUrl, string expected)
        {
            var repo = ARepo();
            repo.RepoUrl = repoUrl;

            MonitorProvisioningService.MonitorName(repo).Should().Be(expected);
        }

        [Fact]
        public void BuildMonitor_UsesTheAddMonitorFormDefaults()
        {
            var now = DateTime.UtcNow;

            var monitor = MonitorProvisioningService.BuildMonitor(ARepo(), "user-1", now);

            monitor.Should().NotBeNull();
            monitor!.ItemId.Should().NotBeNullOrWhiteSpace();
            monitor.TenantId.Should().Be("tenant-1");
            monitor.Name.Should().Be("VanGuard");
            monitor.Url.Should().Be("https://vanguard.default.example.com");
            monitor.RepoId.Should().Be("repo-1");
            monitor.RepoName.Should().Be("nuzattasnim/VanGuard");
            monitor.MonitorConfigurationType.Should().Be(MonitorConfigurationTypes.OutboundPing);
            monitor.MonitorSourceType.Should().Be(MonitorSourceTypes.DeployedServices);
            monitor.ProtocolType.Should().Be(MonitorProtocolTypes.HTTP);
            monitor.HttpMethodType.Should().Be(MonitorHttpMethodTypes.HEAD);
            monitor.IntervalInSeconds.Should().Be(60);
            monitor.TimeoutInSeconds.Should().Be(30);
            monitor.IsActive.Should().BeTrue();
            monitor.CreatedBy.Should().Be("user-1");
            monitor.CreatedDate.Should().Be(now);
        }

        [Fact]
        public void BuildMonitor_PrefersTheCustomDeploymentUrl()
        {
            var repo = ARepo();
            repo.CustomDeploymentUrl = "https://vanguard.example.com";

            MonitorProvisioningService.BuildMonitor(repo, null, DateTime.UtcNow)!.Url
                .Should().Be("https://vanguard.example.com");
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void BuildMonitor_FallsBackToTheDefaultUrlWhenCustomIsBlank(string custom)
        {
            var repo = ARepo();
            repo.CustomDeploymentUrl = custom;

            MonitorProvisioningService.BuildMonitor(repo, null, DateTime.UtcNow)!.Url
                .Should().Be("https://vanguard.default.example.com");
        }

        [Fact]
        public void BuildMonitor_AddsASchemeToABareHost()
        {
            var repo = ARepo();
            repo.DefaultDeploymentUrl = "vanguard.default.example.com";

            MonitorProvisioningService.BuildMonitor(repo, null, DateTime.UtcNow)!.Url
                .Should().Be("https://vanguard.default.example.com");
        }

        [Fact]
        public void BuildMonitor_ReturnsNullWithoutAnyDeploymentUrl()
        {
            var repo = ARepo();
            repo.DefaultDeploymentUrl = null;

            MonitorProvisioningService.BuildMonitor(repo, null, DateTime.UtcNow).Should().BeNull();
        }

        [Fact]
        public async Task CreateMonitorForRepoAsync_InsertsTheMonitorAndNotifiesTheMonitorWorker()
        {
            SetupExistingCount(0);
            MonitorConfiguration inserted = null;
            _monitors.Setup(c => c.InsertOneAsync(
                         It.IsAny<MonitorConfiguration>(), It.IsAny<InsertOneOptions>(), It.IsAny<CancellationToken>()))
                     .Callback<MonitorConfiguration, InsertOneOptions, CancellationToken>((m, _, _) => inserted = m)
                     .Returns(Task.CompletedTask);

            var error = await _sut.CreateMonitorForRepoAsync(ARepo());

            error.Should().BeNull();
            inserted.Should().NotBeNull();
            inserted!.Name.Should().Be("VanGuard");
            _messageClient.Verify(m => m.SendToConsumerAsync(It.Is<ConsumerMessage<MonitorConfigurationUpdateQueue>>(
                msg => msg.ConsumerName == "blocks_alert_monitor_config_update_listener"
                       && msg.Payload.MonitorId == inserted.ItemId)), Times.Once);
        }

        [Fact]
        public async Task CreateMonitorForRepoAsync_SkipsARepoThatAlreadyHasAMonitor()
        {
            SetupExistingCount(1);

            var error = await _sut.CreateMonitorForRepoAsync(ARepo());

            error.Should().BeNull();
            _monitors.Verify(c => c.InsertOneAsync(
                It.IsAny<MonitorConfiguration>(), It.IsAny<InsertOneOptions>(), It.IsAny<CancellationToken>()), Times.Never);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<MonitorConfigurationUpdateQueue>>()), Times.Never);
        }

        [Fact]
        public async Task CreateMonitorForRepoAsync_ReportsADatabaseFailure()
        {
            SetupExistingCount(0);
            _monitors.Setup(c => c.InsertOneAsync(
                         It.IsAny<MonitorConfiguration>(), It.IsAny<InsertOneOptions>(), It.IsAny<CancellationToken>()))
                     .ThrowsAsync(new TimeoutException("mongo down"));

            var error = await _sut.CreateMonitorForRepoAsync(ARepo());

            error.Should().Be("Failed to add the repository to Blocks Monitor.");
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<MonitorConfigurationUpdateQueue>>()), Times.Never);
        }

        [Fact]
        public async Task CreateMonitorForRepoAsync_TreatsAQueueFailureAsNonFatal()
        {
            SetupExistingCount(0);
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<MonitorConfigurationUpdateQueue>>()))
                          .ThrowsAsync(new InvalidOperationException("bus down"));

            var error = await _sut.CreateMonitorForRepoAsync(ARepo());

            error.Should().BeNull();
        }

        [Fact]
        public async Task CreateMonitorForRepoAsync_ReportsAMissingDeploymentUrl()
        {
            var repo = ARepo();
            repo.DefaultDeploymentUrl = null;

            var error = await _sut.CreateMonitorForRepoAsync(repo);

            error.Should().Be("The repository has no deployment URL to monitor.");
        }
    }
}
