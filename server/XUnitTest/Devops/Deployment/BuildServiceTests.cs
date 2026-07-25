using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Models;
using FluentAssertions;
using FluentValidation.Results;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class BuildServiceTests : IDisposable
    {
        private readonly DeploymentServiceFactory _f = new();

        private void SetContext(string tenantId = "tenant-b") =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        public void Dispose() => BlocksContext.ClearContext();

        [Fact]
        public async Task GetBuildWithRepo_Found_ReturnsBuild()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "r" });
            (await _f.BuildService().GetBuildWithRepo("b1")).Should().NotBeNull();
        }

        [Fact]
        public async Task GetBuildWithRepo_NotFound_ReturnsNull()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync((Build)null);
            (await _f.BuildService().GetBuildWithRepo("b1")).Should().BeNull();
        }

        [Fact]
        public async Task UpdateRepo_RepoNotFound_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task UpdateRepo_Success_UpdatesWebhookAndReturnsOk()
        {
            var repo = new Repo { ItemId = "id", DeploymentType = "Manual" };
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(repo);
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);
            _f.Webhook.Setup(w => w.UpdateWebhookStatus(It.IsAny<Repo>(), It.IsAny<bool>())).ReturnsAsync(true);

            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", DeploymentType = "Auto" });

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task UpdateRepo_UpdateFails_ReturnsFailedMessage()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);
            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.Message.Should().Be("Failed to update.");
        }

        [Fact]
        public async Task ManualBuild_RepoNotFound_ReturnsRepoNotFound()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            var result = await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "id" });
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Repo not found.");
        }

        [Fact]
        public async Task RunBuild_RepoNotFound_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "id" });
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task RunBuild_BranchMissing_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { RepoName = "org/r", Branch = "main" });
            _f.Vcs.Setup(v => v.GetRepoBranchByName("org/r", "main")).ReturnsAsync((false, "no branch"));
            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "id" });
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Contain("no branch");
        }

        [Fact]
        public async Task RunBuild_Exception_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ThrowsAsync(new InvalidOperationException("boom"));
            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "id" });
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        // ---- UpdateRepoDomain ----

        [Fact]
        public async Task UpdateRepoDomain_NoContext_ReturnsBadRequest()
        {
            var result = await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest());
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task UpdateRepoDomain_Invalid_ReturnsErrors()
        {
            SetContext();
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("ProjectEnv", "required") }));
            var result = await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest());
            result.Errors.Should().ContainKey("ProjectEnv");
        }

        [Fact]
        public async Task UpdateRepoDomain_Success_ReturnsOk()
        {
            SetContext();
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
              .ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true, ModifiedCount = 1 });

            var request = new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain> { new() { RepoId = "r1", CustomDeploymentDomain = "d.com" } }
            };
            var result = await _f.BuildService().UpdateRepoDomain(request);

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task UpdateRepoDomain_NotAcknowledged_ReturnsSomethingWrong()
        {
            SetContext();
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
              .ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });

            var result = await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain>()
            });
            result.Message.Should().Be("Something went wrong.");
        }

        // ---- TransformToRepoCustomDomains ----

        [Fact]
        public async Task TransformToRepoCustomDomains_NoContext_ReturnsEmpty()
        {
            var result = await _f.BuildService().TransformToRepoCustomDomains(new RepoDomainUpdateRequest
            {
                repoWithDomains = new List<RepoWithDomain> { new() { RepoId = "r" } }
            });
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task TransformToRepoCustomDomains_NewAndExisting_Merges()
        {
            SetContext("tenant-b");
            var existing = new RepoCustomDomain { RepoId = "r1", ProjectId = "tenant-b", ProjectEnv = "prod", CustomDeploymentDomain = "old" };
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
              .ReturnsAsync(new List<RepoCustomDomain> { existing });

            var request = new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain>
                {
                    new() { RepoId = "r1", CustomDeploymentDomain = "new" },
                    new() { RepoId = "r2", CustomDeploymentDomain = "d2" },
                    new() { RepoId = "", CustomDeploymentDomain = "skip" }
                }
            };
            var result = await _f.BuildService().TransformToRepoCustomDomains(request);
            result.Should().HaveCount(2);
        }

        // ---- RepoWebhookUpdate ----

        [Fact]
        public async Task RepoWebhookUpdate_Auto_EnablesWebhook()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.Webhook.Setup(w => w.UpdateWebhookStatus(It.IsAny<Repo>(), true)).ReturnsAsync(true);
            var result = await _f.BuildService().RepoWebhookUpdate(new RepoUpdateRequest { DeploymentType = "Auto" }, new Repo { ItemId = "id" });
            result.Should().BeTrue();
        }

        [Fact]
        public async Task RepoWebhookUpdate_Manual_DisablesWebhook()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.Webhook.Setup(w => w.UpdateWebhookStatus(It.IsAny<Repo>(), false)).ReturnsAsync(false);
            var result = await _f.BuildService().RepoWebhookUpdate(new RepoUpdateRequest { DeploymentType = "Manual" }, new Repo { ItemId = "id" });
            result.Should().BeFalse();
        }

        [Fact]
        public async Task RepoWebhookUpdate_Unknown_ReturnsFalse()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            var result = await _f.BuildService().RepoWebhookUpdate(new RepoUpdateRequest { DeploymentType = "Other" }, new Repo { ItemId = "id" });
            result.Should().BeFalse();
        }

        // ---- HandleWebhookEventAsync ----

        [Fact]
        public async Task HandleWebhookEventAsync_UnhandledType_ReturnsNotTriggered()
        {
            var result = await _f.BuildService().HandleWebhookEventAsync("pull_request", "{}", "tenant");
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Build not triggered.");
        }

        [Fact]
        public async Task HandleWebhookEventAsync_PushNonAutoRepo_ReturnsNotTriggered()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
              .ReturnsAsync(new Repo { DeploymentType = "Manual" });
            var json = "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"org/r\"},\"pusher\":{\"name\":\"p\"}}";
            var result = await _f.BuildService().HandleWebhookEventAsync("push", json, "tenant");
            result.Message.Should().Be("Build not triggered.");
        }

        [Fact]
        public async Task HandleWebhookEventAsync_PushRepoNull_ReturnsNotTriggered()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
              .ReturnsAsync((Repo)null);
            var json = "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"org/r\"},\"pusher\":{\"name\":\"p\"}}";
            var result = await _f.BuildService().HandleWebhookEventAsync("push", json, "tenant");
            result.IsSuccess.Should().BeFalse();
        }
    }
}
