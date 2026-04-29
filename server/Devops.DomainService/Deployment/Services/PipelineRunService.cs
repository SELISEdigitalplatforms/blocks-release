using System.Text;
using System.Text.Json;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.PipelinerunBuilders;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Services;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using k8s;
using k8s.Autorest;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;

namespace Devops.DomainService.Deployment.Services
{

    public class PipelineRunService
    {
        private readonly IKubernetes _k8sClient;
        private readonly ITokenRepository _tokenRepository;
        private readonly IConfiguration _configuration;
        private readonly ICloudBuildSecret _cloudBuildSecret;

        public PipelineRunService(
                                IKubernetes k8sClient,
                                ITokenRepository tokenRepository,
                                IConfiguration configuration,
                                ICloudBuildSecret cloudBuildSecret
                                )
        {
            _k8sClient = k8sClient;
            _tokenRepository = tokenRepository;
            _configuration = configuration;
            _cloudBuildSecret = cloudBuildSecret;
        }


        private async Task<object?> SubmitKubernetesAsync(
        object resourceObject,
        string group,
        string version,
        string namespaceName,
        string plural)
        {
            try
            {
                var result = await _k8sClient.CustomObjects.CreateNamespacedCustomObjectAsync(
                    resourceObject,
                    group: group,
                    version: version,
                    namespaceParameter: namespaceName,
                    plural: plural
                );

                Console.WriteLine(
                    $"Kubernetes resource created successfully [Group={group}, Version={version}, Namespace={namespaceName}, Kind={plural}]");

                return result;
            }
            catch (HttpOperationException httpEx)
            {
                var message = KubernetesApiErrorHandler.HandleKubernetesError(httpEx);
                Console.WriteLine($"Kubernetes API operation failed: {message}");
                return null;
            }
            catch (Exception ex)
            {
                var message = KubernetesApiErrorHandler.HandleGeneralError(ex);
                Console.WriteLine($"General error submitting to Kubernetes: {message}");
                return null;
            }
        }

        public async Task<(string, string, string)> CreateNamespaceAsync(Repo repo)
        {
            if (repo == null)
            {
                Console.WriteLine("Repository not found.");
                return (null, null, "Repository not found.");
            }

            try
            {
                var blocksContext = BlocksContext.GetContext();
                var tenantId = !string.IsNullOrWhiteSpace(blocksContext.TenantId)
                    ? blocksContext.TenantId
                    : repo.ProjectId;

                var blocksUserId = !string.IsNullOrWhiteSpace(blocksContext.UserId)
                    ? blocksContext.UserId
                    : repo.CreatedBy;

                var namespaceName = CloudBuildConstants.NAMESPACE_NAME;
                var yamlPath = CloudBuildConstants.YAML_PATH;
                var guid = Guid.NewGuid().ToString();

                var accessToken = await _tokenRepository.getToken(blocksUserId);
                if (string.IsNullOrEmpty(accessToken))
                {
                    Console.WriteLine("\u274c Access token not found.");
                    return (null, null, "Access token not found. Please authorize again.");
                }

                var formattedProjectName = StringFormatterService.SanitizeString(repo.ProjectName);
                var formattedRepoName = StringFormatterService.SanitizeString(repo.RepoName);
                var formattedBranchName = StringFormatterService.SanitizeString(repo.Branch);
                var truncatedRepoName = formattedRepoName[..Math.Min(20, formattedRepoName.Length)];

                var pipelineRunNameGuid = $"{truncatedRepoName}-{guid}";
                var buildImageName = $"{_configuration["ImageReference"]}{formattedProjectName}/{formattedRepoName}:{guid}";

                var pipelineRunData = PipelineRunSettings
                    .fromYamlFile(yamlPath)
                    .setMetadataNamespace(pipelineRunNameGuid)
                    .setImageReference(buildImageName)
                    .setAppName($"{formattedProjectName}-{formattedBranchName}-{formattedRepoName}")
                    .setParamNamespace(blocksUserId, repo.RepoUrl)
                    .setDomain(repo.DefaultDeploymentUrl, repo.CustomDeploymentUrl)
                    .setRepoUrl(repo.RepoUrl)
                    .setBranchName(repo.Branch)
                    .setAccessToken(accessToken)
                    .setSonarQubeProjectKey(repo.RepoName)
                    .setCliBuildEnv(repo.Branch)
                    .build();

                var result = await SubmitKubernetesAsync(
                    pipelineRunData,
                    group: "tekton.dev",
                    version: "v1beta1",
                    namespaceName: namespaceName,
                    plural: "pipelineruns");

                return result is not null? (pipelineRunNameGuid, buildImageName, null):(null, null, null);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unexpected error during PipelineRun creation: {ex.Message}");
                return (null, null, ex.Message);
            }
        }


