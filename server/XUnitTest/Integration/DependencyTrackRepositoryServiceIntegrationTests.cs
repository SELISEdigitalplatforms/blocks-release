using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.TestingTools.Entity;
using FluentAssertions;
using Microsoft.Extensions.Logging;
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
            new(_fixture.DbContextProvider, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);

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
    }
}
