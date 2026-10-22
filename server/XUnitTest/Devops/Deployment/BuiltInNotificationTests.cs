using Blocks.Genesis.Entities.Release;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Models;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using FluentValidation.Results;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class BuiltInNotificationSenderTests
    {
        private readonly Mock<ICryptoService> _crypto = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly IConfiguration _config = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string> { ["RootTenantId"] = "root", ["NotificationServiceUrl"] = "https://notify.example.com" }).Build();

        public BuiltInNotificationSenderTests()
        {
            _crypto.Setup(c => c.Hash(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>())).Returns("hashed-secret");
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(new Tenant { TenantId = "t1", TenantSalt = "salt", DbConnectionString = "x", JwtTokenParameters = null! });
        }

        private NotificationService Create() =>
            new(NullLogger<NotificationService>.Instance, _crypto.Object, _tenants.Object, _config, _http.Object, new Mock<IDeploymentHubService>().Object);

        private static Dictionary<string, object> Payload() => NotificationService.BuildPayload("e", "T", "D", true, ("repoId", "r1"))!;

        [Fact]
        public async Task SendsConfigNameRecipientsAndTenantHeaders()
        {
            object body = null; Dictionary<string, string> sentHeaders = null;
            _http.Setup(h => h.MakeHttpPostRequest<NotificationResponse>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<object, string, Dictionary<string, string>, string, string>((b, _, h, _, _) => { body = b; sentHeaders = h; })
                .ReturnsAsync((new NotificationResponse { isSuccess = true }, "ok"));

            var ok = await Create().SendBuiltInAsync("t1", "release-build-finished", new[] { "u1", "u1", null, " " }, Payload());

            ok.Should().BeTrue();
            sentHeaders["x-blocks-key"].Should().Be("t1");
            sentHeaders["Secret"].Should().Be("hashed-secret");
            var json = JsonSerializer.Serialize(body);
            json.Should().Contain("release-build-finished").And.Contain("\"u1\"");
            json.Should().NotContain("hashed-secret").And.NotContain("salt");
            ((IEnumerable<string>)body.GetType().GetProperty("UserIds")!.GetValue(body)!).Should().Equal("u1");
        }

        [Fact]
        public async Task NoRecipient_SendsNothing()
        {
            (await Create().SendBuiltInAsync("t1", "c", new string[] { null }, Payload())).Should().BeFalse();
            _http.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task UnknownTenant_SendsNothing()
        {
            (await Create().SendBuiltInAsync("nope", "c", new[] { "u" }, Payload())).Should().BeFalse();
            _http.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task HttpFailure_IsSwallowed()
        {
            _http.Setup(h => h.MakeHttpPostRequest<NotificationResponse>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new InvalidOperationException("boom"));
            (await Create().SendBuiltInAsync("t1", "c", new[] { "u" }, Payload())).Should().BeFalse();
        }

        [Fact]
        public async Task NullResponse_IsSwallowed()
        {
            _http.Setup(h => h.MakeHttpPostRequest<NotificationResponse>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(((NotificationResponse)null, "Operation Failed."));
            (await Create().SendBuiltInAsync("t1", "c", new[] { "u" }, Payload())).Should().BeFalse();
        }

        [Fact]
        public async Task Timeout_ReturnsFalseWithinAboutFiveSeconds()
        {
            var never = new TaskCompletionSource<(NotificationResponse, string)>();
            _http.Setup(h => h.MakeHttpPostRequest<NotificationResponse>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(never.Task);
            var watch = System.Diagnostics.Stopwatch.StartNew();
            (await Create().SendBuiltInAsync("t1", "c", new[] { "u" }, Payload())).Should().BeFalse();
            watch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(8));
        }

        [Fact]
        public async Task SafeSend_NullServiceOrThrowingService_DoesNotThrow()
        {
            await NotificationService.SafeSendAsync(null, NullLogger.Instance, "t1", "c", new[] { "u" }, Payload());
            var svc = new Mock<INotificationService>();
            svc.Setup(s => s.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>())).ThrowsAsync(new Exception("x"));
            await NotificationService.SafeSendAsync(svc.Object, NullLogger.Instance, "t1", "c", new[] { "u" }, Payload());
        }

        [Fact]
        public async Task ResolveRecipients_LookupFailure_KeepsExtraIds()
        {
            var repo = new Mock<IRepoRepository>();
            repo.Setup(r => r.GetProjectPeopleList("t1")).ThrowsAsync(new Exception("db"));
            (await NotificationService.ResolveRecipientsAsync(repo.Object, NullLogger.Instance, "t1", "me")).Should().Equal("me");
        }

        [Fact]
        public void Payload_HasCommonFieldsOnly()
        {
            var p = NotificationService.BuildPayload("e", "T", "D", false, ("repoId", "r1"));
            p.Keys.Should().BeEquivalentTo("event", "title", "description", "occurredAt", "isSuccess", "repoId");
        }
    }

    public class BuiltInNotificationActionTests : IDisposable
    {
        private const string Tenant = "tenant-b";
        private readonly DeploymentServiceFactory _f = new();
        private readonly List<(string Tenant, string Config, List<string> Users, IDictionary<string, object> Payload)> _sent = new();

        public BuiltInNotificationActionTests()
        {
            BlocksContext.SetContext(BlocksContext.Create(Tenant, new[] { "role" }, "actor", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo", "phone", "display", "oauth", Tenant));
            _f.Notification.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .Callback<string, string, IEnumerable<string>, IDictionary<string, object>>((t, c, u, p) => _sent.Add((t, c, u.ToList(), p)))
                .ReturnsAsync(true);
            _f.RepoRepo.Setup(r => r.GetProjectPeopleList(It.IsAny<string>())).ReturnsAsync(new List<string> { "p1", "actor" });
        }

        public void Dispose() => BlocksContext.ClearContext();

        private void NotifierThrows() =>
            _f.Notification.Setup(n => n.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()))
                .ThrowsAsync(new Exception("notifier down"));

        private static void NoSecretIn(IDictionary<string, object> p) =>
            JsonSerializer.Serialize(p).ToLowerInvariant().Should().NotContain("token").And.NotContain("password").And.NotContain("secret\":");

        // ---- 10 build finished ----

        private void GivenBuild(Build build)
        {
            _f.BuildRepo.Setup(b => b.GetBuildByPipelineRunName("run-1", Tenant)).ReturnsAsync(build);
            _f.RepoRepo.Setup(r => r.GetRepo(build.RepoId, Tenant)).ReturnsAsync(new Repo { ItemId = build.RepoId });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), Tenant)).ReturnsAsync(true);
        }

        [Theory]
        [InlineData("Succeeded", true)]
        [InlineData("Failed", false)]
        public async Task BuildFinished_SendsToStarterAndProjectPeople(string status, bool success)
        {
            GivenBuild(new Build { ItemId = "b1", RepoId = "r1", CreatedBy = "starter", Events = new() });
            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", Tenant, new PipelineRunStatus { Status = status });

            var s = _sent.Single();
            s.Config.Should().Be("release-build-finished");
            s.Tenant.Should().Be(Tenant);
            s.Users.Should().BeEquivalentTo("p1", "actor", "starter");
            s.Payload["isSuccess"].Should().Be(success);
            s.Payload["buildId"].Should().Be("b1");
            NoSecretIn(s.Payload);
        }

        [Fact]
        public async Task BuildFinished_NotifierFailure_DoesNotFailTheUpdate()
        {
            GivenBuild(new Build { ItemId = "b1", RepoId = "r1", CreatedBy = "starter", Events = new() });
            NotifierThrows();
            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", Tenant, new PipelineRunStatus { Status = "Succeeded" });
            _f.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>(), Tenant), Times.Once);
        }

        [Fact]
        public async Task BuildFinished_WriteFails_SendsNothing()
        {
            GivenBuild(new Build { ItemId = "b1", RepoId = "r1", CreatedBy = "starter", Events = new() });
            _f.BuildRepo.Setup(b => b.UpdateBuildEvents("run-1", It.IsAny<List<BuildEventResponse>>(), It.IsAny<string>(), It.IsAny<string>(), Tenant))
                .ThrowsAsync(new Exception("db"));
            await _f.LogRetrievalService().UpdateDeploymentStatus("run-1", Tenant, new PipelineRunStatus { Status = "Succeeded" });
            _sent.Should().BeEmpty();
        }

        // ---- 11 monitoring timed out ----

        [Fact]
        public async Task MonitoringTimedOut_SendsToStarterOnly()
        {
            await _f.LogRetrievalService().NotifyMonitoringTimedOutAsync(new Build { ItemId = "b1", RepoId = "r1", CreatedBy = "starter", ProjectId = Tenant });
            var s = _sent.Single();
            s.Config.Should().Be("release-build-monitoring-timed-out");
            s.Users.Should().Equal("starter");
            s.Tenant.Should().Be(Tenant);
            s.Payload["isSuccess"].Should().Be(false);
        }

        [Fact]
        public async Task MonitoringTimedOut_NotifierFailure_Swallowed()
        {
            NotifierThrows();
            await _f.LogRetrievalService().NotifyMonitoringTimedOutAsync(new Build { ItemId = "b1", CreatedBy = "starter", ProjectId = Tenant });
        }

        // ---- 12 auto deploy ----

        private const string Push = "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"org/r\"},\"pusher\":{\"name\":\"p\"}}";

        [Fact]
        public async Task AutoDeploy_CouldNotStart_SendsFailureToProjectPeople()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(Tenant, "org/r", "main"))
                .ReturnsAsync(new Repo { ItemId = "r1", RepoName = "org/r", DeploymentType = RepoDeploymentType.Auto, ProjectId = Tenant, CreatedBy = "owner" });
            var result = await _f.BuildService().HandleWebhookEventAsync("push", Push, Tenant);

            result.IsSuccess.Should().BeFalse();
            var s = _sent.Single();
            s.Config.Should().Be("release-auto-deploy-status");
            s.Users.Should().BeEquivalentTo("p1", "actor", "owner");
            s.Payload["isSuccess"].Should().Be(false);
            JsonSerializer.Serialize(s.Payload).Should().NotContain("p@");
        }

        [Fact]
        public async Task AutoDeploy_NotifierFailure_DoesNotChangeTheResult()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(Tenant, "org/r", "main"))
                .ReturnsAsync(new Repo { ItemId = "r1", RepoName = "org/r", DeploymentType = RepoDeploymentType.Auto, ProjectId = Tenant });
            NotifierThrows();
            var result = await _f.BuildService().HandleWebhookEventAsync("push", Push, Tenant);
            result.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task AutoDeploy_ManualRepo_SendsNothing()
        {
            _f.RepoRepo.Setup(r => r.GetRepoByBranch(Tenant, "org/r", "main")).ReturnsAsync(new Repo { DeploymentType = "Manual" });
            await _f.BuildService().HandleWebhookEventAsync("push", Push, Tenant);
            _sent.Should().BeEmpty();
        }

        // ---- 32 deployment deleted ----

        [Fact]
        public async Task DeploymentDeleted_FailureBeforeWrite_SendsNothing()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("r1", Tenant)).ReturnsAsync(new Repo { ItemId = "r1", DeployedNamespace = "kube-system" });
            var result = await _f.BuildService().DeleteDeployment("r1");
            result.IsSuccess.Should().BeFalse();
            _sent.Should().BeEmpty();
        }

        // ---- 45 custom domain ----

        [Fact]
        public async Task CustomDomain_WriteNotAcknowledged_SendsToRequester()
        {
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>())).ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });

            await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest { ProjectEnv = "prod", repoWithDomains = new List<RepoWithDomain>() });

            var s = _sent.Single();
            s.Config.Should().Be("release-custom-domain-failed");
            s.Users.Should().Equal("actor");
            s.Tenant.Should().Be(Tenant);
        }

        [Fact]
        public async Task CustomDomain_Success_SendsNothing()
        {
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>())).ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });
            await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest { ProjectEnv = "prod", repoWithDomains = new List<RepoWithDomain>() });
            _sent.Should().BeEmpty();
        }

        [Fact]
        public async Task CustomDomain_NotifierFailure_DoesNotChangeTheResult()
        {
            NotifierThrows();
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>())).ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>())).ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });
            var result = await _f.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest { ProjectEnv = "prod", repoWithDomains = new List<RepoWithDomain>() });
            result.Message.Should().Be("Something went wrong.");
        }

        // ---- 33 data gateway ----

        [Theory]
        [InlineData("Succeeded", true)]
        [InlineData("Failed", false)]
        public async Task DataGateway_Finished_SendsToProjectPeople(string status, bool success)
        {
            await _f.LogRetrievalService().NotifyDataGatewayFinishedAsync(Tenant, "run-1", status);
            var s = _sent.Single();
            s.Config.Should().Be("release-data-gateway-instance-finished");
            s.Users.Should().BeEquivalentTo("p1", "actor");
            s.Payload["isSuccess"].Should().Be(success);
        }

        [Fact]
        public async Task DataGateway_NotifierFailure_Swallowed()
        {
            NotifierThrows();
            await _f.LogRetrievalService().NotifyDataGatewayFinishedAsync(Tenant, "run-1", "Failed");
        }

        // ---- 46 code analysis ----

        [Fact]
        public async Task CodeAnalysis_LookupFails_SendsFailureToStarter()
        {
            _f.Http.Setup(h => h.MakeHttpRequest<global::Devops.DomainService.TestingTools.Models.ScaLookupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("down"));
            var uuid = await _f.ScaAnalyticsService().RetrieveScaProjectUuid(new Build { ItemId = "b1", RepoId = "r1", RepoName = "org/r", Branch = "main", CreatedBy = "starter", ProjectId = Tenant });
            uuid.Should().BeNull();
            var s = _sent.Single();
            s.Config.Should().Be("release-code-analysis-finished");
            s.Users.Should().Equal("starter");
            s.Payload["isSuccess"].Should().Be(false);
        }

        // ---- 32b teardown failed ----

        [Fact]
        public async Task Teardown_ProjectFailure_SendsOncePerProjectWithoutFailureText()
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync("p-1")).ReturnsAsync(new Tenant { TenantId = "p-1", TenantGroupId = "g", DbConnectionString = null!, JwtTokenParameters = null! });
            var summary = await _f.DeploymentTeardownService().TearDownAsync(new ProjectDeleteQueue { TenantGroupId = "g", ProjectId = "p-1" });

            summary.HasFailures.Should().BeTrue();
            var s = _sent.Single();
            s.Config.Should().Be("release-project-teardown-failed");
            s.Tenant.Should().Be("p-1");
            s.Users.Should().BeEquivalentTo("p1", "actor");
            JsonSerializer.Serialize(s.Payload).Should().NotContain("database placement");
        }

        [Fact]
        public async Task Teardown_NoFailure_SendsNothing()
        {
            _f.TenantLookup.Setup(t => t.GetProjectAsync("p-1")).ReturnsAsync((Tenant)null);
            await _f.DeploymentTeardownService().TearDownAsync(new ProjectDeleteQueue { TenantGroupId = "g", ProjectId = "p-1" }).ContinueWith(_ => { });
            _sent.Should().BeEmpty();
        }

        // ---- 34 github access ----

        [Fact]
        public async Task GithubWebhookNotCreated_SendsToActingUser()
        {
            var token = new Mock<ITokenRepository>();
            token.Setup(t => t.getToken("u9")).ReturnsAsync((string)null);
            var service = new GithubWebhookService(NullLogger<GithubWebhookService>.Instance, new ConfigurationBuilder().Build(),
                _f.Http.Object, token.Object, _f.RepoRepo.Object, Mock.Of<ICloudBuildSecret>(), _f.Notification.Object);

            (await service.CreateWebhook(new Repo { ItemId = "r1", RepoName = "org/r" }, Tenant, "u9")).Should().BeNull();

            var s = _sent.Single();
            s.Config.Should().Be("release-github-access-failed");
            s.Users.Should().Equal("u9");
            s.Tenant.Should().Be(Tenant);
            NoSecretIn(s.Payload);
        }

        [Fact]
        public async Task GithubAuthorizationRemoved_SendsToActingUser_AndNotifierFailureIsSwallowed()
        {
            var tokens = new Mock<ITokenRepository>();
            var vcs = new Mock<IVersionControlService>();
            var secret = new Mock<ICloudBuildSecret>();
            var tok = new RepositoryToken { AccessToken = "abc" };
            tokens.Setup(t => t.getToken()).ReturnsAsync(tok);
            tokens.Setup(t => t.DeleteTokenAsync()).ReturnsAsync(true);
            vcs.Setup(v => v.RevokeOauthAccess(tok)).ReturnsAsync(true);
            var svc = new AuthService(tokens.Object, new ConfigurationBuilder().Build(), vcs.Object, _f.Http.Object,
                NullLogger<AuthService>.Instance, secret.Object, _f.Notification.Object);

            (await svc.RevokeOauthAccess()).IsSuccess.Should().BeTrue();
            var s = _sent.Single();
            s.Config.Should().Be("release-github-access-failed");
            s.Users.Should().Equal("actor");
            JsonSerializer.Serialize(s.Payload).Should().NotContain("abc");

            NotifierThrows();
            (await svc.RevokeOauthAccess()).IsSuccess.Should().BeTrue();
        }

        // ---- 35 repo secret ----

        [Theory]
        [InlineData("lock", "locked")]
        [InlineData("unlock", "unlocked")]
        [InlineData("delete", "deleted")]
        [InlineData("restore", "restored")]
        public async Task RepoSecretChanged_SendsToOtherMembersOnly(string op, string action)
        {
            var secrets = new Mock<ISecretService>();
            _f.RepoRepo.Setup(r => r.GetRepo("r1", Tenant)).ReturnsAsync(new Repo { ItemId = "r1", SecretStoreItemId = "s1" });
            var service = new RepoSecretService(_f.RepoRepo.Object, secrets.Object, NullLogger<RepoSecretService>.Instance, _f.Notification.Object);

            switch (op)
            {
                case "lock": await service.LockAsync("r1"); break;
                case "unlock": await service.UnlockAsync("r1"); break;
                case "delete": await service.DeleteAsync("r1"); break;
                default: await service.RestoreAsync("r1"); break;
            }

            var s = _sent.Single();
            s.Config.Should().Be("release-repo-secret-changed");
            s.Users.Should().Equal("p1");
            s.Payload["action"].Should().Be(action);
            s.Tenant.Should().Be(Tenant);
            NoSecretIn(s.Payload);
        }

        [Fact]
        public async Task RepoSecretChanged_ChangeFails_SendsNothing_AndNotifierFailureIsSwallowed()
        {
            var secrets = new Mock<ISecretService>();
            secrets.Setup(s => s.LockAsync("s1", It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("vault"));
            _f.RepoRepo.Setup(r => r.GetRepo("r1", Tenant)).ReturnsAsync(new Repo { ItemId = "r1", SecretStoreItemId = "s1" });
            var service = new RepoSecretService(_f.RepoRepo.Object, secrets.Object, NullLogger<RepoSecretService>.Instance, _f.Notification.Object);

            var act = () => service.LockAsync("r1");
            await act.Should().ThrowAsync<InvalidOperationException>();
            _sent.Should().BeEmpty();

            NotifierThrows();
            await service.UnlockAsync("r1");
        }
    }
}
