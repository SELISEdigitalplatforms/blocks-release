using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.TestingTools.Entity;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class DependencyTrackAnalyticsServiceIntegrationTests : IDisposable
    {
        private readonly MongoIntegrationFixture _fixture;

        public DependencyTrackAnalyticsServiceIntegrationTests(MongoIntegrationFixture fixture) => _fixture = fixture;

        public void Dispose() => BlocksContext.ClearContext();

        private DependencyTrackRepositoryService CreateRepoService() =>
            new(_fixture.DbContextProvider, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);

        private DependencyTrackAnalyticsService CreateService() =>
            new(new Mock<ILogger<DependencyTrackAnalyticsService>>().Object,
                new Mock<IHttpHelperServices>().Object, new Mock<IBuildRepository>().Object,
                new Mock<IRepoRepository>().Object, CreateRepoService(), new Mock<ICloudBuildSecret>().Object,
                new ConfigurationBuilder().Build());

        private static void SetTenant(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        // BlocksContext is async-local, so the tenant is set by the caller: a context set inside this
        // awaited method would not flow back to the test body.
        private async Task SeedWithMainBranchProject(string tenantId)
        {
            await CreateRepoService().SaveDependencyTrackProject(new DependencyTrackProjects
            {
                ItemId = Guid.NewGuid().ToString("N"),
                ProjectId = tenantId,
                ProjectTeamUuid = "team-1",
                RepoProjects = new List<RepoProject> { new() { RepoId = "r1", ProjectUuid = "uuid-main" } }
            });
        }

        [Fact]
        public async Task EnsureRepoProjectEntry_SameRepoOtherBranchProject_AddsEntry()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            await SeedWithMainBranchProject(tenantId);
            var build = new Build { RepoId = "r1", ProjectId = tenantId };

            var added = await CreateService().EnsureRepoProjectEntry(build, new ScaLookupResponse { uuid = "uuid-dev" });

            added.Should().BeTrue();
            var stored = await CreateRepoService().GetDependencyTrackProject(tenantId);
            stored.RepoProjects.Select(rp => rp.ProjectUuid).Should().BeEquivalentTo("uuid-main", "uuid-dev");
        }

        [Fact]
        public async Task EnsureRepoProjectEntry_SameRepoSameProject_DoesNotDuplicate()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            SetTenant(tenantId);
            await SeedWithMainBranchProject(tenantId);
            var build = new Build { RepoId = "r1", ProjectId = tenantId };

            var added = await CreateService().EnsureRepoProjectEntry(build, new ScaLookupResponse { uuid = "uuid-main" });

            added.Should().BeFalse();
            (await CreateRepoService().GetDependencyTrackProject(tenantId)).RepoProjects.Should().HaveCount(1);
        }
    }
}
