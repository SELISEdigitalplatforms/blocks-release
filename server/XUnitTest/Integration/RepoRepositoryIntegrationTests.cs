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

            var result = await CreateRepo().GetRepoBuildList(repoId, null, 1, 30);
            result.Should().HaveCount(1);
        }

        private static Build NewBuild(string repoId, string branch, DateTime createdDate,
                                      string itemId = null) => new()
        {
            ItemId = itemId ?? Guid.NewGuid().ToString("N"),
            RepoId = repoId,
            RepoName = "org/r",
            Branch = branch,
            CreatedDate = createdDate
        };

        // H1: only the requested repo's builds come back. The unrelated repo deliberately
        // shares the requested BRANCH - without that, an implementation filtering only by
        // branch would pass this test.
        [Fact]
        public async Task GetRepoBuildList_ReturnsOnlyTheRequestedRepo_EvenWhenAnotherRepoSharesTheBranch()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var otherRepoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", now.AddMinutes(-1), "mine-1"),
                NewBuild(repoId, "main", now.AddMinutes(-2), "mine-2"),
                NewBuild(otherRepoId, "main", now, "theirs-newest")
            });

            var result = await CreateRepo().GetRepoBuildList(repoId, "main", 1, 30);

            result.Select(b => b.ItemId).Should().BeEquivalentTo(new[] { "mine-1", "mine-2" });
        }

        // H1b: an omitted branch means NO branch filtering. Without this, "filters by
        // branch when asked" and "always filters by branch" are indistinguishable.
        [Fact]
        public async Task GetRepoBuildList_WithoutABranch_ReturnsEveryBranch()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", now.AddMinutes(-1), "on-main"),
                NewBuild(repoId, "develop", now.AddMinutes(-2), "on-develop")
            });

            var all = await CreateRepo().GetRepoBuildList(repoId, null, 1, 30);
            all.Select(b => b.ItemId).Should().BeEquivalentTo(new[] { "on-main", "on-develop" });

            var onlyMain = await CreateRepo().GetRepoBuildList(repoId, "main", 1, 30);
            onlyMain.Select(b => b.ItemId).Should().BeEquivalentTo(new[] { "on-main" });
        }

        // H1: newest first, and paging walks backwards through time.
        [Fact]
        public async Task GetRepoBuildList_SortsNewestFirstAndPagesThroughTheHistory()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            // Inserted oldest-first so natural order is the opposite of the expected order.
            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", now.AddMinutes(-5), "b5"),
                NewBuild(repoId, "main", now.AddMinutes(-4), "b4"),
                NewBuild(repoId, "main", now.AddMinutes(-3), "b3"),
                NewBuild(repoId, "main", now.AddMinutes(-2), "b2"),
                NewBuild(repoId, "main", now.AddMinutes(-1), "b1")
            });

            var sut = CreateRepo();

            (await sut.GetRepoBuildList(repoId, null, 1, 2))
                .Select(b => b.ItemId).Should().Equal("b1", "b2");
            (await sut.GetRepoBuildList(repoId, null, 2, 2))
                .Select(b => b.ItemId).Should().Equal("b3", "b4");
            (await sut.GetRepoBuildList(repoId, null, 3, 2))
                .Select(b => b.ItemId).Should().Equal("b5");
            (await sut.GetRepoBuildList(repoId, null, 1, 1))
                .Select(b => b.ItemId).Should().Equal("b1");
        }

        // H1c: CreatedDate is not a total order. Two builds share a timestamp and are
        // inserted so that natural order DISAGREES with _id descending - otherwise
        // removing the tiebreaker could still produce the expected order by accident.
        [Fact]
        public async Task GetRepoBuildList_BreaksCreatedDateTiesById()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var sameInstant = DateTime.UtcNow.AddMinutes(-1);

            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", sameInstant, "aaa-lowest-id"),
                NewBuild(repoId, "main", sameInstant, "zzz-highest-id")
            });

            var result = await CreateRepo().GetRepoBuildList(repoId, null, 1, 30);

            result.Select(b => b.ItemId).Should().Equal("zzz-highest-id", "aaa-lowest-id");
        }

        // C2: clamping, with enough documents seeded that an UNCLAMPED implementation
        // would visibly return a different count.
        [Fact]
        public async Task GetRepoBuildList_ClampsPageSizeAboveTheMaximum()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            await builds.InsertManyAsync(Enumerable.Range(0, 101)
                .Select(i => NewBuild(repoId, "main", now.AddSeconds(-i))));

            var result = await CreateRepo().GetRepoBuildList(repoId, null, 1, 5000);

            result.Should().HaveCount(100);
        }

        [Fact]
        public async Task GetRepoBuildList_ClampsPageSizeBelowTheMinimum()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", now.AddMinutes(-1), "min-newest"),
                NewBuild(repoId, "main", now.AddMinutes(-2), "min-older")
            });

            var result = await CreateRepo().GetRepoBuildList(repoId, null, 1, 0);

            result.Select(b => b.ItemId).Should().Equal("min-newest");
        }

        [Fact]
        public async Task GetRepoBuildList_ClampsANegativePageNumberToTheFirstPage()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            var now = DateTime.UtcNow;

            await builds.InsertManyAsync(new[]
            {
                NewBuild(repoId, "main", now.AddMinutes(-1), "neg-newest"),
                NewBuild(repoId, "main", now.AddMinutes(-2), "neg-older")
            });

            var result = await CreateRepo().GetRepoBuildList(repoId, null, -5, 1);

            result.Select(b => b.ItemId).Should().Equal("neg-newest");
        }

        // C2: (pageNumber - 1) * pageSize overflows int near the maximum and lands
        // NEGATIVE, which is exactly the negative skip the clamp exists to prevent. An
        // absurd page must come back empty rather than throwing or wrapping around.
        [Fact]
        public async Task GetRepoBuildList_AnAbsurdPageNumberReturnsNothingRatherThanThrowing()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var builds = _fixture.Collection<Build>("Builds");
            await builds.InsertOneAsync(NewBuild(repoId, "main", DateTime.UtcNow));

            var result = await CreateRepo().GetRepoBuildList(repoId, null, int.MaxValue, 30);

            result.Should().BeEmpty();
        }

        // C5 at the repository level: a repo with no builds is an empty list, not null.
        [Fact]
        public async Task GetRepoBuildList_RepoWithNoBuilds_ReturnsEmptyNotNull()
        {
            var result = await CreateRepo().GetRepoBuildList(
                Guid.NewGuid().ToString("N"), null, 1, 30);

            result.Should().NotBeNull();
            result.Should().BeEmpty();
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

        /// <summary>
        /// The queue-driven teardown reads a project's repositories out of that project's own tenant
        /// database, with no ambient tenant context, so this pins the tenant scoping and the resource filter.
        ///
        /// Unlike every other read, archived repositories are deliberately included: blocks-os archives
        /// before it publishes the delete, so filtering them out would leave their namespaces running.
        /// </summary>
        [Fact]
        public async Task GetProjectRepos_ReturnsEveryRepoOfTheProjectIncludingArchivedOnes()
        {
            var projectId = Guid.NewGuid().ToString("N");
            var sut = CreateRepo();

            var first = NewRepo(projectId);
            first.SourceRepoId = "res-1";
            var second = NewRepo(projectId);
            second.SourceRepoId = "res-2";
            var archived = NewRepo(projectId);
            archived.SourceRepoId = "res-3";
            var otherProject = NewRepo();
            otherProject.SourceRepoId = "res-1";

            foreach (var repo in new[] { first, second, archived, otherProject })
                await sut.SaveRepo(repo);
            await Archive(sut, archived);

            var all = await sut.GetProjectRepos(projectId);
            all.Select(r => r.ItemId).Should()
               .BeEquivalentTo(new[] { first.ItemId, second.ItemId, archived.ItemId });
            all.Should().ContainSingle(r => r.ItemId == archived.ItemId && r.IsArchived);

            var narrowed = await sut.GetProjectRepos(projectId, "res-2");
            narrowed.Select(r => r.ItemId).Should().Equal(second.ItemId);

            // An archived repository is still reachable by its resource id - that is the teardown case.
            (await sut.GetProjectRepos(projectId, "res-3")).Select(r => r.ItemId).Should().Equal(archived.ItemId);
            (await sut.GetProjectRepos(projectId, "no-such-resource")).Should().BeEmpty();
        }

        /// <summary>
        /// Archiving hides a repository from every user-facing read. GetProjectRepos is the one exception,
        /// and is asserted separately above.
        /// </summary>
        [Fact]
        public async Task ArchiveRepo_HidesTheRepoFromEveryUserFacingRead()
        {
            var repo = NewRepo();
            var sut = CreateRepo();
            await sut.SaveRepo(repo);

            (await sut.ArchiveRepo(repo.ItemId, "any-tenant")).Should().BeTrue();

            (await sut.GetRepo(repo.ItemId)).Should().BeNull();
            (await sut.GetRepo(repo.ItemId, "any-tenant")).Should().BeNull();
            (await sut.GetRepos()).Select(r => r.ItemId).Should().NotContain(repo.ItemId);
        }

        [Fact]
        public async Task ArchiveRepo_UnknownRepo_ReturnsFalse()
        {
            (await CreateRepo().ArchiveRepo("no-such-repo", "any-tenant")).Should().BeFalse();
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