        public async Task<string?> CreateDataGetwayInstance(string version, string projectKey, string clusterNames, string projectName, string tenantId)
        {
            try
            {
                var accessToken = _cloudBuildSecret.SeliseGithubPat;
                var yamlPath = CloudBuildConstants.DATAGETWAY_YAML_PATH;
                var metadataName = StringFormatterService.Truncate($"uds-config-run-{projectKey}-{version}-{Guid.NewGuid().ToString("N")}", 63);
                var revision = _configuration["DatagatewayClusterRevision"];

                var pipelineRunData = DataGatewayPipelineBuilder
                    .fromYamlFile(yamlPath)
                    .setMetadataName(metadataName)
                    .setVersion(version)
                    .setProjectKey(projectKey)
                    .setClusterNames(clusterNames)
                    .setRepoUrl(accessToken)
                    .setRevision(revision)
                    .setTenantId(tenantId)
                    .build();

                var result = await SubmitKubernetesAsync(
                    pipelineRunData,
                    group: "tekton.dev",
                    version: "v1beta1",
                    namespaceName: CloudBuildConstants.NAMESPACE_NAME,
                    plural: "pipelineruns");

                return result is not null? metadataName:null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unexpected error during DataGateway instance creation: {ex.Message}");
                return null;
            }
        }

        public async Task<PipelineRunStatus?> GetPipelineRunStatusAsync(string pipelineRunName, string namespaceName)
        {
            Console.WriteLine($"Retrieving PipelineRun status for: {pipelineRunName} in namespace: {namespaceName}");
            try
            {
                var pipelineRun = await _k8sClient.CustomObjects.GetNamespacedCustomObjectAsync(
                    group: "tekton.dev",
                    version: "v1",
                    namespaceParameter: namespaceName,
                    plural: "pipelineruns",
                    name: pipelineRunName
                );
                //Console.WriteLine($"[DEBUG] Raw PipelineRun object: {JsonSerializer.Serialize(pipelineRun, new JsonSerializerOptions { WriteIndented = false })}");
                var jsonString = JsonSerializer.Serialize(pipelineRun);
                var pipelineRunJObject = JObject.Parse(jsonString);

                return ParsePipelineRunStatus(pipelineRunJObject);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to get PipelineRun status: {ex.Message}");
                await Task.Delay(5000);
                return null;
            }
        }

        private PipelineRunStatus ParsePipelineRunStatus(JObject pipelineRun)
        {
            Console.WriteLine("Parsing PipelineRun status...");

            if (pipelineRun is not JObject pipelineRunDict)
            {
                Console.WriteLine("PipelineRun object is not in the expected format.");
                return null;
            }

            if (pipelineRunDict["status"] is not JObject status)
            {
                Console.WriteLine("'status' field not found in PipelineRun.");
                return null;
            }

            var result = new PipelineRunStatus { TaskRuns = new List<TaskRunInfo>() };

            // v1beta1 format
            if (status.ContainsKey("taskRuns"))
            {
                var taskRuns = (JObject)status["taskRuns"];
                Console.WriteLine($"Detected v1beta1 format: {taskRuns.Count} taskRuns found.");

                foreach (var taskRun in taskRuns)
                {
                    var taskRunData = taskRun.Value as JObject;
                    result.TaskRuns.Add(new TaskRunInfo
                    {
                        Name = taskRun.Key,
                        TaskName = taskRunData?["pipelineTaskName"]?.ToString() ?? "unknown",
                        Status = taskRunData?["status"]?.ToString() ?? "unknown"
                    });
                }
            }
            // v1 format
            else if (status.ContainsKey("childReferences"))
            {
                var childReferences = (JArray)status["childReferences"];
                Console.WriteLine($"Detected v1 format: {childReferences.Count} childReferences found.");

                foreach (var childRef in childReferences.OfType<JObject>())
                {
                    if (childRef["kind"]?.ToString() == "TaskRun")
                    {
                        result.TaskRuns.Add(new TaskRunInfo
                        {
                            Name = childRef["name"]?.ToString(),
                            TaskName = childRef["pipelineTaskName"]?.ToString() ?? "unknown"
                        });
                    }
                }

                var condition = (status["conditions"] as JArray)?.FirstOrDefault() as JObject;
                if (condition != null)
                {
                    var conditionStatus = condition["status"]?.ToString();
                    var reason = condition["reason"]?.ToString();
                    result.Status = conditionStatus switch
                    {
                        "True" => "Succeeded",
                        "False" => "Failed",
                        _ => reason ?? "Running"
                    };
                    result.Reason = reason;
                }
            }
            else
            {
                Console.WriteLine("No 'taskRuns' or 'childReferences' found in 'status'.");
            }

            Console.WriteLine($"Parsed {result.TaskRuns.Count} TaskRuns.");
            return result;
        }


