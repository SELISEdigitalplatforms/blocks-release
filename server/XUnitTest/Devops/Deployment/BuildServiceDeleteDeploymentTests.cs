using Blocks.Genesis.Entities.Release;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Models;
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
            _f.BuildRepo.Setup(b => b.GetBuilds(RepoId, TenantId)).ReturnsAsync(new List<Build>(builds));

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

        /// <summary>Makes the PipelineRun read return a run whose first condition has the given status.</summary>
        private void GivenPipelineRunConditionStatus(string conditionStatus) =>
            _f.CustomObjects
                .Setup(c => c.GetNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response<object>(new Dictionary<string, object>
                {
                    ["status"] = new Dictionary<string, object>
                    {
                        ["conditions"] = new List<object>
                        {
                            new Dictionary<string, object> { ["type"] = "Succeeded", ["status"] = conditionStatus }
                        }
                    }
                }));

        private void GivenPipelineRunIsRunning() => GivenPipelineRunConditionStatus("Unknown");

        private void GivenPipelineRunReadThrows(Exception exception) =>
            _f.CustomObjects
                .Setup(c => c.GetNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);

        private void VerifyNothingPatched() =>
            _f.CustomObjects.Verify(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);

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
            GivenPipelineRunIsRunning();
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
            GivenPipelineRunIsRunning();
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
        public async Task PipelineRunAlreadyReaped_IsNotPatchedAtAll()
        {
            // A build record left with a stale non-terminal status looks in-flight forever. Patching it
            // would demand `patch` on pipelineruns for a run that finished long ago - and because
            // Kubernetes authorises before checking existence, a missing permission answers 403 rather
            // than the 404 that would have let the delete continue. So the run is read first.
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-stale", Status = EventStatus.RUNNING });
            GivenPipelineRunReadThrows(K8sError(HttpStatusCode.NotFound));
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            // Nothing was actually cancelled, so the message stays the plain one.
            result.Message.Should().Be("Deployment deletion started.");
            VerifyNothingPatched();
            // We cannot tell what it finished as, so its status is left alone rather than
            // mislabelling a success as cancelled.
            _f.BuildRepo.Verify(b => b.UpdateBuildStatus(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData("True")]  // succeeded
        [InlineData("False")] // failed or cancelled
        public async Task PipelineRunAlreadyFinished_IsNotPatchedAtAll(string conditionStatus)
        {
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-finished", Status = EventStatus.RUNNING });
            GivenPipelineRunConditionStatus(conditionStatus);
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            result.Message.Should().Be("Deployment deletion started.");
            VerifyNothingPatched();
        }

        [Fact]
        public async Task PipelineRunStateUnreadable_AbortsBeforeDeletingAnything()
        {
            // Deleting the namespace without knowing whether a pipeline is live risks deploy-app
            // recreating the workload behind us, so an unreadable state is as blocking as a failed cancel.
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-live", Status = EventStatus.RUNNING });
            GivenPipelineRunReadThrows(K8sError(HttpStatusCode.Forbidden));
            GivenNamespaceDeleteSucceeds();

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Contain("Could not determine whether the build 'run-live' is still running");
            result.Message.Should().Contain("Deployment was not deleted.");
            VerifyNoNamespaceDeleted();
            VerifyRepoNeverUpdated();
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

        // ---- #255 C7: a cancelled build's still-Pending SAST/SCA reports become NotRun ----

        private static Build Ended(string runName) => new() { ItemId = "build-live", ProjectId = TenantId, CreatedBy = "creator-1", RepoId = RepoId, PipelineRunName = runName };

        private void GivenInFlightBuildIsCancelled()
        {
            GivenRepo();
            GivenBuilds(
                new Build { PipelineRunName = "run-done", Status = EventStatus.SUCCEEDED },
                new Build { PipelineRunName = "run-live", Status = EventStatus.RUNNING });
            GivenPipelineRunIsRunning();
            GivenCancelSucceeds();
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();
        }

        [Fact]
        public async Task C7_CancelledBuild_EndsBothPendingReportsNotRunAndNotifiesEachOnce()
        {
            GivenInFlightBuildIsCancelled();
            _f.BuildRepo.Setup(b => b.TryEndPendingReport("run-live", It.IsAny<AnalysisReportKind>(), AnalysisReportStatus.NotRun, "The build was cancelled.", TenantId))
                .ReturnsAsync(Ended("run-live"));

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "The build was cancelled.", TenantId), Times.Once);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "The build was cancelled.", TenantId), Times.Once);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-done", It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Tenant>()), Times.Never);

            foreach (var analysisType in new[] { "SAST", "SCA" })
            {
                _f.Notification.Verify(n => n.SendBuiltInAsync(TenantId, "release-code-analysis-finished",
                    It.Is<IEnumerable<string>>(u => System.Linq.Enumerable.SequenceEqual(u, new[] { "creator-1" })),
                    It.Is<IDictionary<string, object>>(p => (string)p["analysisType"] == analysisType && (bool)p["isSuccess"] == false
                        && (string)p["description"] == "The build was cancelled." && (string)p["buildId"] == "build-live")), Times.Once);
            }
        }

        [Fact]
        public async Task C7_ReportsAlreadyEnded_AreNotNotifiedAgain()
        {
            GivenInFlightBuildIsCancelled();
            _f.BuildRepo.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Build)null);

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", It.IsAny<AnalysisReportKind>(), AnalysisReportStatus.NotRun, "The build was cancelled.", TenantId), Times.Exactly(2));
            _f.Notification.Verify(n => n.SendBuiltInAsync(It.IsAny<string>(), "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Never);
        }

        [Fact]
        public async Task C7_ThrowingReportUpdate_DoesNotStopTheDelete()
        {
            GivenInFlightBuildIsCancelled();
            _f.BuildRepo.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new TimeoutException("mongo timeout"));

            var result = await _f.BuildService().DeleteDeployment(RepoId);

            result.IsSuccess.Should().BeTrue();
            result.Message.Should().Be("In-progress build cancelled. Deployment deletion started.");
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), TenantId), Times.Exactly(2),
                "the SCA report is still tried after the SAST one failed");
            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(RepoId, TenantId, EventStatus.DELETED), Times.Once);
        }

        [Fact]
        public async Task C7_NothingCancelled_LeavesTheReportsAlone()
        {
            GivenRepo();
            GivenBuilds(new Build { PipelineRunName = "run-finished", Status = EventStatus.RUNNING });
            GivenPipelineRunConditionStatus("True");
            GivenNamespaceDeleteSucceeds();
            GivenClearSucceeds();

            await _f.BuildService().DeleteDeployment(RepoId);

            _f.BuildRepo.Verify(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task C7_ProjectTeardown_EndsThePendingReportsInTheProjectsPlacement()
        {
            var project = new Tenant
            {
                TenantId = TenantId, TenantGroupId = "group-1", Name = "proj", Environment = "dev",
                DbConnectionString = "mongodb://placement", DBName = "db-tenant-b",
                JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
            };
            var repo = new Repo { ItemId = RepoId, DeployedNamespace = Namespace };
            _f.BuildRepo.Setup(b => b.GetBuilds(RepoId, project)).ReturnsAsync(new List<Build> { new() { PipelineRunName = "run-live", Status = EventStatus.RUNNING } });
            GivenPipelineRunIsRunning();
            GivenCancelSucceeds();
            GivenNamespaceDeleteSucceeds();
            _f.RepoRepo.Setup(r => r.ClearDeployedNamespace(RepoId, project, EventStatus.DELETED)).ReturnsAsync(true);
            _f.BuildRepo.Setup(b => b.TryEndPendingReport("run-live", It.IsAny<AnalysisReportKind>(), AnalysisReportStatus.NotRun, "The build was cancelled.", project))
                .ReturnsAsync(Ended("run-live"));

            var result = await _f.BuildService().DeleteDeployment(repo, project);

            result.IsSuccess.Should().BeTrue();
            _f.BuildRepo.Verify(b => b.UpdateBuildStatus("run-live", EventStatus.CANCELLED, project), Times.Once);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "The build was cancelled.", project), Times.Once);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport("run-live", AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "The build was cancelled.", project), Times.Once);
            _f.BuildRepo.Verify(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _f.Notification.Verify(n => n.SendBuiltInAsync(TenantId, "release-code-analysis-finished", It.IsAny<IEnumerable<string>>(), It.IsAny<IDictionary<string, object>>()), Times.Exactly(2));
        }

        [Fact]
        public async Task C7_ProjectTeardown_ThrowingReportUpdate_DoesNotStopTheTeardown()
        {
            var project = new Tenant
            {
                TenantId = TenantId, TenantGroupId = "group-1", Name = "proj", Environment = "dev",
                DbConnectionString = "mongodb://placement", DBName = "db-tenant-b",
                JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
            };
            _f.BuildRepo.Setup(b => b.GetBuilds(RepoId, project)).ReturnsAsync(new List<Build> { new() { PipelineRunName = "run-live", Status = EventStatus.RUNNING } });
            GivenPipelineRunIsRunning();
            GivenCancelSucceeds();
            GivenNamespaceDeleteSucceeds();
            _f.RepoRepo.Setup(r => r.ClearDeployedNamespace(RepoId, project, EventStatus.DELETED)).ReturnsAsync(true);
            _f.BuildRepo.Setup(b => b.TryEndPendingReport(It.IsAny<string>(), It.IsAny<AnalysisReportKind>(), It.IsAny<string>(), It.IsAny<string>(), project))
                .ThrowsAsync(new InvalidOperationException("Project tenant has no database placement."));

            var result = await _f.BuildService().DeleteDeployment(new Repo { ItemId = RepoId, DeployedNamespace = Namespace }, project);

            result.IsSuccess.Should().BeTrue();
            _f.RepoRepo.Verify(r => r.ClearDeployedNamespace(RepoId, project, EventStatus.DELETED), Times.Once);
        }
    }
}
