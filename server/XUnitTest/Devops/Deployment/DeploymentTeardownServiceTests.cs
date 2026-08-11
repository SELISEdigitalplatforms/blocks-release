using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Models;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// The routing rules of the queue-driven teardown. TenantGroupId is mandatory and the other two ids
    /// only narrow it, so what matters here is which tenant databases get opened and which repositories
    /// inside them are matched - not the mechanics of a single teardown, which
    /// <see cref="BuildServiceDeleteDeploymentTests"/> already covers.
    ///
    /// Repositories are given no DeployedNamespace unless a test is about teardown, so the namespace
    /// delete is skipped and the assertions stay on routing and archiving.
    /// </summary>
    public class DeploymentTeardownServiceTests
    {
        private const string GroupId = "group-1";
        private const string ProjectId = "tenant-a";

        private readonly DeploymentServiceFactory _f = new();

        private static Repo NewRepo(string itemId, string projectId, string resourceId, string deployedNamespace = null) => new()
        {
            ItemId = itemId,
            ProjectId = projectId,
            SourceRepoId = resourceId,
            RepoName = "org/" + itemId,
            DeployedNamespace = deployedNamespace
        };

        // Only TenantId and TenantGroupId are read here; the required members are satisfied but never used.
        private static Tenant NewProject(string tenantId, string groupId) => new()
        {
            TenantId = tenantId,
            TenantGroupId = groupId,
            DbConnectionString = "mongodb://localhost",
            JwtTokenParameters = null!
        };

        /// <summary>Arranges one project's repositories and lets every archive write succeed.</summary>
        private void SetupProject(string tenantId, params Repo[] repos)
        {
            _f.RepoRepo.Setup(r => r.GetProjectRepos(tenantId, It.IsAny<string>()))
                       .ReturnsAsync((string _, string resourceId) => string.IsNullOrWhiteSpace(resourceId)
                           ? new List<Repo>(repos)
                           : new List<Repo>(repos).FindAll(repo => repo.SourceRepoId == resourceId));

            _f.RepoRepo.Setup(r => r.ArchiveRepo(It.IsAny<string>(), tenantId)).ReturnsAsync(true);
        }

        /// <summary>As <see cref="SetupProject"/>, plus the group-membership lookup the project path makes.</summary>
        private void SetupProjectInGroup(string tenantId, params Repo[] repos)
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync(tenantId)).ReturnsAsync(NewProject(tenantId, GroupId));
            SetupProject(tenantId, repos);
        }

        private void SetupGroup(params string[] tenantIds)
        {
            var projects = new List<Tenant>();
            foreach (var tenantId in tenantIds)
                projects.Add(NewProject(tenantId, GroupId));

            _f.TenantLookup.Setup(t => t.GetProjectsByGroupAsync(GroupId)).ReturnsAsync(projects);
        }

        [Fact]
        public async Task GroupOnly_TearsDownEveryRepoInEveryProjectOfTheGroup()
        {
            SetupGroup("tenant-a", "tenant-b");
            SetupProject("tenant-a", NewRepo("repo-1", "tenant-a", "res-1"));
            SetupProject("tenant-b", NewRepo("repo-2", "tenant-b", "res-1"), NewRepo("repo-3", "tenant-b", "res-2"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId });

            summary.ProjectsVisited.Should().Be(2);
            summary.ReposMatched.Should().Be(3);
            summary.ReposArchived.Should().Be(3);
            summary.HasFailures.Should().BeFalse();
        }

        [Fact]
        public async Task GroupAndProject_TearsDownEveryRepoOfThatProjectOnly()
        {
            SetupProjectInGroup(ProjectId, NewRepo("repo-1", ProjectId, "res-1"), NewRepo("repo-2", ProjectId, "res-2"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ProjectsVisited.Should().Be(1);
            summary.ReposArchived.Should().Be(2);
            _f.TenantLookup.Verify(t => t.GetProjectsByGroupAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GroupAndProjectAndResource_TearsDownThatOneRepo()
        {
            SetupProjectInGroup(ProjectId, NewRepo("repo-1", ProjectId, "res-1"), NewRepo("repo-2", ProjectId, "res-2"));

            var summary = await _f.DeploymentTeardownService().TearDownAsync(
                new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId, ResourceId = "res-2" });

            summary.ReposMatched.Should().Be(1);
            summary.ReposArchived.Should().Be(1);
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-2", ProjectId), Times.Once);
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-1", ProjectId), Times.Never);
        }

        /// <summary>No project to narrow to, so the resource filter applies in every project of the group.</summary>
        [Fact]
        public async Task GroupAndResource_TearsDownThatResourceInEveryProjectOfTheGroup()
        {
            SetupGroup("tenant-a", "tenant-b");
            SetupProject("tenant-a", NewRepo("repo-1", "tenant-a", "res-1"), NewRepo("repo-2", "tenant-a", "res-2"));
            SetupProject("tenant-b", NewRepo("repo-3", "tenant-b", "res-1"), NewRepo("repo-4", "tenant-b", "res-2"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ResourceId = "res-1" });

            summary.ProjectsVisited.Should().Be(2);
            summary.ReposArchived.Should().Be(2);
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-1", "tenant-a"), Times.Once);
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-3", "tenant-b"), Times.Once);
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-2", It.IsAny<string>()), Times.Never);
        }

        /// <summary>
        /// The group is what says which tenant databases the message may reach. Without it there is
        /// nothing to scope against, so a project id on its own is dropped rather than acted on.
        /// </summary>
        [Fact]
        public async Task ProjectOnly_DoesNothing()
        {
            SetupProject(ProjectId, NewRepo("repo-1", ProjectId, "res-1"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { ProjectId = ProjectId });

            summary.ProjectsVisited.Should().Be(0);
            summary.ReposMatched.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.RepoRepo.Verify(r => r.ArchiveRepo(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProjectAndResourceWithoutGroup_DoesNothing()
        {
            SetupProject(ProjectId, NewRepo("repo-1", ProjectId, "res-1"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { ProjectId = ProjectId, ResourceId = "res-1" });

            summary.ProjectsVisited.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ResourceOnly_DoesNothing()
        {
            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { ResourceId = "res-1" });

            summary.ProjectsVisited.Should().Be(0);
            summary.ReposMatched.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData(null, null, null)]
        [InlineData("", "", "")]
        [InlineData("   ", "   ", "   ")]
        public async Task EmptyMessage_DoesNothing(string groupId, string projectId, string resourceId)
        {
            var summary = await _f.DeploymentTeardownService().TearDownAsync(
                new ProjectDeleteQueue { TenantGroupId = groupId, ProjectId = projectId, ResourceId = resourceId });

            summary.ProjectsVisited.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        /// <summary>Whitespace in the group must not count as a group and quietly widen the blast radius.</summary>
        [Fact]
        public async Task WhitespaceGroupWithARealProject_DoesNothing()
        {
            SetupProject(ProjectId, NewRepo("repo-1", ProjectId, "res-1"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = "   ", ProjectId = ProjectId });

            summary.ProjectsVisited.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task NullMessage_DoesNothing()
        {
            var summary = await _f.DeploymentTeardownService().TearDownAsync(null);

            summary.ProjectsVisited.Should().Be(0);
            summary.HasFailures.Should().BeFalse();
        }

        [Fact]
        public async Task GroupAndProject_ProjectBelongsToADifferentGroup_DoesNothing()
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync(ProjectId)).ReturnsAsync(NewProject(ProjectId, "some-other-group"));

            var summary = await _f.DeploymentTeardownService().TearDownAsync(
                new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ProjectsVisited.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        /// <summary>
        /// blocks-os soft-deletes, so the record should still be there. If it is not, the caller named
        /// this project explicitly and the read is tenant-scoped regardless, so it is still acted on.
        /// </summary>
        [Fact]
        public async Task GroupAndProject_ProjectRecordAlreadyGone_StillActsOnTheProjectId()
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync(ProjectId)).ReturnsAsync((Tenant)null);
            SetupProject(ProjectId, NewRepo("repo-1", ProjectId, "res-1"));

            var summary = await _f.DeploymentTeardownService().TearDownAsync(
                new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ReposArchived.Should().Be(1);
        }

        [Fact]
        public async Task UnknownGroup_DoesNothing()
        {
            _f.TenantLookup.Setup(t => t.GetProjectsByGroupAsync(GroupId)).ReturnsAsync(new List<Tenant>());

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId });

            summary.ProjectsVisited.Should().Be(0);
            _f.RepoRepo.Verify(r => r.GetProjectRepos(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        /// <summary>A repository that was never deployed has no namespace to destroy, but is still retired.</summary>
        [Fact]
        public async Task RepoWithNoDeployedNamespace_IsArchivedWithoutATeardown()
        {
            SetupProjectInGroup(ProjectId, NewRepo("repo-1", ProjectId, "res-1"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.DeploymentsDeleted.Should().Be(0);
            summary.ReposArchived.Should().Be(1);
            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        /// <summary>
        /// A refused teardown must not archive: hiding the repository would take away the only list a
        /// retry could be driven from while its namespace is still running.
        /// </summary>
        [Fact]
        public async Task TeardownRefused_RecordsAFailureAndLeavesTheRepoUnarchived()
        {
            var repo = NewRepo("repo-1", ProjectId, "res-1", deployedNamespace: "tekton-pipelines");
            SetupProjectInGroup(ProjectId, repo);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", ProjectId)).ReturnsAsync(repo);

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ReposMatched.Should().Be(1);
            summary.DeploymentsDeleted.Should().Be(0);
            summary.ReposArchived.Should().Be(0);
            summary.HasFailures.Should().BeTrue();
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-1", ProjectId), Times.Never);
        }

        /// <summary>One failing repository must not strand the ones behind it in the same run.</summary>
        [Fact]
        public async Task OneFailingRepo_DoesNotStopTheRest()
        {
            var refused = NewRepo("repo-1", ProjectId, "res-1", deployedNamespace: "kube-system");
            var healthy = NewRepo("repo-2", ProjectId, "res-2");
            SetupProjectInGroup(ProjectId, refused, healthy);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1", ProjectId)).ReturnsAsync(refused);

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ReposMatched.Should().Be(2);
            summary.ReposArchived.Should().Be(1);
            summary.Failures.Should().ContainSingle();
            _f.RepoRepo.Verify(r => r.ArchiveRepo("repo-2", ProjectId), Times.Once);
        }

        [Fact]
        public async Task ArchiveWriteFails_IsRecordedAsAFailure()
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync(ProjectId)).ReturnsAsync(NewProject(ProjectId, GroupId));
            _f.RepoRepo.Setup(r => r.GetProjectRepos(ProjectId, It.IsAny<string>()))
                       .ReturnsAsync(new List<Repo> { NewRepo("repo-1", ProjectId, "res-1") });
            _f.RepoRepo.Setup(r => r.ArchiveRepo("repo-1", ProjectId)).ReturnsAsync(false);

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId, ProjectId = ProjectId });

            summary.ReposArchived.Should().Be(0);
            summary.HasFailures.Should().BeTrue();
        }

        /// <summary>A repository write that throws is contained, so the remaining projects still run.</summary>
        [Fact]
        public async Task RepoWriteThrows_IsContainedAndTheRunContinues()
        {
            SetupGroup("tenant-a", "tenant-b");
            _f.RepoRepo.Setup(r => r.GetProjectRepos("tenant-a", It.IsAny<string>()))
                       .ReturnsAsync(new List<Repo> { NewRepo("repo-1", "tenant-a", "res-1") });
            _f.RepoRepo.Setup(r => r.ArchiveRepo("repo-1", "tenant-a"))
                       .ThrowsAsync(new System.InvalidOperationException("boom"));
            SetupProject("tenant-b", NewRepo("repo-2", "tenant-b", "res-1"));

            var summary = await _f.DeploymentTeardownService()
                .TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId });

            summary.ProjectsVisited.Should().Be(2);
            summary.ReposArchived.Should().Be(1);
            summary.Failures.Should().ContainSingle();
        }
    }
}
