using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Covers BuildService.DeleteDeployment: the guards that stand in front of the destructive call,
    /// the cancel-before-delete ordering, and what is written to the Repo document in each outcome.
    /// </summary>
    public class BuildServiceDeleteDeploymentTests : IDisposable
    {
        private const string TenantId = "tenant-b";
        private const string RepoId = "repo-1";
        private const string Namespace = "acme-dev-acme-web";

        private readonly DeploymentServiceFactory _f = new();

        public BuildServiceDeleteDeploymentTests() => SetContext();

        private static void SetContext(string tenantId = TenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        public void Dispose() => BlocksContext.ClearContext();

        private static HttpOperationResponse<T> Response<T>(T body) =>
            new()
            {
                Body = body,
                Request = new HttpRequestMessage(),
                Response = new HttpResponseMessage()
            };

        private void GivenRepo(string deployedNamespace = Namespace) =>
            _f.RepoRepo.Setup(r => r.GetRepo(RepoId, TenantId))
                .ReturnsAsync(new Repo { ItemId = RepoId, DeployedNamespace = deployedNamespace });

        private void GivenBuilds(params Build[] builds) =>
            _f.BuildRepo.Setup(b => b.GetBuilds(RepoId)).ReturnsAsync(new List<Build>(builds));

        private void GivenNamespaceDeleteSucceeds() =>
            _f.CoreV1
                .Setup(c => c.DeleteNamespaceWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                    It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response(new V1Status { Status = "Success" }));

        private void GivenNamespaceDeleteThrows(Exception exception) =>
            _f.CoreV1
                .Setup(c => c.DeleteNamespaceWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                    It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);

        private void GivenCancelSucceeds() =>
            _f.CustomObjects
                .Setup(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response<object>(new Dictionary<string, object>()));

        private void GivenCancelThrows(Exception exception) =>
            _f.CustomObjects
                .Setup(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);

        private void GivenClearSucceeds() =>
            _f.RepoRepo.Setup(r => r.ClearDeployedNamespace(RepoId, TenantId, EventStatus.DELETED))
                .ReturnsAsync(true);

        private static HttpOperationException K8sError(HttpStatusCode statusCode) =>
            new("kubernetes rejected the request")
            {
                Response = new HttpResponseMessageWrapper(new HttpResponseMessage(statusCode), string.Empty)
            };

        private void VerifyNoNamespaceDeleted() =>
            _f.CoreV1.Verify(c => c.DeleteNamespaceWithHttpMessagesAsync(
                It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);

        private void VerifyRepoNeverUpdated() =>
            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);

        // ---- guards ----

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task MissingRepoId_IsRejectedWithoutTouchingAnything(string repoId)
        {
            var result = await _f.BuildService().DeleteDeployment(repoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be("Repo id is required");
            _f.RepoRepo.Verify(r => r.GetRepo(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            VerifyNoNamespaceDeleted();
        }

        [Fact]
        public async Task RepoFromAnotherTenant_IsAnsweredNotFound()
        {
            // GetRepo resolves against the caller's tenant database, so another tenant's repo simply
            // does not resolve. 404 rather than 403 keeps the other tenant's repo undisclosed.
            _f.RepoRepo.Setup(r => r.GetRepo(RepoId, TenantId)).ReturnsAsync((Repo)null);

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.NotFound);
            result.Message.Should().Be("Repository not found.");
            VerifyNoNamespaceDeleted();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task NoRecordedNamespace_IsRejectedWithoutCallingKubernetes(string deployedNamespace)
        {
            GivenRepo(deployedNamespace);

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be("This deployment has no recorded namespace. Redeploy the repository before deleting.");
            VerifyNoNamespaceDeleted();
            VerifyRepoNeverUpdated();
        }

        [Theory]
        [InlineData("tekton-pipelines")]
        [InlineData("TEKTON-PIPELINES")]
        [InlineData("default")]
        [InlineData("kube-system")]
        [InlineData("kube-public")]
        [InlineData("kube-node-lease")]
        public async Task ProtectedNamespace_IsRefusedWithoutCallingKubernetes(string deployedNamespace)
        {
            GivenRepo(deployedNamespace);
            GivenNamespaceDeleteSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Contain("Refusing to delete protected namespace");
            VerifyNoNamespaceDeleted();
            VerifyRepoNeverUpdated();
        }

        // ---- happy path ----

        [Fact]
        public async Task NoBuildRunning_DeletesNamespaceAndClearsTheRecord()
        {
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-old", Status = EventStatus.SUCCEEDED });
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            result.Message.Should().Be("Deployment deletion started.");

            _f.CoreV1.Verify(c => c.DeleteNamespaceWithHttpMessagesAsync(
                Namespace, It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);

            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(RepoId, TenantId, EventStatus.DELETED), Times.Once);
        }

        [Fact]
        public async Task NamespaceAlreadyGone_IsReportedAsAlreadyDeleted()
        {
            GivenRepo();
            GivenBuilds();
            GivenNamespaceDeleteThrows(K8sError(HttpStatusCode.NotFound));
            GivenClearSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            result.Message.Should().Be("Deployment was already deleted.");
            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(RepoId, TenantId, EventStatus.DELETED), Times.Once);
        }

        // ---- in-flight builds ----

        [Fact]
        public async Task InFlightBuild_IsCancelledBeforeTheNamespaceIsDeleted()
        {
            GivenRepo();
            GivenBuilds(
                new Build { PipelineRunName = "run-done", Status = EventStatus.SUCCEEDED },
                new Build { PipelineRunName = "run-live", Status = EventStatus.RUNNING });
            GivenCancelSucceeds();
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            var callOrder = new List<string>();
            _f.CustomObjects
                .Setup(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .Callback(() => callOrder.Add("cancel"))
                .ReturnsAsync(Response<object>(new Dictionary<string, object>()));
            _f.CoreV1
                .Setup(c => c.DeleteNamespaceWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                    It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .Callback(() => callOrder.Add("delete"))
                .ReturnsAsync(Response(new V1Status { Status = "Success" }));

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            result.Message.Should().Be("In-progress build cancelled. Deployment deletion started.");

            // Ordering is the whole point: a namespace deleted under a running pipeline gets recreated
            // by its deploy-app step.
            callOrder.Should().Equal("cancel", "delete");

            // Only the non-terminal build is touched.
            _f.CustomObjects.Verify(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), "tekton.dev", "v1beta1", "tekton-pipelines", "pipelineruns", "run-live",
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);
            _f.BuildRepo.Verify(b => b.UpdateBuildStatus("run-live", EventStatus.CANCELLED, TenantId), Times.Once);
            _f.BuildRepo.Verify(b => b.UpdateBuildStatus("run-done", It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CancellationFails_AbortsBeforeDeletingAnything()
        {
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-live", Status = EventStatus.RUNNING });
            GivenCancelThrows(K8sError(HttpStatusCode.Forbidden));
            GivenNamespaceDeleteSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Contain("Could not cancel the in-progress build 'run-live'");
            result.Message.Should().Contain("Deployment was not deleted.");

            VerifyNoNamespaceDeleted();
            VerifyRepoNeverUpdated();
        }

        [Fact]
        public async Task PipelineRunAlreadyReaped_DoesNotBlockTheDeleteOrRelabelTheBuild()
        {
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-live", Status = EventStatus.RUNNING });
            GivenCancelThrows(K8sError(HttpStatusCode.NotFound));
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            // Nothing was actually cancelled, so the message stays the plain one.
            result.Message.Should().Be("Deployment deletion started.");
            // The run is gone and we cannot tell what it finished as, so its status is left alone
            // rather than mislabelling a success as cancelled.
            _f.BuildRepo.Verify(b => b.UpdateBuildStatus(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // ---- failures ----

        [Fact]
        public async Task KubernetesRejectsDelete_SurfacesTheReasonAndLeavesTheRecordAlone()
        {
            GivenRepo();
            GivenBuilds();
            GivenNamespaceDeleteThrows(K8sError(HttpStatusCode.Forbidden));

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().StartWith("Failed to delete deployment:");
            result.Message.Should().Contain("403");
            VerifyRepoNeverUpdated();
        }

        [Fact]
        public async Task RecordUpdateFails_IsReportedRatherThanClaimingSuccess()
        {
            GivenRepo();
            GivenBuilds();
            GivenNamespaceDeleteSucceeds();
            _f.RepoRepo.Setup(r => r.ClearDeployedNamespace(RepoId, TenantId, EventStatus.DELETED))
                .ReturnsAsync(false);

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Contain("could not be updated");
        }
    }
}
