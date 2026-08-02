using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Unit tests for <see cref="BuildRepository"/>. Build status is written from the pipeline
    /// watcher, where a failed write must be logged and swallowed rather than allowed to kill the
    /// polling loop. That, and the tenant database each write is routed to, are what these pin.
    /// </summary>
    public class BuildRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<IMongoDatabase> _tenantDb = new();
        private readonly Mock<IMongoCollection<Build>> _rootBuilds = new();
        private readonly Mock<IMongoCollection<Build>> _tenantBuilds = new();
        private readonly Mock<IMongoCollection<HostingProvider>> _providers = new();
        private readonly BuildRepository _sut;

        public BuildRepositoryTests()
        {
            _provider.Setup(p => p.GetCollection<Build>("Builds")).Returns(_rootBuilds.Object);
            _provider.Setup(p => p.GetCollection<HostingProvider>("HostingProviders")).Returns(_providers.Object);
            _provider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(_tenantDb.Object);
            _tenantDb.Setup(d => d.GetCollection<Build>("Builds", null)).Returns(_tenantBuilds.Object);

            _sut = new BuildRepository(
                _provider.Object,
                new Mock<ILogger<BuildRepository>>().Object,
                new ConfigurationBuilder()
                    .AddInMemoryCollection(new Dictionary<string, string> { ["RootTenantId"] = "root" })
                    .Build(),
                new Mock<IBlocksSecret>().Object);
        }

        /// <summary>
        /// The repository catches MongoWriteException specifically, so the tests have to throw that
        /// exact type rather than a convenient stand-in.
        /// </summary>
        /// <summary>
        /// The repository catches MongoWriteException specifically, so the tests have to throw that
        /// exact type. WriteError has no public constructor in the 3.x driver, so it is built
        /// through the internal one rather than by throwing a convenient stand-in.
        /// </summary>
        private static MongoWriteException WriteFailure()
        {
            var writeError = (WriteError)Activator.CreateInstance(
                typeof(WriteError),
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic,
                null,
                [ServerErrorCategory.DuplicateKey, 11000, "duplicate key", (BsonDocument)null],
                null);

            return new MongoWriteException(
                new MongoDB.Driver.Core.Connections.ConnectionId(
                    new MongoDB.Driver.Core.Servers.ServerId(
                        new MongoDB.Driver.Core.Clusters.ClusterId(1),
                        new DnsEndPoint("localhost", 27017))),
                writeError,
                null,
                new Exception("duplicate key"));
        }

        private static void SetupList<T>(Mock<IMongoCollection<T>> collection, params T[] documents)
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

        [Fact]
        public async Task SaveBuild_InsertsIntoTheAmbientBuildsCollection()
        {
            var build = new Build { ItemId = "build-1" };
            _rootBuilds.Setup(c => c.InsertOneAsync(build, null, It.IsAny<CancellationToken>()))
                       .Returns(Task.CompletedTask);

            await _sut.SaveBuild(build);

            _rootBuilds.Verify(c => c.InsertOneAsync(build, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveBuild_SwallowsAWriteFailureSoTheBuildRequestStillAnswers()
        {
            _rootBuilds.Setup(c => c.InsertOneAsync(It.IsAny<Build>(), null, It.IsAny<CancellationToken>()))
                       .ThrowsAsync(WriteFailure());

            var act = () => _sut.SaveBuild(new Build { ItemId = "build-1" });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task SaveBuild_WritesIntoTheNamedTenantDatabase()
        {
            var build = new Build { ItemId = "build-1" };
            _tenantBuilds.Setup(c => c.InsertOneAsync(build, null, It.IsAny<CancellationToken>()))
                         .Returns(Task.CompletedTask);

            await _sut.SaveBuild(build, "tenant-b");

            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
            _tenantBuilds.Verify(c => c.InsertOneAsync(build, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveBuild_SwallowsAWriteFailureAgainstATenantDatabase()
        {
            _tenantBuilds.Setup(c => c.InsertOneAsync(It.IsAny<Build>(), null, It.IsAny<CancellationToken>()))
                         .ThrowsAsync(WriteFailure());

            var act = () => _sut.SaveBuild(new Build { ItemId = "build-1" }, "tenant-b");

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UpdateBuildEvents_UpdatesTheRunInTheTenantDatabaseWithoutUpserting()
        {
            UpdateOptions options = null;
            _tenantBuilds.Setup(c => c.UpdateOneAsync(
                             It.IsAny<FilterDefinition<Build>>(),
                             It.IsAny<UpdateDefinition<Build>>(),
                             It.IsAny<UpdateOptions>(),
                             It.IsAny<CancellationToken>()))
                         .Callback<FilterDefinition<Build>, UpdateDefinition<Build>, UpdateOptions, CancellationToken>(
                             (_, _, o, _) => options = o)
                         .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            await _sut.UpdateBuildEvents("run-1", [new BuildEventResponse()], "build", "Succeeded", "tenant-b");

            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
            // A status update must never create a build row that does not exist.
            options.IsUpsert.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateBuildEvents_SwallowsAWriteFailureSoThePollingLoopKeepsRunning()
        {
            _tenantBuilds.Setup(c => c.UpdateOneAsync(
                             It.IsAny<FilterDefinition<Build>>(),
                             It.IsAny<UpdateDefinition<Build>>(),
                             It.IsAny<UpdateOptions>(),
                             It.IsAny<CancellationToken>()))
                         .ThrowsAsync(WriteFailure());

            var act = () => _sut.UpdateBuildEvents("run-1", [], "build", "Failed", "tenant-b");

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UpdateBuildStatus_UpdatesTheRunInTheTenantDatabaseWithoutUpserting()
        {
            UpdateOptions options = null;
            _tenantBuilds.Setup(c => c.UpdateOneAsync(
                             It.IsAny<FilterDefinition<Build>>(),
                             It.IsAny<UpdateDefinition<Build>>(),
                             It.IsAny<UpdateOptions>(),
                             It.IsAny<CancellationToken>()))
                         .Callback<FilterDefinition<Build>, UpdateDefinition<Build>, UpdateOptions, CancellationToken>(
                             (_, _, o, _) => options = o)
                         .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            await _sut.UpdateBuildStatus("run-1", "Succeeded", "tenant-b");

            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
            options.IsUpsert.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateBuildStatus_SwallowsAWriteFailureSoThePollingLoopKeepsRunning()
        {
            _tenantBuilds.Setup(c => c.UpdateOneAsync(
                             It.IsAny<FilterDefinition<Build>>(),
                             It.IsAny<UpdateDefinition<Build>>(),
                             It.IsAny<UpdateOptions>(),
                             It.IsAny<CancellationToken>()))
                         .ThrowsAsync(WriteFailure());

            var act = () => _sut.UpdateBuildStatus("run-1", "Timeout", "tenant-b");

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task GetHostingProviders_ReturnsTheActiveProviders()
        {
            SetupList(_providers,
                new HostingProvider { Name = "Azure", Status = "active" },
                new HostingProvider { Name = "AWS", Status = "active" });

            var result = await _sut.GetHostingProviders();

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetHostingProviders_ReturnsAnEmptyListRatherThanThrowingWhenMongoIsUnreachable()
        {
            _providers.Setup(c => c.FindAsync(
                          It.IsAny<FilterDefinition<HostingProvider>>(),
                          It.IsAny<FindOptions<HostingProvider, HostingProvider>>(),
                          It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new TimeoutException("mongo unreachable"));

            // The deployment form reads this list; an outage must degrade to empty, not to a 500.
            (await _sut.GetHostingProviders()).Should().BeEmpty();
        }

        [Fact]
        public void UpdateBuild_IsNotImplementedYet()
        {
            var act = async () => await _sut.UpdateBuild(new Build { ItemId = "build-1" });

            act.Should().ThrowAsync<NotImplementedException>();
        }
    }
}
