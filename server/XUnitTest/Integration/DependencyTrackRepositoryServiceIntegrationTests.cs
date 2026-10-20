using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Blocks.Genesis.Entities.Release;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class DependencyTrackRepositoryServiceIntegrationTests : IDisposable
    {
        private readonly MongoIntegrationFixture _fixture;

        public DependencyTrackRepositoryServiceIntegrationTests(MongoIntegrationFixture fixture) => _fixture = fixture;

        public void Dispose() => BlocksContext.ClearContext();

        private DependencyTrackRepositoryService CreateService() =>
            new(_fixture.DbContextProvider, _fixture.KeyValueStore, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);

        private static void SetTenant(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        [Fact]
        public async Task SaveAndGetDependencyTrackProject_RoundTrips()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            var sut = CreateService();

            var project = new DependencyTrackProjects
            {
                ItemId = Guid.NewGuid().ToString("N"),
                ProjectId = tenantId,
                ProjectName = "proj",
                ProjectTeamUuid = "team-1",
                RepoProjects = new List<RepoProject>()
            };

            (await sut.SaveDependencyTrackProject(project)).Should().BeTrue();

            var fetched = await sut.GetDependencyTrackProject(tenantId);
            fetched.Should().NotBeNull();
            fetched.ProjectTeamUuid.Should().Be("team-1");
        }

        [Fact]
        public async Task GetDependencyTrackProject_NotFound_ReturnsNull()
        {
            SetTenant(Guid.NewGuid().ToString("N"));
            (await CreateService().GetDependencyTrackProject("anything")).Should().BeNull();
        }

        [Fact]
        public async Task SaveDependencyTrackProject_Upsert_UpdatesExisting()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            var sut = CreateService();
            var itemId = Guid.NewGuid().ToString("N");

            await sut.SaveDependencyTrackProject(new DependencyTrackProjects
            {
                ItemId = itemId,
                ProjectId = tenantId,
                ProjectName = "v1",
                RepoProjects = new List<RepoProject>()
            });

            (await sut.SaveDependencyTrackProject(new DependencyTrackProjects
            {
                ItemId = itemId,
                ProjectId = tenantId,
                ProjectName = "v2",
                RepoProjects = new List<RepoProject>()
            })).Should().BeTrue();

            (await sut.GetDependencyTrackProject(tenantId)).ProjectName.Should().Be("v2");
        }

        private static DependencyTrackProjects NewProject(string tenantId, string name, string team) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            ProjectId = tenantId,
            ProjectName = name,
            ProjectTeamName = "team-name-" + name,
            ProjectTeamUuid = team,
            RepoProjects = new List<RepoProject> { new() { RepoId = "r-" + name, ProjectUuid = "p-" + name } }
        };

        private bool OldCollectionExists() =>
            _fixture.Database.ListCollectionNames().ToList().Contains("DependencyTrackProjects");

        [Fact]
        public async Task Save_WritesOneKvRow_AndNeverCreatesOldCollection() // H3, H4, H5
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            var sut = CreateService();
            var project = NewProject(tenantId, "proj", "team-1");
            await _fixture.Database.DropCollectionAsync("DependencyTrackProjects");

            (await sut.SaveDependencyTrackProject(project)).Should().BeTrue();
            (await sut.SaveDependencyTrackProject(project)).Should().BeTrue();

            var rows = await _fixture.Collection<BsonDocument>("KeyValueStores")
                .Find(Builders<BsonDocument>.Filter.Eq("Key", "dependency-track-project:" + tenantId))
                .ToListAsync();
            rows.Should().HaveCount(1);
            OldCollectionExists().Should().BeFalse();

            var read = await sut.GetDependencyTrackProject(tenantId);
            read.ProjectName.Should().Be("proj");
            read.ProjectId.Should().Be(tenantId);
            read.ProjectTeamName.Should().Be("team-name-proj");
            read.ProjectTeamUuid.Should().Be("team-1");
            read.RepoProjects.Should().ContainSingle(r => r.RepoId == "r-proj" && r.ProjectUuid == "p-proj");
        }

        [Fact]
        public async Task Get_NoKvRow_ReadsOldCollection() // H2
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            await _fixture.Collection<DependencyTrackProjects>("DependencyTrackProjects")
                .InsertOneAsync(NewProject(tenantId, "old", "team-old"));

            var read = await CreateService().GetDependencyTrackProject(tenantId);

            read.Should().NotBeNull();
            read.ProjectTeamUuid.Should().Be("team-old");
        }

        [Fact]
        public async Task Get_KvRowAndOldDoc_KvWins() // H1
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            await _fixture.Collection<DependencyTrackProjects>("DependencyTrackProjects")
                .InsertOneAsync(NewProject(tenantId, "old", "team-old"));
            var sut = CreateService();
            await sut.SaveDependencyTrackProject(NewProject(tenantId, "new", "team-new"));

            (await sut.GetDependencyTrackProject(tenantId)).ProjectTeamUuid.Should().Be("team-new");
        }

        [Fact]
        public async Task Save_AfterOldDoc_LeavesOldDocUntouched() // H4
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            var old = NewProject(tenantId, "old", "team-old");
            var oldCollection = _fixture.Collection<DependencyTrackProjects>("DependencyTrackProjects");
            await oldCollection.InsertOneAsync(old);

            await CreateService().SaveDependencyTrackProject(NewProject(tenantId, "new", "team-new"));

            var docs = await oldCollection.Find(d => d.ProjectId == tenantId).ToListAsync();
            docs.Should().ContainSingle().Which.ProjectTeamUuid.Should().Be("team-old");
        }

        [Fact]
        public async Task TwoTenantsInOneDb_KeepSeparateRows()
        {
            var a = Guid.NewGuid().ToString("N");
            var b = Guid.NewGuid().ToString("N");
            var sut = CreateService();

            SetTenant(a);
            await sut.SaveDependencyTrackProject(NewProject(a, "a", "team-a"));
            SetTenant(b);
            await sut.SaveDependencyTrackProject(NewProject(b, "b", "team-b"));

            SetTenant(a);
            (await sut.GetDependencyTrackProject(a)).ProjectTeamUuid.Should().Be("team-a");
            SetTenant(b);
            (await sut.GetDependencyTrackProject(b)).ProjectTeamUuid.Should().Be("team-b");
        }

        [Fact]
        public async Task Get_NothingAnywhere_ReturnsNull_AndCreatesNoCollection() // C1, C10
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            await _fixture.Database.DropCollectionAsync("DependencyTrackProjects");

            (await CreateService().GetDependencyTrackProject(tenantId)).Should().BeNull();
            OldCollectionExists().Should().BeFalse();
        }
    }
}
