using Blocks.Genesis.Entities.Release;
using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using XUnitTest.Devops.VersionControlSystems;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Every row of the mode-step table (spec §6.3), through the real webhook service against a GitHub stand-in,
    /// with the exact number of GitHub calls each path may make (budgets P1-P6, C11).
    /// </summary>
    public class DeploymentModeServiceTests
    {
        private const string Tenant = "tenant-9";
        private const string User = "user-7";
        private const string HookUrl = "https://hook/tenant-9";

        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ITokenRepository> _tokens = new();
        private readonly Mock<IRepoRepository> _repos = new();
        private readonly FakeGithub _github;
        private readonly List<RepoUpdateRequest> _modeSaves = new();
        private readonly List<RepoUpdateRequest> _settingsSaves = new();

        public DeploymentModeServiceTests()
        {
            _github = new FakeGithub(_http);
            _tokens.Setup(t => t.getToken(User)).ReturnsAsync("tok");
            _repos.Setup(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>())).ReturnsAsync(true);
            _repos.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>())).ReturnsAsync(true);
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), Tenant))
                .Callback<RepoUpdateRequest, string>((request, _) => _modeSaves.Add(request)).ReturnsAsync(true);
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>()))
                .Callback<RepoUpdateRequest>(request => _settingsSaves.Add(request)).ReturnsAsync(true);
        }

        private DeploymentModeService CreateService()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["GithubWebhookUrl"] = "https://hook/" })
                .Build();
            var secret = new Mock<ICloudBuildSecret>();
            secret.SetupGet(s => s.GithubWebhookSecret).Returns("whsecret");
            var webhooks = new GithubWebhookService(NullLogger<GithubWebhookService>.Instance, config, _http.Object,
                _tokens.Object, _repos.Object, secret.Object);
            return new DeploymentModeService(NullLogger<DeploymentModeService>.Instance, _repos.Object, webhooks);
        }

        private static Repo Repo(string mode, GithubWebhook hook = null) => new()
        {
            ItemId = "r1",
            RepoName = "org/app",
            ProjectId = Tenant,
            DeploymentType = mode,
            GithubWebhook = hook,
        };

        private static GithubWebhook ActiveHook(long id = 7) => new() { Id = id, Active = true };
        private static GithubWebhook InactiveHook(long id = 7) => new() { Id = id, Active = false };

        private static object Hook(long id, bool active) =>
            new { id, active, config = new { url = HookUrl, content_type = "json", insecure_ssl = "0" } };

        private static object Permissions(bool admin) => new { permissions = new { admin } };

        private Task<DeployModeStep> Deploy(Repo repo, string requested) =>
            CreateService().ApplyBeforeDeployAsync(repo, requested, Tenant, User);

        private Task<RepoSettingsUpdateResponse> Settings(Repo repo, string mode, string customDomain = "x.example.com") =>
            CreateService().SaveSettingsAsync(repo,
                new RepoUpdateRequest { RepoId = repo.ItemId, DeploymentType = mode, CustomDomain = customDomain }, Tenant, User);

        // ---- Settings ----

        // H6: Manual -> Auto with a working hook saves every field, the hook first.
        [Fact]
        public async Task Settings_ManualToAuto_TurnsTheHookOnThenSavesEveryField()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Created, Hook(42, active: true));
            var repo = Repo(RepoDeploymentType.Manual);

            var response = await Settings(repo, RepoDeploymentType.Auto);

            response.IsSuccess.Should().BeTrue();
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            response.Message.Should().Be("Repository updated successfully.");
            response.Warning.Should().BeNull();
            repo.GithubWebhook.Active.Should().BeTrue();
            _settingsSaves.Should().ContainSingle().Which.Should().BeEquivalentTo(new { DeploymentType = "Auto", CustomDomain = "x.example.com" });
            _github.Calls.Should().HaveCount(1);
        }

        // C1, example 2: refused for a non-admin; nothing is saved.
        [Fact]
        public async Task Settings_ManualToAuto_Refused_Returns400AndSavesNothing()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.NotFound, new { message = "Not Found" })
                   .On("GET /repos/org/app", HttpStatusCode.OK, Permissions(admin: false));

            var response = await Settings(Repo(RepoDeploymentType.Manual), RepoDeploymentType.Auto);

            response.IsSuccess.Should().BeFalse();
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            response.Message.Should().Be("Your GitHub account can't manage webhooks on org/app. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.");
            response.Errors.Should().Equal(new Dictionary<string, string> { ["webhook"] = WebhookCodes.Permission });
            _settingsSaves.Should().BeEmpty();
            _repos.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
            _repos.Verify(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
        }

        // Example 6: a timed-out turn-on leaves the repository as it was.
        [Fact]
        public async Task Settings_ManualToAuto_Timeout_Returns400Unreachable()
        {
            _github.NoAnswer("PATCH /repos/org/app/hooks/9");
            var repo = Repo(RepoDeploymentType.Manual, InactiveHook(9));

            var response = await Settings(repo, RepoDeploymentType.Auto);

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            response.Errors["webhook"].Should().Be(WebhookCodes.Unreachable);
            response.Message.Should().Be("GitHub didn't respond. Try again in a moment.");
            repo.GithubWebhook.Active.Should().BeFalse();
            _settingsSaves.Should().BeEmpty();
        }

        [Fact]
        public async Task Settings_ManualToAuto_FailedWithDetail_CarriesGithubsMessage()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Forbidden, new { message = "Resource protected by organization SAML enforcement." })
                   .On("GET /repos/org/app", HttpStatusCode.OK, Permissions(admin: true));

            var response = await Settings(Repo(RepoDeploymentType.Manual), RepoDeploymentType.Auto);

            response.Message.Should().Be("GitHub couldn't set up the webhook on org/app: Resource protected by organization SAML enforcement.");
            response.Errors.Should().Equal(new Dictionary<string, string>
            {
                ["webhook"] = WebhookCodes.Failed,
                ["webhookDetail"] = "Resource protected by organization SAML enforcement.",
            });
        }

        // X8: the hook was turned on but the save was refused; the write's error is the answer.
        [Fact]
        public async Task Settings_ManualToAuto_SaveFailsAfterTheHook_IsFailedToUpdate()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Created, Hook(42, active: true));
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);

            var response = await Settings(Repo(RepoDeploymentType.Manual), RepoDeploymentType.Auto);

            response.IsSuccess.Should().BeFalse();
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            response.Message.Should().Be("Failed to update.");
        }

        // H7
        [Fact]
        public async Task Settings_AutoToManual_TurnsTheHookOffAfterSaving()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.OK, Hook(7, active: false));
            var repo = Repo(RepoDeploymentType.Auto, ActiveHook());

            var response = await Settings(repo, RepoDeploymentType.Manual);

            response.IsSuccess.Should().BeTrue();
            response.Warning.Should().BeNull();
            _settingsSaves.Should().ContainSingle().Which.DeploymentType.Should().Be("Manual");
            repo.GithubWebhook.Active.Should().BeFalse();
            _repos.Verify(r => r.UpdateRepoGithubWebhookActive("r1", false), Times.Once);
            _github.Calls.Should().HaveCount(1);
        }

        // C7, example 3: Manual is saved anyway, with a warning; the hook stays active.
        [Fact]
        public async Task Settings_AutoToManual_Refused_SavesWithAStillActiveWarning()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.NotFound)
                   .On("GET /repos/org/app", HttpStatusCode.OK, Permissions(admin: false));
            var repo = Repo(RepoDeploymentType.Auto, ActiveHook());

            var response = await Settings(repo, RepoDeploymentType.Manual);

            response.IsSuccess.Should().BeTrue();
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            response.Message.Should().Be("Repository updated successfully.");
            response.Warning.Should().BeEquivalentTo(new DeploymentWarning
            {
                Code = DeploymentWarning.WebhookStillActive,
                Reason = WebhookCodes.Permission,
                Message = "Push deploys are off. The GitHub webhook on org/app is still active: Your GitHub account can't manage webhooks on org/app. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.",
                Detail = null,
            });
            _settingsSaves.Should().ContainSingle().Which.DeploymentType.Should().Be("Manual");
            repo.GithubWebhook.Active.Should().BeTrue();
            _github.WebhookCalls.Should().Be(1);
            _github.RepositoryReads.Should().Be(1);
        }

        // H14
        [Fact]
        public async Task Settings_AutoToManual_WithoutAStoredHook_MakesNoGithubCall()
        {
            var response = await Settings(Repo(RepoDeploymentType.Auto), RepoDeploymentType.Manual);

            response.IsSuccess.Should().BeTrue();
            response.Warning.Should().BeNull();
            _settingsSaves.Should().ContainSingle();
            _github.Calls.Should().BeEmpty();
        }

        // C8: Auto stays Auto without an active hook: saved, then repaired best effort.
        [Fact]
        public async Task Settings_AutoStaysAuto_WithoutAnActiveHook_SavesThenWarnsWhenTheRepairFails()
        {
            _github.NoAnswer("PATCH /repos/org/app/hooks/7");

            var response = await Settings(Repo(RepoDeploymentType.Auto, InactiveHook()), RepoDeploymentType.Auto);

            response.IsSuccess.Should().BeTrue();
            _settingsSaves.Should().ContainSingle();
            response.Warning.Code.Should().Be(DeploymentWarning.WebhookNotWorking);
            response.Warning.Reason.Should().Be(WebhookCodes.Unreachable);
            response.Warning.Message.Should().Be("Settings saved, but Git based deployment isn't working: GitHub didn't respond. Try again in a moment.");
        }

        [Fact]
        public async Task Settings_AutoStaysAuto_WithoutAnActiveHook_RepairsItQuietly()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Created, Hook(42, active: true));
            var repo = Repo(RepoDeploymentType.Auto);

            var response = await Settings(repo, mode: null);

            response.IsSuccess.Should().BeTrue();
            response.Warning.Should().BeNull();
            repo.GithubWebhook.Id.Should().Be(42);
        }

        // H8, P3: no mode change and nothing to repair: no GitHub call.
        [Theory]
        [InlineData("Manual", "Manual", false)]
        [InlineData("Manual", null, false)]
        [InlineData("Manual", "", false)]
        [InlineData("Auto", "Auto", true)]
        [InlineData("Auto", null, true)]
        public async Task Settings_WithoutAModeChange_MakesNoGithubCall(string stored, string requested, bool activeHook)
        {
            var response = await Settings(Repo(stored, activeHook ? ActiveHook() : null), requested);

            response.IsSuccess.Should().BeTrue();
            response.Warning.Should().BeNull();
            _settingsSaves.Should().ContainSingle();
            _github.Calls.Should().BeEmpty();
            _tokens.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
        }

        // C15
        [Fact]
        public async Task Settings_AWriteThatReturnsFalse_IsA400Failure()
        {
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);

            var response = await Settings(Repo(RepoDeploymentType.Manual), RepoDeploymentType.Manual);

            response.IsSuccess.Should().BeFalse();
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            response.Message.Should().Be("Failed to update.");
            _github.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task Settings_AutoToManual_AWriteThatReturnsFalse_LeavesTheHookAlone()
        {
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);

            var response = await Settings(Repo(RepoDeploymentType.Auto, ActiveHook()), RepoDeploymentType.Manual);

            response.IsSuccess.Should().BeFalse();
            _github.Calls.Should().BeEmpty();
        }

        // ---- Deploy ----

        // H1, P1: Manual stays Manual.
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("manual")]
        public async Task Deploy_ManualRepository_StayingManual_MakesNoGithubCall(string requested)
        {
            var step = await Deploy(Repo(RepoDeploymentType.Manual), requested);

            step.Should().Be(DeployModeStep.Unchanged);
            _github.Calls.Should().BeEmpty();
            _modeSaves.Should().BeEmpty();
        }

        // H4, P2: a healthy Git based repository is trusted as stored.
        [Theory]
        [InlineData(null)]
        [InlineData("auto")]
        [InlineData("AUTO")]
        public async Task Deploy_AutoRepositoryWithAnActiveHook_MakesNoGithubCall(string requested)
        {
            var step = await Deploy(Repo(RepoDeploymentType.Auto, ActiveHook()), requested);

            step.Should().Be(DeployModeStep.Unchanged);
            _github.Calls.Should().BeEmpty();
            _tokens.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
        }

        // H2, example 1: Git based chosen in the first-deploy dialog.
        [Fact]
        public async Task Deploy_ManualToAuto_CreatesTheHookThenSavesAuto()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Created, Hook(42, active: true));
            var repo = Repo(RepoDeploymentType.Manual);

            var step = await Deploy(repo, "auto");

            step.Refusal.Should().BeNull();
            step.TurnedAutoOn.Should().BeTrue();
            step.Warning.Should().BeNull();
            repo.DeploymentType.Should().Be("Auto", "the deploy writes this repository back whole later");
            repo.GithubWebhook.Id.Should().Be(42);
            _modeSaves.Should().ContainSingle().Which.Should().BeEquivalentTo(new RepoUpdateRequest { RepoId = "r1", DeploymentType = "Auto" });
            _github.Calls.Should().HaveCount(1);
        }

        // §6.3: a mode change asks GitHub even when a hook is stored as active.
        [Fact]
        public async Task Deploy_ManualToAuto_WithAHookStoredAsActive_StillAsksGithub()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.OK, Hook(7, active: true));

            var step = await Deploy(Repo(RepoDeploymentType.Manual, ActiveHook()), "auto");

            step.TurnedAutoOn.Should().BeTrue();
            _github.Calls.Should().HaveCount(1);
        }

        // H5: Auto without an active hook is repaired before the pipeline; the mode is already Auto.
        [Fact]
        public async Task Deploy_AutoWithoutAnActiveHook_TurnsItOnWithoutSavingTheMode()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.OK, Hook(7, active: true));

            var step = await Deploy(Repo(RepoDeploymentType.Auto, InactiveHook()), requested: null);

            step.Should().Be(DeployModeStep.Unchanged);
            _modeSaves.Should().BeEmpty();
            _repos.Verify(r => r.UpdateRepoGithubWebhookActive("r1", true), Times.Once);
        }

        // C2, C3, example 4: refused with the deploy hint; nothing called or saved.
        [Fact]
        public async Task Deploy_AutoWithoutAHook_NotConnected_IsRefusedWithTheDeployHint()
        {
            _tokens.Setup(t => t.getToken(User)).ReturnsAsync((string)null);

            var step = await Deploy(Repo(RepoDeploymentType.Auto), requested: null);

            step.Refusal.Should().NotBeNull();
            step.Refusal.IsSuccess.Should().BeFalse();
            step.Refusal.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            step.Refusal.Message.Should().Be("Connect your GitHub account to use Git based deployment. To deploy now, switch to Blocks Cloud based deployment in Settings.");
            step.Refusal.Errors.Should().Equal(new Dictionary<string, string> { ["webhook"] = WebhookCodes.NotConnected });
            _github.Calls.Should().BeEmpty();
            _modeSaves.Should().BeEmpty();
            _repos.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Deploy_ManualToAuto_Refused_SavesNothing()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Forbidden, new { message = "x" })
                   .On("GET /repos/org/app", HttpStatusCode.NotFound);
            var repo = Repo(RepoDeploymentType.Manual);

            var step = await Deploy(repo, "auto");

            step.Refusal.Errors["webhook"].Should().Be(WebhookCodes.RepoNotVisible);
            step.Refusal.Message.Should().Be("Your GitHub account can't access org/app. To deploy now, switch to Blocks Cloud based deployment in Settings.");
            repo.DeploymentType.Should().Be("Manual");
            _modeSaves.Should().BeEmpty();
        }

        // C7 on a deploy: Manual chosen for an Auto repository; the build goes ahead with a warning.
        [Fact]
        public async Task Deploy_AutoToManual_Refused_SavesManualAndWarns()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.Unauthorized);
            var repo = Repo(RepoDeploymentType.Auto, ActiveHook());

            var step = await Deploy(repo, "manual");

            step.Refusal.Should().BeNull();
            step.TurnedAutoOn.Should().BeFalse();
            step.Warning.Code.Should().Be(DeploymentWarning.WebhookStillActive);
            step.Warning.Reason.Should().Be(WebhookCodes.TokenInvalid);
            step.Warning.Message.Should().Be("Push deploys are off. The GitHub webhook on org/app is still active: Your GitHub connection has expired. Reconnect GitHub and try again.");
            repo.DeploymentType.Should().Be("Manual");
            _modeSaves.Should().ContainSingle().Which.DeploymentType.Should().Be("Manual");
        }

        // A5, C19, example 8: any other value is Blocks Cloud based.
        [Fact]
        public async Task Deploy_UnknownModeValue_IsManual()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.OK, Hook(7, active: false));
            var repo = Repo(RepoDeploymentType.Auto, ActiveHook());

            var step = await Deploy(repo, "git");

            step.Warning.Should().BeNull();
            repo.DeploymentType.Should().Be("Manual");
            repo.GithubWebhook.Active.Should().BeFalse();
            _modeSaves.Should().ContainSingle().Which.DeploymentType.Should().Be("Manual");
        }

        [Fact]
        public async Task Deploy_ManualToAuto_AModeSaveThatFails_RefusesTheDeploy()
        {
            _github.On("POST /repos/org/app/hooks", HttpStatusCode.Created, Hook(42, active: true));
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), Tenant)).ReturnsAsync(false);
            var repo = Repo(RepoDeploymentType.Manual);

            var step = await Deploy(repo, "auto");

            step.Refusal.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            step.Refusal.Message.Should().Be("Failed to update.");
            step.TurnedAutoOn.Should().BeFalse();
            repo.DeploymentType.Should().Be("Manual");
        }

        [Fact]
        public async Task Deploy_AutoToManual_AModeSaveThatFails_StillGoesAheadAsManual()
        {
            _github.On("PATCH /repos/org/app/hooks/7", HttpStatusCode.OK, Hook(7, active: false));
            _repos.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), Tenant)).ReturnsAsync(false);
            var repo = Repo(RepoDeploymentType.Auto, ActiveHook());

            var step = await Deploy(repo, "manual");

            step.Refusal.Should().BeNull();
            repo.DeploymentType.Should().Be("Manual", "the deploy's whole-document write stores it");
        }

        // ---- Codes and messages (§6.4) ----

        [Theory]
        [InlineData(WebhookCodes.NotConnected, "Connect your GitHub account to use Git based deployment.")]
        [InlineData(WebhookCodes.TokenInvalid, "Your GitHub connection has expired. Reconnect GitHub and try again.")]
        [InlineData(WebhookCodes.RepoNotVisible, "Your GitHub account can't access org/app.")]
        [InlineData(WebhookCodes.Permission, "Your GitHub account can't manage webhooks on org/app. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.")]
        [InlineData(WebhookCodes.Failed, "GitHub couldn't set up the webhook on org/app: boom")]
        [InlineData(WebhookCodes.Unreachable, "GitHub didn't respond. Try again in a moment.")]
        public void MessageFor_EveryCode_IsTheSpecsEnglishText(string code, string expected)
        {
            DeploymentModeService.MessageFor(code, "org/app", "boom").Should().Be(expected);
        }

        [Theory]
        [InlineData("auto", "Auto")]
        [InlineData("AUTO", "Auto")]
        [InlineData("Auto", "Auto")]
        [InlineData("manual", "Manual")]
        [InlineData("git", "Manual")]
        [InlineData(null, "Manual")]
        public void Normalize_AutoInAnyCaseIsAuto_AnythingElseManual(string value, string expected)
        {
            DeploymentModeService.Normalize(value).Should().Be(expected);
        }

        [Fact]
        public void PipelineFailedAfterTurningAutoOn_PrefixesThePipelineMessage()
        {
            DeploymentModeService.PipelineFailedAfterTurningAutoOn("Failed to initiate pipeline. x")
                .Should().Be("Git based deployment is now on, but the deployment couldn't start: Failed to initiate pipeline. x");
        }
    }
}