        public async Task<TaskLogs> GetTaskRunLogsAsync(string taskRunName, string namespaceName)
        {
            Console.WriteLine($"[INFO] Retrieving TaskRun logs for: {taskRunName} in namespace: {namespaceName}");
            try
            {
                var taskRun = await _k8sClient.CustomObjects.GetNamespacedCustomObjectAsync(
                    group: "tekton.dev",
                    version: "v1",
                    namespaceParameter: namespaceName,
                    plural: "taskruns",
                    name: taskRunName
                );

                //Console.WriteLine($"[DEBUG] Raw TaskRun object: {JsonSerializer.Serialize(taskRun)}");
                var jsonString = JsonSerializer.Serialize(taskRun);
                var taskRunJObject = JObject.Parse(jsonString);
                var taskRunStatus = ParseTaskRunStatus(taskRunJObject);

                Console.WriteLine($"[INFO] Found Pod: {taskRunStatus.PodName}, Status: {taskRunStatus.Status}");
                var taskLogs = new TaskLogs
                {
                    TaskRunName = taskRunName,
                    PodName = taskRunStatus.PodName,
                    Status = taskRunStatus.Status
                };

                if (!string.IsNullOrEmpty(taskRunStatus.PodName))
                {
                    var pod = await _k8sClient.CoreV1.ReadNamespacedPodAsync(taskRunStatus.PodName, namespaceName);
                    Console.WriteLine($"[INFO] Found Pod with {pod.Spec.Containers.Count} containers");

                    foreach (var container in pod.Spec.Containers)
                    {
                        Console.WriteLine($"[INFO] Retrieving logs for container: {container.Name}");
                        try
                        {
                            var stepLogs = await _k8sClient.CoreV1.ReadNamespacedPodLogAsync(
                                name: taskRunStatus.PodName,
                                namespaceParameter: namespaceName,
                                container: container.Name,
                                follow: false,
                                timestamps: true
                            );

                            taskLogs.Steps[container.Name] = stepLogs.ToString();

                            using (var reader = new StreamReader(stepLogs))
                            {
                                var logBuilder = new StringBuilder();
                                string line;
                                while ((line = await reader.ReadLineAsync()) != null)
                                {
                                    var cleanedLine = System.Text.RegularExpressions.Regex.Replace(line, @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s", string.Empty);
                                    logBuilder.AppendLine(cleanedLine);

                                }
                                taskLogs.Steps[container.Name] = logBuilder.ToString();
                            }
                            Console.WriteLine($"[INFO] Logs retrieved for container: {container.Name}");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[ERROR] Error retrieving logs for container {container.Name}: {ex.Message}");
                            taskLogs.Steps[container.Name] = $"Error retrieving logs: {ex.Message}";
                        }
                    }
                }

                return taskLogs;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to get TaskRun logs: {ex.Message}");
                return new TaskLogs();
            }
        }

        private TaskRunStatus ParseTaskRunStatus(JObject taskRun)
        {
            var taskRunDict = taskRun as JObject;
            var status = taskRunDict?["status"] as JObject;

            var result = new TaskRunStatus
            {
                PodName = status?["podName"]?.ToString(),
                Status = "Unknown"
            };

            if (status?.ContainsKey("conditions") == true)
            {
                var conditions = status["conditions"] as JArray;
                if (conditions?.Count > 0)
                {
                    var condition = conditions[0] as JObject;
                    var conditionStatus = condition?["status"]?.ToString();
                    var reason = condition?["reason"]?.ToString();

                    result.Status = conditionStatus == "True" ? "Succeeded" :
                                   conditionStatus == "False" ? "Failed" :
                                   reason ?? "Running";
                }
            }
            return result;
        }

        public async Task DeletePipelineRunAsync(string pipelineRunName)
        {
            Console.WriteLine($"Deleting Pipeline  {pipelineRunName}.");
            try
            {
                await _k8sClient.CustomObjects.DeleteNamespacedCustomObjectAsync(
                    group: "tekton.dev",
                    version: "v1beta1",
                    namespaceParameter: CloudBuildConstants.NAMESPACE_NAME,
                    plural: "pipelineruns",
                    name: pipelineRunName
                );
                Console.WriteLine($"PipelineRun '{pipelineRunName}' deleted successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting PipelineRun: {ex.Message}");
            }
        }
    }
}
