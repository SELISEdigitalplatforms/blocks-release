using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class BuildRepositoryIntegrationTests
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly IConfiguration _config;

        public BuildRepositoryIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["RootTenantId"] = "root" })
                .Build();
        }

        private BuildRepository CreateRepo() =>
            new(_fixture.DbContextProvider, new Mock<ILogger<BuildRepository>>().Object, _config, new Mock<IBlocksSecret>().Object);

        private static Build NewBuild() => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            RepoId = Guid.NewGuid().ToString("N"),
            RepoName = "org/repo",
            PipelineRunName = "run-" + Guid.NewGuid().ToString("N"),
            Status = "STARTED"
        };

        [Fact]
        public async Task SaveBuild_ThenGetBuild_RoundTrips()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);
            (await sut.GetBuild(build.ItemId)).Should().NotBeNull();
        }

        [Fact]
        public async Task SaveBuildWithTenant_ThenGetBuildWithTenant()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build, "tenant");
            (await sut.GetBuild(build.ItemId, "tenant")).Should().NotBeNull();
        }

        [Fact]
        public async Task GetBuilds_ByRepo_ReturnsMatching()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);
            var builds = await sut.GetBuilds(build.RepoId, "any-tenant");
            builds.Should().ContainSingle(b => b.ItemId == build.ItemId);
        }

        [Fact]
        public async Task GetBuildByPipelineRunName_ReturnsBuild()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);
            (await sut.GetBuildByPipelineRunName(build.PipelineRunName, "tenant")).Should().NotBeNull();
        }

        [Fact]
        public async Task UpdateBuildEvents_SetsEventsAndStatus()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);

            var events = new List<BuildEventResponse> { new() { BuildId = build.ItemId, EventType = "t", Message = "m" } };
            await sut.UpdateBuildEvents(build.PipelineRunName, events, "group", "SUCCEEDED", "tenant");

            var updated = await sut.GetBuild(build.ItemId);
            updated.Status.Should().Be("SUCCEEDED");
            updated.EventName.Should().Be("group");
            updated.Events.Should().HaveCount(1);
        }

        [Fact]
        public async Task UpdateBuildStatus_SetsStatus()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);

            await sut.UpdateBuildStatus(build.PipelineRunName, "FAILED", "tenant");
            (await sut.GetBuild(build.ItemId)).Status.Should().Be("FAILED");
        }

        [Fact]
        public async Task UpdateBuildDependencyTrackProjectId_Sets()
        {
            var build = NewBuild();
            var sut = CreateRepo();
            await sut.SaveBuild(build);

            var ok = await sut.UpdateBuildDependencyTrackProjectId(build.ItemId, "dt-1", "tenant");
            ok.Should().BeTrue();
            (await sut.GetBuild(build.ItemId)).DependencyTrackProjectId.Should().Be("dt-1");
        }

        [Fact]
        public async Task SaveWebhook_InsertsDocument()
        {
            var sut = CreateRepo();
            var webhook = new RepositoryWebhook { ItemId = Guid.NewGuid().ToString("N"), RepoId = "r1", Ref = "refs/heads/main" };
            (await sut.SaveWebhook(webhook, "tenant")).Should().BeTrue();
        }

        [Fact]
        public async Task GetHostingProviders_ReturnsActiveOnly()
        {
            var providers = _fixture.Collection<HostingProvider>("HostingProviders");
            await providers.InsertOneAsync(new HostingProvider { Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(), Name = "act", Status = "active" });
            await providers.InsertOneAsync(new HostingProvider { Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(), Name = "inact", Status = "inactive" });

            var result = await CreateRepo().GetHostingProviders();
            result.Should().OnlyContain(p => p.Status == "active");
            result.Should().Contain(p => p.Name == "act");
        }

        [Fact]
        public async Task UpdateBuild_NotImplemented_Throws()
        {
            Func<Task> act = () => CreateRepo().UpdateBuild(new Build());
            await act.Should().ThrowAsync<NotImplementedException>();
        }
    }
}
