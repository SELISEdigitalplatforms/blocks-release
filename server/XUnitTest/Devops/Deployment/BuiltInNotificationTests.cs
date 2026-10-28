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
using Blocks.Genesis.Notifications;
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
    public class BuiltInNotificationSenderTests : IDisposable
    {
        private readonly Mock<ICryptoService> _crypto = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<INotificationPublisher> _publisher = new();
        private readonly List<NotificationRequest> _published = new();
        private readonly IConfiguration _config = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string> { ["RootTenantId"] = "root", ["NotificationServiceUrl"] = "https://notify.example.com" }).Build();

        public BuiltInNotificationSenderTests()
        {
            _publisher.Setup(p => p.Publish(It.IsAny<NotificationRequest>())).Callback<NotificationRequest>(_published.Add);
        }

        public void Dispose() => BlocksContext.ClearContext();

        private NotificationService Create() =>
            new(NullLogger<NotificationService>.Instance, _crypto.Object, _tenants.Object, _config, _http.Object,
                new Mock<IDeploymentHubService>().Object, _publisher.Object);

        private static Dictionary<string, object> Payload() => NotificationService.BuildPayload("e", "T", "D", true, ("repoId", "r1"))!;

        private static void SetContext(bool impersonated, string userId = "root-user", string orgId = "org-1") =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: "t1", roles: null, userId: userId, impersonated: impersonated,
                isAuthenticated: true, requestUri: "https://test", organizationId: orgId,
                permissions: null, expireOn: DateTime.UtcNow.AddHours(1), email: "a@b.com",
                userName: "root", phoneNumber: null, displayName: "R", oauthToken: null,
                originalTenantId: "root", impersonationSessionId: null, applicationDomain: "test"));

        [Fact]
        public async Task Publishes_ConfigName_TenantOrganization_AndCleanNamedUsers()
        {
            SetContext(impersonated: false);

            var ok = await Create().SendBuiltInAsync("t1", "release-build-finished", new[] { "u1", "u1", null, " " }, Payload());

            ok.Should().BeTrue();
            var request = _published.Should().ContainSingle().Subject;
            request.Name.Should().Be("release-build-finished");
            request.TenantId.Should().Be("t1");
            request.OrganizationId.Should().Be("org-1");
            request.NamedUserIds.Should().Equal("u1");
            _http.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task ImpersonatedRootUser_IsAddedAsNamedUser_SoConsoleUsersGetIt()
        {
            SetContext(impersonated: true);

            await Create().SendBuiltInAsync("t1", "release-build-finished", new[] { "u1", "root-user" }, Payload());

            _published.Single().NamedUserIds.Should().Equal("u1", "root-user");
        }

        [Fact]
        public async Task NotImpersonated_ActingUserIsNotAdded()
        {
            SetContext(impersonated: false);

            await Create().SendBuiltInAsync("t1", "release-build-finished", new[] { "u1" }, Payload());

            _published.Single().NamedUserIds.Should().Equal("u1");
        }

        [Fact]
        public async Task NoTenantOrName_PublishesNothing()
        {
            (await Create().SendBuiltInAsync("", "c", new[] { "u" }, Payload())).Should().BeFalse();
            (await Create().SendBuiltInAsync("t1", " ", new[] { "u" }, Payload())).Should().BeFalse();
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task SafeSend_NullServiceOrThrowingService_DoesNotThrow()
        {
            var withNull = () => NotificationService.SafeSendAsync(null, NullLogger.Instance, "t1", "c", new[] { "u" }, Payload());
            await withNull.Should().NotThrowAsync();
            var svc = new Mock<INotificationService>();
            svc.Setup(s => s.SendBuiltInAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>())).ThrowsAsync(new Exception("x"));
            var withThrowing = () => NotificationService.SafeSendAsync(svc.Object, NullLogger.Instance, "t1", "c", new[] { "u" }, Payload());
            await withThrowing.Should().NotThrowAsync();
            svc.Verify(s => s.SendBuiltInAsync("t1", "c", It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Once);
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

        // ---- 35 repo secret ----

        [Fact]
        public async Task RepoSecretChange_RunsTheChange_AndAFailureIsNotSwallowed()
        {
            var secrets = new Mock<ISecretService>();
            secrets.Setup(s => s.LockAsync("s1", It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("vault"));
            _f.RepoRepo.Setup(r => r.GetRepo("r1", Tenant)).ReturnsAsync(new Repo { ItemId = "r1", SecretStoreItemId = "s1" });
            var service = new RepoSecretService(_f.RepoRepo.Object, secrets.Object, NullLogger<RepoSecretService>.Instance);

            await service.UnlockAsync("r1");
            secrets.Verify(s => s.UnlockAsync("s1", It.IsAny<CancellationToken>()), Times.Once);

            var act = () => service.LockAsync("r1");
            await act.Should().ThrowAsync<InvalidOperationException>();
            _sent.Should().BeEmpty();
        }
    }
}
