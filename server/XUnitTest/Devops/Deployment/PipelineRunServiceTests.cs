using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentAssertions;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Drives PipelineRunService through a mocked IKubernetes. The Kubernetes client
    /// helpers used by the service are extension methods, so the setups target the
    /// underlying WithHttpMessagesAsync members.
    /// </summary>
    public class PipelineRunServiceTests : IDisposable
    {
        private readonly Mock<IKubernetes> _k8s = new();
        private readonly Mock<ICustomObjectsOperations> _customObjects = new();
        private readonly Mock<ICoreV1Operations> _coreV1 = new();
        private readonly Mock<ITokenRepository> _tokenRepository = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private object _submittedPipelineRun;
        private object _submittedPatch;
        private readonly IConfiguration _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                ["ImageReference"] = "registry.example.com/",
                ["DatagatewayClusterRevision"] = "main"
            })
            .Build();

        public PipelineRunServiceTests()
        {
            _k8s.SetupGet(k => k.CustomObjects).Returns(_customObjects.Object);
            _k8s.SetupGet(k => k.CoreV1).Returns(_coreV1.Object);
        }

        private static void SetContext(string tenantId = "tenant-ctx", string userId = "user-ctx") =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        public void Dispose() => BlocksContext.ClearContext();

        private PipelineRunService Service() =>
            new(_k8s.Object, _tokenRepository.Object, _configuration, _secret.Object);

        private static HttpOperationResponse<T> Response<T>(T body) =>
            new()
            {
                Body = body,
                Request = new HttpRequestMessage(),
                Response = new HttpResponseMessage()
            };

        private void SetupGetCustomObject(object body) =>
            _customObjects
                .Setup(c => c.GetNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response(body));

        private void SetupCreateCustomObject(object body) =>
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .Callback((object submitted, string _, string _, string _, string _, string _,
                           string _, string _, bool? _,
                           IReadOnlyDictionary<string, IReadOnlyList<string>> _, CancellationToken _) =>
                    _submittedPipelineRun = submitted)
                .ReturnsAsync(Response(body));

        /// <summary>
        /// Reads the `namespace` param straight out of the PipelineRun body that was submitted to Kubernetes,
        /// so a test can assert the persisted namespace matches what Tekton was actually told.
        /// </summary>
        private string NamespaceParamOfSubmittedPipelineRun()
        {
            var spec = (_submittedPipelineRun as IDictionary<string, object>)?["spec"] as IDictionary<object, object>;
            var paramList = spec?["params"] as IList<object>;

            foreach (var item in paramList!.OfType<IDictionary<object, object>>())
            {
                if (item.TryGetValue("name", out var name) && name?.ToString() == "namespace")
                    return item["value"]?.ToString();
            }

            return null;
        }

        private void SetupPodLog(string logText) =>
            _coreV1
                .Setup(c => c.ReadNamespacedPodLogWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
                    It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
                    It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => Response<Stream>(new MemoryStream(Encoding.UTF8.GetBytes(logText))));

        private void SetupPod(params string[] containerNames)
        {
            var containers = new List<V1Container>();
            foreach (var name in containerNames)
            {
                containers.Add(new V1Container { Name = name });
            }

            _coreV1
                .Setup(c => c.ReadNamespacedPodWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response(new V1Pod { Spec = new V1PodSpec { Containers = containers } }));
        }

        private static Repo NewRepo() => new()
        {
            ItemId = "repo-1",
            ProjectId = "tenant-1",
            ProjectName = "My Project",
            RepoName = "my-repository-with-a-long-name",
            RepoUrl = "https://github.com/org/repo.git",
            Branch = "main",
            DefaultDeploymentUrl = "app.example.com",
            CustomDeploymentUrl = "custom.example.com",
            CreatedBy = "user-1"
        };

        // ---- GetPipelineRunStatusAsync ----

        [Fact]
        public async Task GetPipelineRunStatusAsync_V1Format_MapsChildReferencesAndCondition()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["childReferences"] = new List<object>
                    {
                        new Dictionary<string, object>
                        {
                            ["kind"] = "TaskRun",
                            ["name"] = "run-1-fetch-source",
                            ["pipelineTaskName"] = "fetch-source"
                        },
                        new Dictionary<string, object> { ["kind"] = "Something", ["name"] = "ignored" }
                    },
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "True", ["reason"] = "Succeeded" }
                    }
                }
            });

            var result = await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines");

            result.Should().NotBeNull();
            result.TaskRuns.Should().ContainSingle();
            result.TaskRuns[0].Name.Should().Be("run-1-fetch-source");
            result.TaskRuns[0].TaskName.Should().Be("fetch-source");
            result.Status.Should().Be("Succeeded");
            result.Reason.Should().Be("Succeeded");
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_V1FailedCondition_MapsToFailed()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["childReferences"] = new List<object>(),
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "False", ["reason"] = "PipelineRunTimeout" }
                    }
                }
            });

            var result = await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines");

            result.Status.Should().Be("Failed");
            result.Reason.Should().Be("PipelineRunTimeout");
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_V1UnknownCondition_FallsBackToReason()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["childReferences"] = new List<object>(),
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "Unknown", ["reason"] = "Running" }
                    }
                }
            });

            (await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines")).Status.Should().Be("Running");
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_V1BetaFormat_MapsTaskRunsDictionary()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["taskRuns"] = new Dictionary<string, object>
                    {
                        ["run-1-build-push"] = new Dictionary<string, object>
                        {
                            ["pipelineTaskName"] = "build-push",
                            ["status"] = "Running"
                        },
                        ["run-1-orphan"] = new Dictionary<string, object>()
                    }
                }
            });

            var result = await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines");

            result.TaskRuns.Should().HaveCount(2);
            result.TaskRuns[0].TaskName.Should().Be("build-push");
            result.TaskRuns[1].TaskName.Should().Be("unknown");
            result.TaskRuns[1].Status.Should().Be("unknown");
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_NoStatusField_ReturnsNull()
        {
            SetupGetCustomObject(new Dictionary<string, object> { ["metadata"] = new Dictionary<string, object>() });

            (await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines")).Should().BeNull();
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_StatusWithoutTaskRunsOrChildReferences_ReturnsEmptyTaskRuns()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object> { ["startTime"] = "2026-01-01T00:00:00Z" }
            });

            var result = await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines");

            result.Should().NotBeNull();
            result.TaskRuns.Should().BeEmpty();
        }

        [Fact]
        public async Task GetPipelineRunStatusAsync_ApiThrows_ReturnsNull()
        {
            _customObjects
                .Setup(c => c.GetNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("cluster unreachable"));

            // The service backs off for five seconds before giving up on the error path.
            (await Service().GetPipelineRunStatusAsync("run-1", "tekton-pipelines")).Should().BeNull();
        }

        // ---- GetTaskRunLogsAsync ----

        [Fact]
        public async Task GetTaskRunLogsAsync_ReadsEveryContainerLogAndKeepsTimestamps()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["podName"] = "pod-1",
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "True", ["reason"] = "Succeeded" }
                    }
                }
            });
            SetupPod("step-clone", "step-build");
            SetupPodLog("2026-01-01T00:00:00.123456789Z cloned repository\n");

            var logs = await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines");

            logs.TaskRunName.Should().Be("tr-1");
            logs.PodName.Should().Be("pod-1");
            logs.Status.Should().Be("Succeeded");
            logs.Steps.Should().HaveCount(2);
            logs.Steps["step-clone"].Should().Contain("cloned repository");
            logs.Steps["step-clone"].Should().Contain("2026-01-01T00:00:00.123456789Z");
        }

        [Fact]
        public async Task GetTaskRunLogsAsync_FailedCondition_MapsStatusToFailed()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["podName"] = "pod-1",
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "False", ["reason"] = "Failed" }
                    }
                }
            });
            SetupPod("step-clone");
            SetupPodLog("boom\n");

            (await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines")).Status.Should().Be("Failed");
        }

        [Fact]
        public async Task GetTaskRunLogsAsync_PendingCondition_FallsBackToReason()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["podName"] = "pod-1",
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "Unknown", ["reason"] = "Pending" }
                    }
                }
            });
            SetupPod();

            var logs = await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines");

            logs.Status.Should().Be("Pending");
            logs.Steps.Should().BeEmpty();
        }

        [Fact]
        public async Task GetTaskRunLogsAsync_NoPodName_SkipsLogRetrieval()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object> { ["startTime"] = "2026-01-01T00:00:00Z" }
            });

            var logs = await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines");

            logs.Status.Should().Be("Unknown");
            logs.Steps.Should().BeEmpty();
            _coreV1.Verify(c => c.ReadNamespacedPodWithHttpMessagesAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetTaskRunLogsAsync_ContainerLogFails_RecordsErrorForThatContainer()
        {
            SetupGetCustomObject(new Dictionary<string, object>
            {
                ["status"] = new Dictionary<string, object>
                {
                    ["podName"] = "pod-1",
                    ["conditions"] = new List<object>
                    {
                        new Dictionary<string, object> { ["status"] = "True" }
                    }
                }
            });
            SetupPod("step-clone");
            _coreV1
                .Setup(c => c.ReadNamespacedPodLogWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
                    It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
                    It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("log stream closed"));

            var logs = await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines");

            logs.Steps["step-clone"].Should().Contain("Error retrieving logs");
        }

        [Fact]
        public async Task GetTaskRunLogsAsync_ApiThrows_ReturnsEmptyTaskLogs()
        {
            _customObjects
                .Setup(c => c.GetNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("cluster unreachable"));

            var logs = await Service().GetTaskRunLogsAsync("tr-1", "tekton-pipelines");

            logs.Should().NotBeNull();
            logs.TaskRunName.Should().BeNull();
            logs.Steps.Should().BeEmpty();
        }

        // ---- DeletePipelineRunAsync ----

        [Fact]
        public async Task DeletePipelineRunAsync_CallsKubernetesDelete()
        {
            _customObjects
                .Setup(c => c.DeleteNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<V1DeleteOptions>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response<object>(new object()));

            await Service().DeletePipelineRunAsync("run-1");

            _customObjects.Verify(c => c.DeleteNamespacedCustomObjectWithHttpMessagesAsync(
                "tekton.dev", "v1beta1", "tekton-pipelines", "pipelineruns", "run-1",
                It.IsAny<V1DeleteOptions>(), It.IsAny<int?>(), It.IsAny<bool?>(),
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeletePipelineRunAsync_ApiThrows_IsSwallowed()
        {
            _customObjects
                .Setup(c => c.DeleteNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<V1DeleteOptions>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("not found"));

            var act = async () => await Service().DeletePipelineRunAsync("run-1");

            await act.Should().NotThrowAsync();
        }

        // ---- DeleteNamespaceAsync ----

        private static HttpOperationException K8sError(HttpStatusCode statusCode) =>
            new("kubernetes rejected the request")
            {
                Response = new HttpResponseMessageWrapper(new HttpResponseMessage(statusCode), string.Empty)
            };

        private void SetupDeleteNamespace(V1Status body) =>
            _coreV1
                .Setup(c => c.DeleteNamespaceWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                    It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Response(body));

        private void SetupDeleteNamespaceThrows(Exception exception) =>
            _coreV1
                .Setup(c => c.DeleteNamespaceWithHttpMessagesAsync(
                    It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                    It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                    It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);

        private void VerifyNoNamespaceDeleted() =>
            _coreV1.Verify(c => c.DeleteNamespaceWithHttpMessagesAsync(
                It.IsAny<string>(), It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);

        [Fact]
        public async Task DeleteNamespaceAsync_Success_DeletesTheNamespace()
        {
            SetupDeleteNamespace(new V1Status { Status = "Success" });

            var (success, alreadyGone, error) = await Service().DeleteNamespaceAsync("acme-dev-web");

            success.Should().BeTrue();
            alreadyGone.Should().BeFalse();
            error.Should().BeNull();
            _coreV1.Verify(c => c.DeleteNamespaceWithHttpMessagesAsync(
                "acme-dev-web", It.IsAny<V1DeleteOptions>(), It.IsAny<string>(),
                It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
                It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeleteNamespaceAsync_AlreadyGone_IsTreatedAsSuccess()
        {
            SetupDeleteNamespaceThrows(K8sError(HttpStatusCode.NotFound));

            var (success, alreadyGone, error) = await Service().DeleteNamespaceAsync("acme-dev-web");

            success.Should().BeTrue();
            alreadyGone.Should().BeTrue();
            error.Should().BeNull();
        }

        [Theory]
        [InlineData("tekton-pipelines")]
        [InlineData("TEKTON-PIPELINES")]
        [InlineData("  tekton-pipelines  ")]
        [InlineData("default")]
        [InlineData("kube-system")]
        [InlineData("kube-public")]
        [InlineData("kube-node-lease")]
        public async Task DeleteNamespaceAsync_ProtectedNamespace_IsRefusedWithoutCallingKubernetes(string namespaceName)
        {
            SetupDeleteNamespace(new V1Status { Status = "Success" });

            var (success, alreadyGone, error) = await Service().DeleteNamespaceAsync(namespaceName);

            success.Should().BeFalse();
            alreadyGone.Should().BeFalse();
            error.Should().Contain("Refusing to delete protected namespace");
            VerifyNoNamespaceDeleted();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task DeleteNamespaceAsync_MissingNamespace_IsRefusedWithoutCallingKubernetes(string namespaceName)
        {
            SetupDeleteNamespace(new V1Status { Status = "Success" });

            var (success, _, error) = await Service().DeleteNamespaceAsync(namespaceName);

            success.Should().BeFalse();
            error.Should().Be("Namespace is required.");
            VerifyNoNamespaceDeleted();
        }

        [Fact]
        public async Task DeleteNamespaceAsync_Forbidden_SurfacesTheReason()
        {
            SetupDeleteNamespaceThrows(K8sError(HttpStatusCode.Forbidden));

            var (success, alreadyGone, error) = await Service().DeleteNamespaceAsync("acme-dev-web");

            success.Should().BeFalse();
            alreadyGone.Should().BeFalse();
            error.Should().Contain("403");
        }

        [Fact]
        public async Task DeleteNamespaceAsync_NetworkFailure_SurfacesTheReason()
        {
            SetupDeleteNamespaceThrows(new HttpRequestException("cluster unreachable"));

            var (success, _, error) = await Service().DeleteNamespaceAsync("acme-dev-web");

            success.Should().BeFalse();
            error.Should().Contain("cluster unreachable");
        }

        // ---- CancelPipelineRunAsync ----

        private void SetupPatchCustomObject(object body) =>
            _customObjects
                .Setup(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .Callback((object patch, string _, string _, string _, string _, string _,
                           string _, string _, string _, bool? _,
                           IReadOnlyDictionary<string, IReadOnlyList<string>> _, CancellationToken _) =>
                    _submittedPatch = patch)
                .ReturnsAsync(Response(body));

        private void SetupPatchCustomObjectThrows(Exception exception) =>
            _customObjects
                .Setup(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);

        [Fact]
        public async Task CancelPipelineRunAsync_PatchesSpecStatusToCancelled()
        {
            SetupPatchCustomObject(new Dictionary<string, object> { ["metadata"] = "patched" });

            var (success, alreadyGone, error) = await Service().CancelPipelineRunAsync("run-1");

            success.Should().BeTrue();
            alreadyGone.Should().BeFalse();
            error.Should().BeNull();

            // Cancelling is a patch of spec.status - never a delete, which would lose the record
            // and can orphan the pods the run started.
            var spec = (_submittedPatch as IDictionary<string, object>)?["spec"] as IDictionary<string, object>;
            spec?["status"].Should().Be("Cancelled");

            _customObjects.Verify(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), "tekton.dev", "v1beta1", "tekton-pipelines", "pipelineruns", "run-1",
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CancelPipelineRunAsync_AlreadyGone_IsTreatedAsFinished()
        {
            SetupPatchCustomObjectThrows(K8sError(HttpStatusCode.NotFound));

            var (success, alreadyGone, error) = await Service().CancelPipelineRunAsync("run-1");

            success.Should().BeTrue();
            alreadyGone.Should().BeTrue();
            error.Should().BeNull();
        }

        [Fact]
        public async Task CancelPipelineRunAsync_Rejected_ReportsFailure()
        {
            SetupPatchCustomObjectThrows(K8sError(HttpStatusCode.Forbidden));

            var (success, _, error) = await Service().CancelPipelineRunAsync("run-1");

            success.Should().BeFalse();
            error.Should().Contain("403");
        }

        [Fact]
        public async Task CancelPipelineRunAsync_MissingName_IsRefusedWithoutCallingKubernetes()
        {
            var (success, _, error) = await Service().CancelPipelineRunAsync("  ");

            success.Should().BeFalse();
            error.Should().Be("PipelineRun name is required.");
            _customObjects.Verify(c => c.PatchNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---- CreateNamespaceAsync ----

        [Fact]
        public async Task CreateNamespaceAsync_NullRepo_ReturnsNotFoundMessage()
        {
            var (name, image, _, error) = await Service().CreateNamespaceAsync(null);

            name.Should().BeNull();
            image.Should().BeNull();
            error.Should().Be("Repository not found.");
        }

        [Fact]
        public async Task CreateNamespaceAsync_NoAmbientContext_ReturnsErrorMessage()
        {
            BlocksContext.ClearContext();
            _tokenRepository.Setup(t => t.getToken(It.IsAny<string>())).ReturnsAsync("gh-token");

            // Pins current behaviour: without an ambient context the tenant lookup throws and
            // the exception message is surfaced instead of a pipeline run name.
            var (name, image, _, error) = await Service().CreateNamespaceAsync(NewRepo());

            name.Should().BeNull();
            image.Should().BeNull();
            error.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task CreateNamespaceAsync_NoAccessToken_ReturnsAuthorizeAgainMessage()
        {
            SetContext();
            _tokenRepository.Setup(t => t.getToken(It.IsAny<string>())).ReturnsAsync(string.Empty);

            var (name, image, _, error) = await Service().CreateNamespaceAsync(NewRepo());

            name.Should().BeNull();
            image.Should().BeNull();
            error.Should().Be("Access token not found. Please authorize again.");
        }

        [Fact]
        public async Task CreateNamespaceAsync_Success_ReturnsPipelineRunNameAndImage()
        {
            SetContext(userId: "user-1");
            _tokenRepository.Setup(t => t.getToken("user-1")).ReturnsAsync("gh-token");
            SetupCreateCustomObject(new Dictionary<string, object> { ["metadata"] = "created" });

            var (name, image, deployedNamespace, error) = await Service().CreateNamespaceAsync(NewRepo());

            error.Should().BeNull();
            // The returned namespace must be the exact value handed to Tekton as the `namespace` param -
            // the delete path relies on it never being recomputed.
            deployedNamespace.Should().Be(NamespaceParamOfSubmittedPipelineRun());
            // The repository name is sanitized and truncated to twenty characters.
            name.Should().StartWith("my-repository-with-a-");
            image.Should().StartWith("registry.example.com/my-project/my-repository-with-a-long-name:");
            _customObjects.Verify(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), "tekton.dev", "v1beta1", "tekton-pipelines", "pipelineruns",
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CreateNamespaceAsync_SubmitFails_ReturnsAllNulls()
        {
            SetContext(userId: "user-1");
            _tokenRepository.Setup(t => t.getToken("user-1")).ReturnsAsync("gh-token");
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("rejected"));

            var (name, image, _, error) = await Service().CreateNamespaceAsync(NewRepo());

            name.Should().BeNull();
            image.Should().BeNull();
            error.Should().BeNull();
        }

        [Fact]
        public async Task CreateNamespaceAsync_UsesAmbientUserOverRepoCreator()
        {
            SetContext();
            _tokenRepository.Setup(t => t.getToken("user-ctx")).ReturnsAsync("gh-token");
            SetupCreateCustomObject(new Dictionary<string, object> { ["metadata"] = "created" });

            var (_, _, _, error) = await Service().CreateNamespaceAsync(NewRepo());

            error.Should().BeNull();
            // The repo was created by user-1, but the ambient context wins.
            _tokenRepository.Verify(t => t.getToken("user-ctx"), Times.Once);
            _tokenRepository.Verify(t => t.getToken("user-1"), Times.Never);
        }

        [Fact]
        public async Task CreateNamespaceAsync_RepoWithoutName_ReturnsErrorMessage()
        {
            SetContext();
            _tokenRepository.Setup(t => t.getToken(It.IsAny<string>())).ReturnsAsync("gh-token");
            var repo = NewRepo();
            repo.RepoName = null;

            var (name, image, _, error) = await Service().CreateNamespaceAsync(repo);

            name.Should().BeNull();
            image.Should().BeNull();
            error.Should().NotBeNullOrEmpty();
        }

        // ---- CreateDataGetwayInstance ----

        [Fact]
        public async Task CreateDataGetwayInstance_Success_ReturnsMetadataName()
        {
            _secret.SetupGet(s => s.SeliseGithubPat).Returns("pat@");
            SetupCreateCustomObject(new Dictionary<string, object> { ["metadata"] = "created" });

            var result = await Service().CreateDataGetwayInstance("v1", "project-key", "cluster-a", "proj", "tenant-1");

            result.Should().NotBeNull();
            result.Should().StartWith("uds-config-run-project-key-v1-");
            result.Length.Should().BeLessThanOrEqualTo(63);
        }

        [Fact]
        public async Task CreateDataGetwayInstance_SubmitFails_ReturnsNull()
        {
            _secret.SetupGet(s => s.SeliseGithubPat).Returns("pat@");
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("rejected"));

            (await Service().CreateDataGetwayInstance("v1", "project-key", "cluster-a", "proj", "tenant-1"))
                .Should().BeNull();
        }

        [Fact]
        public async Task CreateDataGetwayInstance_NoGithubPat_ReturnsNull()
        {
            _secret.SetupGet(s => s.SeliseGithubPat).Returns((string)null);

            // The builder dereferences the access token while rewriting the repo url.
            (await Service().CreateDataGetwayInstance("v1", "project-key", "cluster-a", "proj", "tenant-1"))
                .Should().BeNull();
        }
    }
}
