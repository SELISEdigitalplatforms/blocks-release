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
                .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "web", Branch = "main", DeploymentType = "Auto" });
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
                .Build(new BuildRequest { branch = "main" }, new Repo { ItemId = "r", RepoName = "web" });

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
}
}
