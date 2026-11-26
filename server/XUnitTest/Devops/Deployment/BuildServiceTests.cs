using Blocks.Genesis.Entities.Release;
using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Models;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
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
            _f.BuildRepo.Setup(b => b.GetBuildForView("b1")).ReturnsAsync(new Build { RepoName = "r" });
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

        // H6: Manual -> Auto turns the hook on with the signed-in user's token, then saves.
        [Fact]
        public async Task UpdateRepo_ManualToAuto_TurnsTheHookOnFirstThenSaves()
        {
            SetContext("tenant-b");
            var repo = new Repo { ItemId = "id", ProjectId = "tenant-b", RepoName = "org/web", DeploymentType = "Manual" };
            var order = new List<string>();
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(repo);
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, true, "tenant-b", "user-1"))
                .Callback(() => order.Add("webhook")).ReturnsAsync(WebhookOutcome.Success(new GithubWebhook { Id = 1, Active = true }));
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>()))
                .Callback(() => order.Add("save")).ReturnsAsync(true);

            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", DeploymentType = "auto" });

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            result.Warning.Should().BeNull();
            order.Should().Equal("webhook", "save");
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.Is<RepoUpdateRequest>(q => q.DeploymentType == "Auto")), Times.Once);
        }

        // C1: refused, nothing saved.
        [Fact]
        public async Task UpdateRepo_ManualToAuto_Refused_SavesNothing()
        {
            SetContext("tenant-b");
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id", RepoName = "org/web", DeploymentType = "Manual" });
            _f.Webhook.Setup(w => w.SetActiveAsync(It.IsAny<Repo>(), true, "tenant-b", "user-1"))
                .ReturnsAsync(WebhookOutcome.Failure(WebhookCodes.NotConnected));

            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", DeploymentType = "Auto", CustomDomain = "x.example.com" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Errors["webhook"].Should().Be(WebhookCodes.NotConnected);
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>()), Times.Never);
        }

        // C7, then H8: Auto -> Manual saves first and turns the hook off after; no mode change makes no call.
        [Fact]
        public async Task UpdateRepo_AutoToManual_SavesThenTurnsTheHookOff_WithAWarningWhenItStaysOn()
        {
            SetContext("tenant-b");
            var repo = new Repo { ItemId = "id", RepoName = "org/web", DeploymentType = "Auto", GithubWebhook = new GithubWebhook { Id = 3, Active = true } };
            var order = new List<string>();
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(repo);
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).Callback(() => order.Add("save")).ReturnsAsync(true);
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, false, "tenant-b", "user-1"))
                .Callback(() => order.Add("webhook")).ReturnsAsync(WebhookOutcome.Failure(WebhookCodes.Permission));

            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", DeploymentType = "manual" });

            result.IsSuccess.Should().BeTrue();
            result.Warning.Code.Should().Be(DeploymentWarning.WebhookStillActive);
            order.Should().Equal("save", "webhook");
        }

        [Fact]
        public async Task UpdateRepo_WithoutAModeChange_LeavesTheWebhookAlone()
        {
            SetContext("tenant-b");
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id", DeploymentType = "Manual" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);

            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", DeploymentType = "Manual" });

            result.IsSuccess.Should().BeTrue();
            _f.Webhook.Verify(w => w.SetActiveAsync(It.IsAny<Repo>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // C15: "Failed to update." is a failure, never isSuccess true.
        [Fact]
        public async Task UpdateRepo_UpdateFails_IsABadRequestFailure()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);
            var result = await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.Message.Should().Be("Failed to update.");
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task UpdateRepo_ReadsDeploySettingsWhenAllThreeAreGiven()
        {
            var settings = new DeploySettings();
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.RepoRepo.Setup(r => r.GetDeploySettings("p", "r", "m")).ReturnsAsync(settings);
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);

            await _f.BuildService().UpdateRepo(new RepoUpdateRequest { RepoId = "id", HostingProviderId = "p", RegionId = "r", MachineConfigId = "m" });

            _f.RepoRepo.Verify(r => r.UpdateRepo(It.Is<RepoUpdateRequest>(q => q.deploySettings == settings)), Times.Once);
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
    
        [Fact]
        public async Task SaveBuild_CopiesTheRepoIdentityOntoTheBuild()
        {
            Build saved = null;
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>()))
                .Callback<Build>(b => saved = b)
                .Returns(Task.CompletedTask);
            var repo = new Repo
            {
                ItemId = "repo-1",
                RepoName = "web",
                RepoUrl = "https://github.com/org/web",
                DefaultDeploymentUrl = "https://web.example.com",
                CustomDeploymentUrl = "https://custom.example.com",
                IsCustomDomainOnly = true,
                ProjectId = "proj-1",
                ProjectName = "Demo",
            };

            var result = await _f.BuildService()
                .SaveBuild(repo, new BuildRequest { branch = "main" }, "img:1", "user-9", "run-guid");

            result.Should().NotBeNull();
            saved.Should().NotBeNull();
            saved.RepoId.Should().Be("repo-1");
            saved.RepoName.Should().Be("web");
            saved.RepoUrl.Should().Be("https://github.com/org/web");
            saved.DefaultDeploymentUrl.Should().Be("https://web.example.com");
            saved.CustomDeploymentUrl.Should().Be("https://custom.example.com");
            saved.IsCustomDomainOnly.Should().BeTrue();
            saved.ProjectId.Should().Be("proj-1");
            saved.ProjectName.Should().Be("Demo");
        }

        [Fact]
        public async Task SaveBuild_CarriesTheRequestBranchImageUserAndPipelineName()
        {
            Build saved = null;
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>()))
                .Callback<Build>(b => saved = b)
                .Returns(Task.CompletedTask);

            await _f.BuildService().SaveBuild(
                new Repo { ItemId = "repo-1" },
                new BuildRequest { branch = "release/1.2" },
                "registry/img:sha", "user-9", "pipelinerun-abc");

            saved.Branch.Should().Be("release/1.2");
            saved.ImageName.Should().Be("registry/img:sha");
            saved.BlocksUserId.Should().Be("user-9");
            saved.PipelineRunName.Should().Be("pipelinerun-abc");
            saved.CreatedBy.Should().Be("user-9", "the triggering user is also the author");
        }

        [Fact]
        public async Task SaveBuild_GivesEveryBuildItsOwnIdAndTimestamps()
        {
            var saved = new List<Build>();
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>()))
                .Callback<Build>(saved.Add)
                .Returns(Task.CompletedTask);
            var svc = _f.BuildService();

            await svc.SaveBuild(new Repo { ItemId = "r" }, new BuildRequest { branch = "main" }, "i", "u", "p1");
            await svc.SaveBuild(new Repo { ItemId = "r" }, new BuildRequest { branch = "main" }, "i", "u", "p2");

            saved.Should().HaveCount(2);
            saved[0].ItemId.Should().NotBeNullOrWhiteSpace();
            saved[0].ItemId.Should().NotBe(saved[1].ItemId);
            saved[0].CreatedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
            saved[0].LastUpdatedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        }

        [Fact]
        public async Task GetRepos_PassesTheProjectThroughToTheRepository()
        {
            IReadOnlyList<RepoWithBuildsResponse> expected = new List<RepoWithBuildsResponse> { new(), new() };
            _f.RepoRepo.Setup(r => r.GetReposWithBuildsAsync("proj-1")).ReturnsAsync(expected);

            var result = await _f.BuildService().GetRepos("proj-1");

            result.Should().BeSameAs(expected);
            _f.RepoRepo.Verify(r => r.GetReposWithBuildsAsync("proj-1"), Times.Once);
        }

        [Fact]
        public async Task GetRepos_ReturnsAnEmptyListForAProjectWithNoRepos()
        {
            _f.RepoRepo.Setup(r => r.GetReposWithBuildsAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<RepoWithBuildsResponse>().AsReadOnly());

            (await _f.BuildService().GetRepos("empty")).Should().BeEmpty();
        }

        /// <summary>
        /// A GitHub push payload with every field <c>FromWebhookPayload</c> reads. Kept whole
        /// rather than trimmed, because the mapper uses GetProperty and throws on a missing one.
        /// </summary>
        private const string PushPayload = """
        {
          "ref": "refs/heads/main",
          "before": "aaa111",
          "after": "bbb222",
          "repository": { "full_name": "org/web", "fullName": "org/web", "html_url": "https://github.com/org/web" },
          "pusher": { "name": "pusher-name", "email": "pusher@example.com" },
          "head_commit": {
            "id": "ccc333",
            "message": "fix the thing",
            "timestamp": "2026-01-02T03:04:05Z",
            "url": "https://github.com/org/web/commit/ccc333",
            "author": { "name": "Author Name", "email": "author@example.com" },
            "committer": { "name": "Committer Name", "email": "committer@example.com" }
          },
          "commits": [ { "id": "ccc333" } ]
        }
        """;

        [Fact]
        public async Task SaveWbhook_MapsEveryFieldOfThePushPayload()
        {
            RepositoryWebhook saved = null;
            _f.BuildRepo.Setup(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()))
                .Callback<RepositoryWebhook, string>((w, _) => saved = w)
                .ReturnsAsync(true);

            var result = await _f.BuildService()
                .SaveWbhook(PushPayload, new Repo { ItemId = "repo-1" }, "tenant-b");

            result.Should().BeTrue();
            saved.RepoId.Should().Be("repo-1");
            saved.RepoUrl.Should().Be("https://github.com/org/web");
            saved.Ref.Should().Be("refs/heads/main");
            saved.BeforeSha.Should().Be("aaa111");
            saved.AfterSha.Should().Be("bbb222");
            saved.HeadCommitSha.Should().Be("ccc333");
            saved.HeadCommitMessage.Should().Be("fix the thing");
            saved.HeadCommitUrl.Should().Be("https://github.com/org/web/commit/ccc333");
            saved.HeadCommitTimestamp.Should().Be(new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc));
            saved.AuthorName.Should().Be("Author Name");
            saved.AuthorEmail.Should().Be("author@example.com");
            saved.CommitterName.Should().Be("Committer Name");
            saved.CommitterEmail.Should().Be("committer@example.com");
            saved.PusherName.Should().Be("pusher-name");
            saved.PusherEmail.Should().Be("pusher@example.com");
            saved.ItemId.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task SaveWbhook_StoresTheWebhookAgainstTheCallingTenant()
        {
            _f.BuildRepo.Setup(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            await _f.BuildService().SaveWbhook(PushPayload, new Repo { ItemId = "repo-1" }, "tenant-b");

            _f.BuildRepo.Verify(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), "tenant-b"), Times.Once);
        }

        [Fact]
        public async Task SaveWbhook_ReturnsFalseForAPayloadThatIsNotAPushEvent()
        {
            // A malformed or unexpected payload must not bubble out of the webhook endpoint.
            var result = await _f.BuildService()
                .SaveWbhook("{\"ref\":\"refs/heads/main\"}", new Repo { ItemId = "repo-1" }, "tenant-b");

            result.Should().BeFalse();
            _f.BuildRepo.Verify(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SaveWbhook_ReturnsFalseWhenTheRepositoryRejectsTheWrite()
        {
            _f.BuildRepo.Setup(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            (await _f.BuildService().SaveWbhook(PushPayload, new Repo { ItemId = "r" }, "t")).Should().BeFalse();
        }

        [Fact]
        public async Task HandleWebhookEventAsync_TriggersABuildForAnAutoDeployRepo()
        {
            SetContext();
            _f.RepoRepo.Setup(r => r.GetRepoByBranch("tenant-b", It.IsAny<string>(), "main"))
                .ReturnsAsync(new Repo { ItemId = "repo-1", ProjectId = "tenant-b", RepoName = "web", Branch = "main", DeploymentType = "Auto" });
            _f.BuildRepo.Setup(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var result = await _f.BuildService().HandleWebhookEventAsync("push", PushPayload, "tenant-b");

            // The push is recorded and a build is attempted; the pipeline itself is not reachable here.
            _f.BuildRepo.Verify(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), "tenant-b"), Times.Once);
            result.Message.Should().NotBe("Build not triggered.");
        }

        [Fact]
        public async Task HandleWebhookEventAsync_ReadsTheBranchOffTheRefBeforeLookingUpTheRepo()
        {
            SetContext();
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Repo)null);

            await _f.BuildService().HandleWebhookEventAsync("push", PushPayload, "tenant-b");

            // "refs/heads/main" has to resolve to "main", not the whole ref.
            _f.RepoRepo.Verify(r => r.GetRepoByBranch("tenant-b", It.IsAny<string>(), "main"), Times.Once);
        }

        [Fact]
        public async Task HandleWebhookEventAsync_DoesNotBuildAManualDeployRepo()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new Repo { ItemId = "repo-1", DeploymentType = "Manual" });

            var result = await _f.BuildService().HandleWebhookEventAsync("push", PushPayload, "tenant-b");

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Build not triggered.");
            _f.BuildRepo.Verify(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task HandleWebhookEventAsync_DoesNotBuildWhenNoRepoMatchesTheBranch()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Repo)null);

            var result = await _f.BuildService().HandleWebhookEventAsync("push", PushPayload, "tenant-b");

            result.Message.Should().Be("Build not triggered.");
        }

        [Theory]
        [InlineData("pull_request")]
        [InlineData("ping")]
        [InlineData("")]
        public async Task HandleWebhookEventAsync_IgnoresEventTypesItDoesNotHandle(string eventType)
        {
            var result = await _f.BuildService().HandleWebhookEventAsync(eventType, PushPayload, "tenant-b");

            result.Message.Should().Be("Build not triggered.");
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            _f.RepoRepo.Verify(
                r => r.GetRepoByBranch(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Build_ReportsTheReasonWhenThePipelineCannotBeInitiated()
        {
            SetContext();

            var result = await _f.BuildService()
                .Build(new BuildRequest { branch = "main" }, new Repo { ItemId = "r", ProjectId = "tenant-b", RepoName = "web" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().StartWith("Failed to initiate pipeline.");
            _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>()), Times.Never, "no build row for a pipeline that never started");
        }

        [Fact]
        public async Task Build_ReportsTheReasonWhenThereIsNoRepository()
        {
            SetContext();

            var result = await _f.BuildService().Build(new BuildRequest { branch = "main" }, null);

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Contain("Repository not found.");
        }

        [Fact]
        public async Task Build_TurnsAnUnexpectedFailureIntoABadRequestRatherThanThrowing()
        {
            BlocksContext.SetContext(null);

            var act = async () => await _f.BuildService()
                .Build(new BuildRequest { branch = "main" }, new Repo { ItemId = "r" });

            var result = await act.Should().NotThrowAsync();
            result.Subject.IsSuccess.Should().BeFalse();
            result.Subject.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task ManualBuild_BuildsTheRequestFromTheStoredRepo()
        {
            SetContext();
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(new Repo
            {
                ItemId = "repo-1",
                RepoName = "web",
                RepoUrl = "https://github.com/org/web",
                Branch = "main",
                DefaultDeploymentUrl = "https://web.example.com",
                ProjectName = "Demo",
                DeploymentType = "Manual",
            });

            var result = await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "repo-1" });

            // The repo is the source of truth for a manual build; the caller supplies only its id.
            _f.RepoRepo.Verify(r => r.GetRepo("repo-1"), Times.Once);
            result.Message.Should().NotBe("Repo not found.");
        }

        [Fact]
        public async Task ManualBuild_ReportsAMissingRepo()
        {
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>())).ReturnsAsync((Repo)null);

            var result = await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "gone" });

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Repo not found.");
        }

        [Fact]
        public async Task RunBuild_RefusesWhenTheBranchIsMissingFromTheRemote()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1"))
                .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "web", Branch = "gone" });
            _f.Vcs.Setup(v => v.GetRepoBranchByName("web", "gone")).ReturnsAsync((false, "Branch not found."));

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be("Failed to initiate build. Branch not found.");
        }

        [Fact]
        public async Task RunBuild_DoesNotCreateAMonitorWhenTheBuildFails()
        {
            SetContext();
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1"))
                .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "web", Branch = "main" });
            _f.Vcs.Setup(v => v.GetRepoBranchByName("web", "main")).ReturnsAsync((false, "Branch not found."));

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", viewInBlocksMonitor = true });

            result.IsSuccess.Should().BeFalse();
            _f.MonitorProvisioning.Verify(m => m.CreateMonitorForRepoAsync(It.IsAny<Repo>()), Times.Never);
        }

        [Fact]
        public async Task RunBuild_ProceedsWhenTheBranchExists()
        {
            SetContext();
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1"))
                .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "web", Branch = "main" });
            _f.Vcs.Setup(v => v.GetRepoBranchByName("web", "main")).ReturnsAsync((true, string.Empty));

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1" });

            _f.Vcs.Verify(v => v.GetRepoBranchByName("web", "main"), Times.Once);
            result.Message.Should().NotStartWith("Failed to initiate build.");
        }

        [Fact]
        public async Task RunBuild_ReportsAMissingRepo()
        {
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>())).ReturnsAsync((Repo)null);

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "gone" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be("Repo not found.");
        }

        // #255 H1: a new build starts with both saved reports Pending and no attempts, through either SaveBuild
        // overload: the public one (no tenant) and the tenant one that Build() reaches.
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task SaveBuild_H1_StartsBothAnalysisReportsPendingWithNoAttempts(bool throughTheTenantOverload)
        {
            Build saved = null;
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>()))
                .Callback<Build>(b => saved = b)
                .Returns(Task.CompletedTask);
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>(), It.IsAny<string>()))
                .Callback<Build, string>((b, _) => saved = b)
                .Returns(Task.CompletedTask);

            if (throughTheTenantOverload)
            {
                SetContext("tenant-1");
                _f.TokenRepo.Setup(t => t.getToken("user-1")).ReturnsAsync("gh-token");
                _f.CustomObjects
                    .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                        It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                        It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                        It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                        It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                        It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new k8s.Autorest.HttpOperationResponse<object>
                    {
                        Body = new Dictionary<string, object> { ["metadata"] = "created" },
                        Request = new System.Net.Http.HttpRequestMessage(),
                        Response = new System.Net.Http.HttpResponseMessage(),
                    });

                var response = await _f.BuildService().Build(new BuildRequest { branch = "dev" },
                    new Repo { ItemId = "repo-1", ProjectId = "tenant-1", ProjectName = "p", RepoName = "web", RepoUrl = "https://github.com/org/web.git", Branch = "dev", CreatedBy = "user-1",
                        DefaultDeploymentUrl = "web.example.com", CustomDeploymentUrl = "custom.example.com" });

                response.IsSuccess.Should().BeTrue(response.Message);
                _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>(), "tenant-1"), Times.Once);
                _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>()), Times.Never);
                saved.Should().NotBeNull();
                response.buildId.Should().Be(saved.ItemId);
            }
            else
            {
                var result = await _f.BuildService().SaveBuild(new Repo { ItemId = "repo-1" }, new BuildRequest { branch = "dev" }, "img", "user-1", "run-1");

                saved.Should().BeSameAs(result);
                _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>()), Times.Once);
                _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>(), It.IsAny<string>()), Times.Never);
            }

            saved.SastReport.Should().NotBeNull();
            saved.SastReport.Status.Should().Be(AnalysisReportStatus.Pending);
            saved.SastReport.Attempts.Should().Be(0);
            saved.SastReport.Message.Should().BeNull();
            saved.SastReport.Metrics.Should().BeNullOrEmpty();
            saved.ScaReport.Should().NotBeNull();
            saved.ScaReport.Status.Should().Be(AnalysisReportStatus.Pending);
            saved.ScaReport.Attempts.Should().Be(0);
            saved.ScaReport.Message.Should().BeNull();
            saved.ScaReport.Findings.Should().BeNullOrEmpty();
        }

        // ---- #279: the deployment-mode step inside deploys ----

        private Repo ArrangeRepo(string mode, GithubWebhook hook = null)
        {
            SetContext("tenant-1");
            var repo = new Repo
            {
                ItemId = "repo-1", ProjectId = "tenant-1", ProjectName = "p", RepoName = "org/web",
                RepoUrl = "https://github.com/org/web.git", Branch = "dev", CreatedBy = "user-1",
                DefaultDeploymentUrl = "web.example.com", DeploymentType = mode, GithubWebhook = hook,
            };
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(repo);
            _f.Vcs.Setup(v => v.GetRepoBranchByName("org/web", "dev")).ReturnsAsync((true, string.Empty));
            return repo;
        }

        /// <summary>Lets CreateNamespaceAsync submit its PipelineRun, so a deploy can go all the way through.</summary>
        private void ArrangePipelineStarts()
        {
            _f.TokenRepo.Setup(t => t.getToken("user-1")).ReturnsAsync("gh-token");
            _f.CustomObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new k8s.Autorest.HttpOperationResponse<object>
                {
                    Body = new Dictionary<string, object> { ["metadata"] = "created" },
                    Request = new System.Net.Http.HttpRequestMessage(),
                    Response = new System.Net.Http.HttpResponseMessage(),
                });
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>(), It.IsAny<string>())).Returns(Task.CompletedTask);
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>())).ReturnsAsync(true);
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), It.IsAny<string>())).ReturnsAsync(true);
        }

        private void VerifyNothingStarted()
        {
            // CreateNamespaceAsync reads the owner's token first: no read means no PipelineRun.
            _f.TokenRepo.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
            _f.CustomObjects.Verify(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), It.IsAny<CancellationToken>()), Times.Never);
            _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>(), It.IsAny<string>()), Times.Never);
            _f.BuildRepo.Verify(b => b.SaveBuild(It.IsAny<Build>()), Times.Never);
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), It.IsAny<string>()), Times.Never);
        }

        // C2, example 4: a refused mode step starts no pipeline, saves no build and changes no repository.
        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Deploy_ModeStepRefusal_StartsNothing(bool throughRunBuild)
        {
            ArrangeRepo("Auto");
            _f.Webhook.Setup(w => w.SetActiveAsync(It.IsAny<Repo>(), true, "tenant-1", "user-1"))
                .ReturnsAsync(WebhookOutcome.Failure(WebhookCodes.NotConnected));

            var result = throughRunBuild
                ? await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1" })
                : await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "repo-1" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be("Connect your GitHub account to use Git based deployment. To deploy now, switch to Blocks Cloud based deployment in Settings.");
            result.Errors["webhook"].Should().Be(WebhookCodes.NotConnected);
            result.buildId.Should().BeNull();
            VerifyNothingStarted();
        }

        private static Blocks.Genesis.DataAccess.Rules.DataValidationResult RuleRefusal(string field, string message)
        {
            var result = new Blocks.Genesis.DataAccess.Rules.DataValidationResult();
            result.AddError(field, message, "MaxLength");
            return result;
        }

        // C12: a rule refusal comes first, with no GitHub call.
        [Fact]
        public async Task Deploy_RuleRefusal_MakesNoGithubCall()
        {
            ArrangeRepo("Manual");
            _f.RepoRepo.Setup(r => r.CheckRepoAsync(It.IsAny<Repo>(), "tenant-1"))
                .ThrowsAsync(new Blocks.Genesis.DataAccess.Rules.DataValidationException(RuleRefusal("Branch", "Branch must be main")));

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = "auto" });

            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            _f.Webhook.Verify(w => w.SetActiveAsync(It.IsAny<Repo>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // H2, H3/C19: the dialog's "auto" turns the hook on before the pipeline and the repository is stored Auto.
        [Fact]
        public async Task RunBuild_AutoChosenForAManualRepository_TurnsTheHookOnBeforeThePipelineAndStoresAuto()
        {
            var repo = ArrangeRepo("Manual");
            ArrangePipelineStarts();
            var order = new List<string>();
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, true, "tenant-1", "user-1"))
                .Callback(() => { order.Add("webhook"); repo.GithubWebhook = new GithubWebhook { Id = 42, Active = true }; })
                .ReturnsAsync(WebhookOutcome.Success(new GithubWebhook { Id = 42, Active = true }));
            _f.TokenRepo.Setup(t => t.getToken("user-1")).Callback(() => order.Add("pipeline")).ReturnsAsync("gh-token");
            Repo written = null;
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), "tenant-1")).Callback<Repo, string>((r, _) => written = r).ReturnsAsync(true);

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = "auto" });

            result.IsSuccess.Should().BeTrue(result.Message);
            result.buildId.Should().NotBeNullOrEmpty();
            result.Warning.Should().BeNull();
            order.Should().StartWith(new[] { "webhook", "pipeline" });
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.Is<RepoUpdateRequest>(q => q.RepoId == "repo-1" && q.DeploymentType == "Auto"), "tenant-1"), Times.Once);
            written.DeploymentType.Should().Be("Auto");
            written.GithubWebhook.Id.Should().Be(42);
        }

        // H1, P1: Blocks Cloud based on a Manual repository: no webhook step at all.
        [Theory]
        [InlineData(null)]
        [InlineData("manual")]
        public async Task RunBuild_ManualRepositoryStayingManual_NeverTouchesTheWebhook(string requested)
        {
            ArrangeRepo("Manual");
            ArrangePipelineStarts();

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = requested });

            result.IsSuccess.Should().BeTrue(result.Message);
            _f.Webhook.Verify(w => w.SetActiveAsync(It.IsAny<Repo>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.Webhook.Verify(w => w.CreateWebhook(It.IsAny<Repo>()), Times.Never);
        }

        // H4, P2: a healthy Git based redeploy through either endpoint makes no webhook call.
        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Redeploy_AutoWithAnActiveHook_NeverTouchesTheWebhook(bool throughRunBuild)
        {
            ArrangeRepo("Auto", new GithubWebhook { Id = 7, Active = true });
            ArrangePipelineStarts();

            var result = throughRunBuild
                ? await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1" })
                : await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "repo-1" });

            result.IsSuccess.Should().BeTrue(result.Message);
            _f.Webhook.Verify(w => w.SetActiveAsync(It.IsAny<Repo>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // C7 on a deploy: Manual chosen for an Auto repository starts the build with the warning.
        [Fact]
        public async Task ManualBuild_ManualChosenForAnAutoRepository_StartsWithAStillActiveWarning()
        {
            var repo = ArrangeRepo("Auto", new GithubWebhook { Id = 7, Active = true });
            ArrangePipelineStarts();
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, false, "tenant-1", "user-1"))
                .ReturnsAsync(WebhookOutcome.Failure(WebhookCodes.Unreachable));

            var result = await _f.BuildService().ManualBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = "manual" });

            result.IsSuccess.Should().BeTrue(result.Message);
            result.Warning.Code.Should().Be(DeploymentWarning.WebhookStillActive);
            result.Warning.Reason.Should().Be(WebhookCodes.Unreachable);
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.Is<RepoUpdateRequest>(q => q.DeploymentType == "Manual"), "tenant-1"), Times.Once);
        }

        // C14: the pipeline fails after Git based was switched on; the answer says the switch stays.
        [Fact]
        public async Task RunBuild_PipelineFailsAfterTurningAutoOn_SaysGitBasedIsNowOn()
        {
            var repo = ArrangeRepo("Manual");
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), It.IsAny<string>())).ReturnsAsync(true);
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, true, "tenant-1", "user-1"))
                .ReturnsAsync(WebhookOutcome.Success(new GithubWebhook { Id = 42, Active = true }));
            // No token for the pipeline: CreateNamespaceAsync answers "Access token not found".

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = "auto" });

            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().StartWith("Git based deployment is now on, but the deployment couldn't start: Failed to initiate pipeline.");
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.Is<RepoUpdateRequest>(q => q.DeploymentType == "Auto"), "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task RunBuild_PipelineFailsWithoutAModeChange_KeepsTodaysMessage()
        {
            ArrangeRepo("Manual");

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1" });

            result.Message.Should().StartWith("Failed to initiate pipeline.");
        }

        [Fact]
        public async Task RunBuild_AnUnexpectedFailureAfterTurningAutoOn_IsPrefixedToo()
        {
            var repo = ArrangeRepo("Manual");
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), It.IsAny<string>())).ReturnsAsync(true);
            _f.Webhook.Setup(w => w.SetActiveAsync(repo, true, "tenant-1", "user-1"))
                .ReturnsAsync(WebhookOutcome.Success(new GithubWebhook { Id = 42, Active = true }));
            ArrangePipelineStarts();
            _f.BuildRepo.Setup(b => b.SaveBuild(It.IsAny<Build>(), It.IsAny<string>())).ThrowsAsync(new InvalidOperationException("db down"));

            var result = await _f.BuildService().RunBuild(new RepoBuildRequest { RepoId = "repo-1", DeploymentType = "auto" });

            result.Message.Should().Be("Git based deployment is now on, but the deployment couldn't start: db down");
        }

        // H12, P6: a push-triggered build never runs the mode step.
        [Fact]
        public async Task Push_TriggeredBuild_MakesNoWebhookCall()
        {
            SetContext("tenant-b");
            _f.RepoRepo.Setup(r => r.GetRepoByBranch("tenant-b", It.IsAny<string>(), "main"))
                .ReturnsAsync(new Repo { ItemId = "repo-1", ProjectId = "tenant-b", RepoName = "web", Branch = "main", DeploymentType = "Auto" });
            _f.BuildRepo.Setup(b => b.SaveWebhook(It.IsAny<RepositoryWebhook>(), It.IsAny<string>())).ReturnsAsync(true);

            await _f.BuildService().HandleWebhookEventAsync("push", PushPayload, "tenant-b");

            _f.Webhook.Verify(w => w.SetActiveAsync(It.IsAny<Repo>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.Webhook.Verify(w => w.CreateWebhook(It.IsAny<Repo>()), Times.Never);
        }
}
}
