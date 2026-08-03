using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Entity;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.DataGetwayDeployment.Models;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.DataGatewayDeployment
{
    /// <summary>
    /// Unit tests for <see cref="DataGatewayDeploymentRepository"/>. This repository is read by the
    /// deployment worker while a pipeline is running, so every method has to answer rather than
    /// throw when Mongo is unreachable. The graceful answers (null, false) are pinned here alongside
    /// the tenant routing, which decides which database each call lands in.
    /// </summary>
    public class DataGatewayDeploymentRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<IMongoDatabase> _rootDb = new();
        private readonly Mock<IMongoDatabase> _tenantDb = new();
        private readonly Mock<IMongoCollection<BlocksGuid>> _blocksGuids = new();
        private readonly Mock<IMongoCollection<Tenant>> _tenants = new();
        private readonly Mock<IMongoCollection<DataGatewayInstance>> _instances = new();
        private readonly DataGatewayDeploymentRepository _sut;

        public DataGatewayDeploymentRepositoryTests()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");
            secret.SetupGet(s => s.RootDatabaseName).Returns("root");

            _provider.Setup(p => p.GetDatabase("mongodb://localhost", "root")).Returns(_rootDb.Object);
            _provider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(_tenantDb.Object);
            _rootDb.Setup(d => d.GetCollection<BlocksGuid>("BlocksGuids", null)).Returns(_blocksGuids.Object);
            _rootDb.Setup(d => d.GetCollection<Tenant>("Tenants", null)).Returns(_tenants.Object);
            _tenantDb.Setup(d => d.GetCollection<DataGatewayInstance>("DataGatewayInstances", null))
                     .Returns(_instances.Object);

            _sut = new DataGatewayDeploymentRepository(
                new Mock<ILogger<DataGatewayDeploymentRepository>>().Object, _provider.Object, secret.Object);
        }

        /// <summary>Genesis' Tenant has required members, so every fixture goes through here.</summary>
        private static Tenant Project(string tenantId = "tenant-b", string environment = "dev") => new()
        {
            TenantId = tenantId,
            Name = "Blue",
            Environment = environment,
            DbConnectionString = "mongodb://localhost",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "x" },
        };

        /// <summary>Makes the next Find on the collection yield the supplied documents.</summary>
        private static void SetupFind<T>(Mock<IMongoCollection<T>> collection, params T[] documents)
        {
            var cursor = new Mock<IAsyncCursor<T>>();
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                  .ReturnsAsync(documents.Length > 0)
                  .ReturnsAsync(false);
            cursor.SetupGet(c => c.Current).Returns(documents);

            collection.Setup(c => c.FindAsync(
                          It.IsAny<FilterDefinition<T>>(),
                          It.IsAny<FindOptions<T, T>>(),
                          It.IsAny<CancellationToken>()))
                      .ReturnsAsync(cursor.Object);
        }

        private static void SetupFindThrows<T>(Mock<IMongoCollection<T>> collection)
        {
            collection.Setup(c => c.FindAsync(
                          It.IsAny<FilterDefinition<T>>(),
                          It.IsAny<FindOptions<T, T>>(),
                          It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new TimeoutException("mongo unreachable"));
        }

        [Fact]
        public async Task GetTenantByIdAsync_ReturnsTheTenantFromTheRootDatabase()
        {
            SetupFind(_tenants, Project());

            var result = await _sut.GetTenantByIdAsync("tenant-b");

            result.Should().NotBeNull();
            result!.TenantId.Should().Be("tenant-b");
        }

        [Fact]
        public async Task GetTenantByIdAsync_ReturnsNullForAnUnknownProject()
        {
            SetupFind(_tenants);

            (await _sut.GetTenantByIdAsync("gone")).Should().BeNull();
        }

        [Fact]
        public async Task GetTenantByIdAsync_ReturnsNullRatherThanThrowingWhenMongoIsUnreachable()
        {
            SetupFindThrows(_tenants);

            (await _sut.GetTenantByIdAsync("tenant-b")).Should().BeNull();
        }

        [Fact]
        public async Task GetBlocksGuidAsync_ReturnsTheGuidRecordForTheTenantGroup()
        {
            SetupFind(_blocksGuids, new BlocksGuid { TenantGroupId = "group-1" });

            var result = await _sut.GetBlocksGuidAsync("group-1");

            result.Should().NotBeNull();
            result!.TenantGroupId.Should().Be("group-1");
        }

        [Fact]
        public async Task GetBlocksGuidAsync_ReturnsNullRatherThanThrowingWhenMongoIsUnreachable()
        {
            SetupFindThrows(_blocksGuids);

            (await _sut.GetBlocksGuidAsync("group-1")).Should().BeNull();
        }

        [Fact]
        public async Task GetDataGatewayInstanceAsync_ReadsFromTheTenantDatabase()
        {
            SetupFind(_instances, new DataGatewayInstance { TenantId = "guid-1" });

            var result = await _sut.GetDataGatewayInstanceAsync("tenant-b", "guid-1");

            result.Should().NotBeNull();
            // The instance lives in the tenant's own database, not the root one.
            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
        }

        [Fact]
        public async Task GetDataGatewayInstanceAsync_ReturnsNullRatherThanThrowingWhenMongoIsUnreachable()
        {
            SetupFindThrows(_instances);

            (await _sut.GetDataGatewayInstanceAsync("tenant-b", "guid-1")).Should().BeNull();
        }

        [Fact]
        public async Task AddDataGatewayInstanceAsync_InsertsIntoTheTenantDatabaseAndEchoesTheInstance()
        {
            var instance = new DataGatewayInstance { TenantId = "tenant-b", ProjectGuid = "guid-1" };
            _instances.Setup(c => c.InsertOneAsync(instance, null, It.IsAny<CancellationToken>()))
                      .Returns(Task.CompletedTask);

            var result = await _sut.AddDataGatewayInstanceAsync(instance);

            result.Should().BeSameAs(instance);
            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
            _instances.Verify(c => c.InsertOneAsync(instance, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task AddDataGatewayInstanceAsync_ReturnsNullRatherThanThrowingWhenTheInsertFails()
        {
            _instances.Setup(c => c.InsertOneAsync(
                          It.IsAny<DataGatewayInstance>(), null, It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new TimeoutException("mongo unreachable"));

            var result = await _sut.AddDataGatewayInstanceAsync(
                new DataGatewayInstance { TenantId = "tenant-b", ProjectGuid = "guid-1" });

            result.Should().BeNull();
        }

        [Fact]
        public async Task UpsertDataGatewayInstanceAsync_InsertsAFirstInstanceForTheProject()
        {
            SetupFind(_instances);
            DataGatewayInstance inserted = null;
            _instances.Setup(c => c.InsertOneAsync(
                          It.IsAny<DataGatewayInstance>(), null, It.IsAny<CancellationToken>()))
                      .Callback<DataGatewayInstance, InsertOneOptions, CancellationToken>((i, _, _) => inserted = i)
                      .Returns(Task.CompletedTask);

            var result = await _sut.UpsertDataGatewayInstanceAsync(
                Project(), "guid-1", "run-1");

            result.Should().BeTrue();
            inserted.Should().NotBeNull();
            inserted.TenantId.Should().Be("tenant-b");
            inserted.ProjectGuid.Should().Be("guid-1");
            inserted.LastPipelineRunName.Should().Be("run-1");
            inserted.LastDeploymentStatus.Should().Be("InProgress");
            inserted.DataGatewayInstanceDeploymentLog.Should().ContainSingle()
                    .Which.PipelineRunName.Should().Be("run-1");
        }

        [Fact]
        public async Task UpsertDataGatewayInstanceAsync_UpdatesAnExistingInstanceInsteadOfInsertingASecond()
        {
            SetupFind(_instances, new DataGatewayInstance { TenantId = "tenant-b", ProjectGuid = "guid-1" });
            _instances.Setup(c => c.UpdateOneAsync(
                          It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateOptions>(),
                          It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            var result = await _sut.UpsertDataGatewayInstanceAsync(
                Project(), "guid-1", "run-2");

            result.Should().BeTrue();
            _instances.Verify(c => c.InsertOneAsync(
                It.IsAny<DataGatewayInstance>(), null, It.IsAny<CancellationToken>()), Times.Never);
            _instances.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UpsertDataGatewayInstanceAsync_ReturnsFalseRatherThanThrowingWhenTheWriteFails()
        {
            SetupFind(_instances);
            _instances.Setup(c => c.InsertOneAsync(
                          It.IsAny<DataGatewayInstance>(), null, It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new TimeoutException("mongo unreachable"));

            var result = await _sut.UpsertDataGatewayInstanceAsync(
                Project(), "guid-1", "run-1");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_ReportsSuccessWhenARowWasModified()
        {
            _instances.Setup(c => c.UpdateOneAsync(
                          It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateOptions>(),
                          It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            (await _sut.UpdatePipelineStatusAsync("tenant-b", "run-1", "Succeeded")).Should().BeTrue();
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_ReportsFailureWhenNoInstanceMatchesTheRun()
        {
            _instances.Setup(c => c.UpdateOneAsync(
                          It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateOptions>(),
                          It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new UpdateResult.Acknowledged(0, 0, null));

            (await _sut.UpdatePipelineStatusAsync("tenant-b", "unknown-run", "Succeeded")).Should().BeFalse();
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_ReportsFailureWhenTheRowMatchedButNothingChanged()
        {
            _instances.Setup(c => c.UpdateOneAsync(
                          It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateOptions>(),
                          It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new UpdateResult.Acknowledged(1, 0, null));

            (await _sut.UpdatePipelineStatusAsync("tenant-b", "run-1", "Succeeded")).Should().BeFalse();
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_ReturnsFalseRatherThanThrowingWhenMongoIsUnreachable()
        {
            _instances.Setup(c => c.UpdateOneAsync(
                          It.IsAny<FilterDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateDefinition<DataGatewayInstance>>(),
                          It.IsAny<UpdateOptions>(),
                          It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new TimeoutException("mongo unreachable"));

            (await _sut.UpdatePipelineStatusAsync("tenant-b", "run-1", "Succeeded")).Should().BeFalse();
        }
    }
}
