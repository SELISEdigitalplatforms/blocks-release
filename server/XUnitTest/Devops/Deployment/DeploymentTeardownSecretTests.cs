using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Models;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Secret cleanup during teardown.
    ///
    /// Most of these assert what must NOT happen: the secret step is a best-effort follow-up to the
    /// archive, and every test here exists because some failure of it could otherwise regress the
    /// archive that already succeeded.
    ///
    /// Repositories are given no DeployedNamespace, so the namespace delete is skipped and the
    /// assertions stay on the archive/secret sequence.
    /// </summary>
    public class DeploymentTeardownSecretTests
    {
        private const string GroupId = "group-1";
        private const string TenantId = "tenant-a";
        private const string SecretId = "secret-1";

        private readonly DeploymentServiceFactory _f = new();

        private static Repo NewRepo(string itemId, string secretStoreItemId = null, string deployedNamespace = null) => new()
        {
            ItemId = itemId,
            ProjectId = TenantId,
            SourceRepoId = "resource-" + itemId,
            RepoName = "org/" + itemId,
            DeployedNamespace = deployedNamespace,
            SecretStoreItemId = secretStoreItemId
        };

        private static Tenant NewProject(string tenantId) => new()
        {
            TenantId = tenantId,
            TenantGroupId = GroupId,
            DbConnectionString = "mongodb://localhost",
            JwtTokenParameters = null!
        };

        private void SetupProject(bool archiveSucceeds = true, params Repo[] repos)
        {
            _f.TenantLookup.Setup(t => t.GetProjectsByGroupAsync(GroupId))
                           .ReturnsAsync(new List<Tenant> { NewProject(TenantId) });
            _f.RepoRepo.Setup(r => r.GetProjectRepos(TenantId, It.IsAny<string>()))
                       .ReturnsAsync(new List<Repo>(repos));
            _f.RepoRepo.Setup(r => r.ArchiveRepo(It.IsAny<string>(), TenantId)).ReturnsAsync(archiveSucceeds);
        }

        private Task<DeploymentTeardownSummary> TearDown() =>
            _f.DeploymentTeardownService().TearDownAsync(new ProjectDeleteQueue { TenantGroupId = GroupId });

        // ---- H1 / H3 ----

        [Fact]
        public async Task ArchivedRepoWithASecret_SoftDeletesItAndCounts()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .Returns(Task.CompletedTask);

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(1);
            summary.SecretsDeleted.Should().Be(1);
            summary.Failures.Should().BeEmpty();
            _f.SecretService.Verify(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
        }

        /// <summary>The pointer is what makes a restore possible, so teardown must not clear it.</summary>
        [Fact]
        public async Task SecretDelete_DoesNotClearTheRepositoryPointer()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .Returns(Task.CompletedTask);

            await TearDown();

            _f.RepoRepo.Verify(
                r => r.UpdateRepoSecretStoreItemId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        /// <summary>The identity is what lands in DeletedBy and in the audit row's actor.</summary>
        [Fact]
        public async Task SecretDelete_RunsInsideAContextForTheRepositorysTenant()
        {
            SetupProject(repos: NewRepo("r1", SecretId));

            BlocksContext captured = null;
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .Callback(() => captured = BlocksContext.GetContext())
                            .Returns(Task.CompletedTask);

            await TearDown();

            captured.Should().NotBeNull();
            captured.TenantId.Should().Be(TenantId);
            captured.UserId.Should().Be("blocks-release-worker");
            captured.IsAuthenticated.Should().BeTrue();
        }

        /// <summary>The context must not leak past the call that needed it.</summary>
        [Fact]
        public async Task SecretDelete_LeavesNoAmbientContextBehind()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .Returns(Task.CompletedTask);

            await TearDown();

            BlocksContext.GetContext().Should().BeNull();
        }

        // ---- H2: the common case is untouched ----

        [Fact]
        public async Task ArchivedRepoWithoutASecret_TouchesTheSecretServiceNotAtAll()
        {
            SetupProject(repos: NewRepo("r1"));

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(1);
            summary.SecretsDeleted.Should().Be(0);
            summary.Failures.Should().BeEmpty();
            _f.SecretService.VerifyNoOtherCalls();
        }

        // ---- C1 / C4: a secret failure never costs the archive ----

        [Fact]
        public async Task SecretDeleteFails_ArchiveStillCountsAndTheFailureIsRecorded()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .ThrowsAsync(new SecretVaultException("vault down", "Delete", SecretId));

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(1);
            summary.SecretsDeleted.Should().Be(0);
            summary.Failures.Should().ContainSingle()
                   .Which.Should().Contain("secret delete failed");
        }

        [Fact]
        public async Task SecretDeleteFails_TheRestOfTheRepositoriesAreStillTornDown()
        {
            SetupProject(true, NewRepo("r1", SecretId), NewRepo("r2", "secret-2"), NewRepo("r3"));

            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .ThrowsAsync(new InvalidOperationException("no vault url"));
            _f.SecretService.Setup(s => s.DeleteAsync("secret-2", It.IsAny<CancellationToken>()))
                            .Returns(Task.CompletedTask);

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(3);
            summary.SecretsDeleted.Should().Be(1);
            summary.Failures.Should().ContainSingle();
        }

        // ---- C5: redelivery is safe ----

        [Fact]
        public async Task SecretAlreadyDeleted_IsNotRecordedAsAFailure()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .ThrowsAsync(new SecretStateException(SecretStatuses.Deleted, "delete", "STATUS_DELETED"));

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(1);
            summary.SecretsDeleted.Should().Be(0);
            summary.Failures.Should().BeEmpty();
        }

        /// <summary>A locked secret is a real failure - only the already-deleted case is idempotent.</summary>
        [Fact]
        public async Task SecretInAnotherBlockingState_IsRecordedAsAFailure()
        {
            SetupProject(repos: NewRepo("r1", SecretId));
            _f.SecretService.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                            .ThrowsAsync(new SecretStateException(SecretStatuses.Locked, "delete", "STATUS_LOCKED"));

            var summary = await TearDown();

            summary.Failures.Should().ContainSingle();
        }

        // ---- C7: no archive, no secret delete ----

        [Fact]
        public async Task ArchiveFails_TheSecretIsLeftAlone()
        {
            SetupProject(archiveSucceeds: false, repos: NewRepo("r1", SecretId));

            var summary = await TearDown();

            summary.ReposArchived.Should().Be(0);
            summary.SecretsDeleted.Should().Be(0);
            _f.SecretService.VerifyNoOtherCalls();
        }
    }
}
