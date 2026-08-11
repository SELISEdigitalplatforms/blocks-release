using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.RepositoryServices;
using Devops.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class RepoRepositoryIntegrationTests
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly IConfiguration _config;

        public RepoRepositoryIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["RootTenantId"] = "root" })
                .Build();
        }

        private RepoRepository CreateRepo() =>
            new(_fixture.DbContextProvider, _config, new Mock<ILogger<RepoRepository>>().Object, new Mock<IBlocksSecret>().Object);

        private static Repo NewRepo(string projectId = null, string userId = null) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            ProjectId = projectId ?? Guid.NewGuid().ToString("N"),
            BlocksUserId = userId ?? Guid.NewGuid().ToString("N"),
            RepoName = "org/" + Guid.NewGuid().ToString("N"),
            Branch = "main",
            DeploymentType = "Manual"
        };

        [Fact]
        public async Task SaveRepo_ThenGetRepo_RoundTrips()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            var fetched = await sut.GetRepo(repo.ItemId);
            fetched.Should().NotBeNull();
            fetched.RepoName.Should().Be(repo.RepoName);
        }

        [Fact]
        public async Task SaveRepo_Duplicate_DoesNotInsertTwice()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            var second = NewRepo(repo.ProjectId);
            second.RepoName = repo.RepoName; // same project + name -> considered existing
            await sut.SaveRepo(second);

            var all = await sut.GetRepos();
            all.Count(r => r.ProjectId == repo.ProjectId && r.RepoName == repo.RepoName).Should().Be(1);
        }

        [Fact]
        public async Task GetRepoWithTenant_ReturnsRepo()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            (await sut.GetRepo(repo.ItemId, "any-tenant")).Should().NotBeNull();
        }

        [Fact]
        public async Task GetRepoByBranch_MatchesNameAndBranch()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            var found = await sut.GetRepoByBranch("tenant", repo.RepoName, "main");
            found.Should().NotBeNull();
            (await sut.GetRepoByBranch("tenant", repo.RepoName, "nope")).Should().BeNull();
        }

        [Fact]
        public async Task GetRepoBuildList_ReturnsBuildsForRepo()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            await builds.InsertOneAsync(new Build { ItemId = Guid.NewGuid().ToString("N"), RepoId = repoId, RepoName = "org/r" });

            var result = await CreateRepo().GetRepoBuildList(repoId);
            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task UpdateRepo_Request_SetsFields()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            var ok = await sut.UpdateRepo(new RepoUpdateRequest
            {
                RepoId = repo.ItemId,
                DeploymentType = "Auto",
                CustomDomain = "custom.example.com",
                LastDeploymentStatus = "Success",
                LastDeploymentDate = DateTime.UtcNow
            });

            ok.Should().BeTrue();
            var fetched = await sut.GetRepo(repo.ItemId);
            fetched.DeploymentType.Should().Be("Auto");
            fetched.CustomDeploymentUrl.Should().Be("custom.example.com");
            fetched.LastDeploymentStatus.Should().Be("Success");
        }

        [Fact]
        public async Task UpdateRepo_Request_NoFields_ReturnsFalse()
        {
            var ok = await CreateRepo().UpdateRepo(new RepoUpdateRequest { RepoId = Guid.NewGuid().ToString("N") });
            ok.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateRepo_RequestWithTenant_UpdatesMatched()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            var ok = await sut.UpdateRepo(new RepoUpdateRequest { RepoId = repo.ItemId, DeploymentType = "Auto" }, "tenant");
            ok.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateRepo_Entity_ReplacesDocument()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            repo.Branch = "develop";
            var ok = await sut.UpdateRepo(repo);
            ok.Should().BeTrue();
            (await sut.GetRepo(repo.ItemId)).Branch.Should().Be("develop");
        }

        [Fact]
        public async Task UpdateRepoDependencyTrackProjectUuid_Sets()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            var ok = await sut.UpdateRepoDependencyTrackProjectUuid(repo.ItemId, "uuid-123", "tenant");
            ok.Should().BeTrue();
            (await sut.GetRepo(repo.ItemId)).DependencyTrackProjectUuid.Should().Be("uuid-123");
        }

        [Fact]
        public async Task UpsertAndGetRepoCustomDomains_RoundTrips()
        {
            var sut = CreateRepo();
            var projectId = Guid.NewGuid().ToString("N");
            var repoId = Guid.NewGuid().ToString("N");
            var domain = new RepoCustomDomain
            {
                ItemId = Guid.NewGuid().ToString("N"),
                ProjectId = projectId,
                RepoId = repoId,
                ProjectEnv = "prod",
                CustomDeploymentDomain = "d-" + repoId + ".example.com"
            };

            var summary = await sut.UpsertRepoCustomDomainsAsync(new List<RepoCustomDomain> { domain });
            summary.IsAcknowledged.Should().BeTrue();

            var fetched = await sut.GetRepoCustomDomainsAsync(
                new List<RepoWithDomain> { new() { RepoId = repoId } }, projectId);
            fetched.Should().ContainSingle(d => d.RepoId == repoId);
        }

        [Fact]
        public async Task GetRepoCustomDomainsAsync_EmptyIds_ReturnsEmpty()
        {
            var result = await CreateRepo().GetRepoCustomDomainsAsync(new List<RepoWithDomain> { new() { RepoId = "" } }, "p");
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetRepoCustomDomainExists_DetectsConflict()
        {
            var sut = CreateRepo();
            var existingRepoId = Guid.NewGuid().ToString("N");
            var domainName = "conflict-" + Guid.NewGuid().ToString("N") + ".example.com";
            await sut.UpsertRepoCustomDomainsAsync(new List<RepoCustomDomain>
            {
                new() { ItemId = Guid.NewGuid().ToString("N"), RepoId = existingRepoId, CustomDeploymentDomain = domainName }
            });

            // A different repo requesting the same domain is a conflict.
            var noConflictFree = await sut.GetRepoCustomDomainExists(new List<RepoWithDomain>
            {
                new() { RepoId = "other-repo", CustomDeploymentDomain = domainName }
            });
            noConflictFree.Should().BeFalse();

            // Empty domains -> no conflict (true)
            (await sut.GetRepoCustomDomainExists(new List<RepoWithDomain> { new() { RepoId = "r", CustomDeploymentDomain = "" } }))
                .Should().BeTrue();
        }

        [Fact]
        public async Task GetProjectPeopleList_ReturnsUserIds()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            var people = _fixture.Collection<ProjectPeople>("ProjectPeoples");
            await people.InsertOneAsync(new ProjectPeople { ItemId = Guid.NewGuid().ToString("N"), TenantId = tenantId, UserId = "user-x" });

            var result = await CreateRepo().GetProjectPeopleList(tenantId);
            result.Should().Contain("user-x");
        }

        [Fact]
        public async Task GetDeploySettings_ResolvesProviderRegionMachine()
        {
            var providers = _fixture.Collection<HostingProvider>("HostingProviders");
            var hpId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
            var regionId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
            var machineId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
            await providers.InsertOneAsync(new HostingProvider
            {
                Id = hpId,
                Name = "aws",
                Status = "Active",
                Region = new List<Region>
                {
                    new()
                    {
                        Id = regionId,
                        Name = "us-east",
                        MachineSpecs = new List<MachineConfig> { new() { Id = machineId, Ram = "8G", CPU = "4" } }
                    }
                }
            });

            var result = await CreateRepo().GetDeploySettings(hpId, regionId, machineId);
            result.Should().NotBeNull();
            result.MachineConfig.Id.Should().Be(machineId);
        }

        [Fact]
        public async Task GetDeploySettings_MissingProvider_ReturnsNull()
        {
            var result = await CreateRepo().GetDeploySettings("nope", "r", "m");
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetReposWithBuildsAsync_JoinsBuilds()
        {
            var userId = Guid.NewGuid().ToString("N");
            var projectId = Guid.NewGuid().ToString("N");
            var repo = NewRepo(projectId, userId);
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            await _fixture.Collection<Build>("Builds").InsertOneAsync(new Build
            {
                ItemId = Guid.NewGuid().ToString("N"),
                RepoId = repo.ItemId,
                BlocksUserId = userId,
                RepoName = repo.RepoName
            });

            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));
            try
            {
                var result = await sut.GetReposWithBuildsAsync(projectId);
                result.Should().ContainSingle(r => r.ItemId == repo.ItemId);
                result.First(r => r.ItemId == repo.ItemId).Builds.Should().HaveCount(1);
            }
            finally
            {
                BlocksContext.ClearContext();
            }
        }

        /// <summary>
        /// Archives an already-saved repo the way the write paths do, through the full-document replace,
        /// so the flag lands in Mongo exactly as production would write it.
        /// </summary>
        private static async Task Archive(RepoRepository sut, Repo repo)
        {
            repo.IsArchived = true;
            (await sut.UpdateRepo(repo)).Should().BeTrue();
        }

        [Fact]
        public async Task GetRepo_SkipsAnArchivedRepository()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            (await sut.GetRepo(repo.ItemId)).Should().NotBeNull();

            await Archive(sut, repo);

            (await sut.GetRepo(repo.ItemId)).Should().BeNull();
            (await sut.GetRepo(repo.ItemId, "any-tenant")).Should().BeNull();
        }

        [Fact]
        public async Task GetRepoByBranch_SkipsAnArchivedRepository()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);
            await Archive(sut, repo);

            (await sut.GetRepoByBranch("tenant", repo.RepoName, "main")).Should().BeNull();
        }

        [Fact]
        public async Task GetRepos_ExcludesArchivedRepositories()
        {
            var projectId = Guid.NewGuid().ToString("N");
            var live = NewRepo(projectId);
            var archived = NewRepo(projectId);
            var sut = CreateRepo();
            await sut.SaveRepo(live);
            await sut.SaveRepo(archived);
            await Archive(sut, archived);

            var all = await sut.GetRepos();

            all.Select(r => r.ItemId).Should().Contain(live.ItemId).And.NotContain(archived.ItemId);
        }

        /// <summary>
        /// Repos written before IsArchived existed carry no such key. The read filter is Ne(true) rather than
        /// Eq(false) precisely so those documents keep showing up; an equality filter would hide every one of them.
        /// </summary>
        [Fact]
        public async Task GetRepos_StillReturnsDocumentsWrittenBeforeTheArchiveFlagExisted()
        {
            var legacyId = Guid.NewGuid().ToString("N");
            var projectId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<BsonDocument>("Repos").InsertOneAsync(new BsonDocument
            {
                { "_id", legacyId },
                { "ProjectId", projectId },
                { "RepoName", "org/legacy" },
                { "Branch", "main" }
            });

            var fetched = await CreateRepo().GetRepo(legacyId);

            fetched.Should().NotBeNull();
            fetched.IsArchived.Should().BeFalse();
            (await CreateRepo().GetRepos()).Select(r => r.ItemId).Should().Contain(legacyId);
        }

        [Fact]
        public async Task GetReposWithBuildsAsync_ExcludesArchivedRepositories()
        {
            var userId = Guid.NewGuid().ToString("N");
            var projectId = Guid.NewGuid().ToString("N");
            var live = NewRepo(projectId, userId);
            var archived = NewRepo(projectId, userId);
            var sut = CreateRepo();
            await sut.SaveRepo(live);
            await sut.SaveRepo(archived);
            await Archive(sut, archived);

            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));
            try
            {
                var result = await sut.GetReposWithBuildsAsync(projectId);

                result.Select(r => r.ItemId).Should().Contain(live.ItemId).And.NotContain(archived.ItemId);
            }
            finally
            {
                BlocksContext.ClearContext();
            }
        }
    }
}
