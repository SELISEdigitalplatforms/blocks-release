using Devops.DomainService.Deployment.Models.Response;

namespace Devops.DomainService.Shared.Utilities
{
    public static class PipeLineTaskConstants
    {
        public static readonly string[] TermialStatus = { "Succeeded", "Failed", "Error" };
        public static readonly string[] PriorityTaskList = { "fetch-source", "build-push", "deploy-app" };

        public static readonly IReadOnlyDictionary<string, string> EventGroupMapping = new Dictionary<string, string>
        {
            { "fetch-source", "Clone" },
            { "build-push", "Build" },
            { "deploy-app", "Deploy" },
            { "sonar-scan", "Sast" },
            { "sca-scan", "Sca" },
            { "trivy-image-scan", "Sca" }
        };

        public static readonly IReadOnlyDictionary<string, string> StatusEventMapping = new Dictionary<string, string>
        {
            { "Unknown", EventTypes.EventStarted },
            { "Pending", EventTypes.EventStarted},
            { "Running", EventTypes.Log},
            { "Succeeded", EventTypes.EventFinished},
            { "Failed", EventTypes.EventFailed},

            // Cancellation statuses
            { "Cancelled", EventTypes.EventCancelled },
            { "CancelledRunFinally", EventTypes.EventCancelled },
            { "StoppedRunFinally", EventTypes.EventFailed },
            { "PipelineRunCancelled", EventTypes.EventCancelled },
            { "PipelineRunCouldntCancel", EventTypes.EventFailed },
            { "TaskRunCancelled", EventTypes.EventCancelled },
            { "PipelineRunStopping", EventTypes.EventFailed },
        
            // Timeout statuses
            { "PipelineRunTimeout", EventTypes.EventFailed },
            { "TaskRunTimeout", EventTypes.EventFailed },
        
            // Image and resource related failures
            { "PullImageFailed", EventTypes.EventFailed },
            { "CouldntGetPipeline", EventTypes.EventFailed },
            { "CouldntGetTask", EventTypes.EventFailed },
            { "InvalidPipelineResourceBinding", EventTypes.EventFailed },
            { "InvalidWorkspaceBinding", EventTypes.EventFailed },
            { "InvalidTaskResultReference", EventTypes.EventFailed },
            { "RequiredWorkspaceMarkedOptional", EventTypes.EventFailed },
        
            // Reference resolution
            { "ResolvingPipelineRef", EventTypes.EventStarted },
            { "InvalidPipelineRef", EventTypes.EventFailed },
        
            // Validation failures
            { "ConditionCheckFailed", EventTypes.EventFailed },
            { "PipelineValidationFailed", EventTypes.EventFailed },
            { "PipelineRunValidationFailed", EventTypes.EventFailed },
            { "TaskValidationFailed", EventTypes.EventFailed },
            { "TaskRunValidationFailed", EventTypes.EventFailed }
        };
    }


    public static class EventNames
    {
        public const string PIPELINE = "Pipeline";
        public const string CLONE = "Clone";
        public const string BUILD = "Build";
        public const string SAST = "Sast";
        public const string SCA = "Sca";
        public const string TEST = "Test";
        public const string DEPLOY = "Deploy";
        public const string SECURITY = "Security";
        public const string APPROVAL = "Approval";
        public const string NOTIFICATION = "Notification";
        public const string RESOURCE = "Resource";
        public const string ARTIFACT = "Artifact";
        public const string DATABASE = "Database";
        public const string CONTAINER = "Container";
        public const string PERFORMANCE = "Performance";
        public const string MONITORING = "Monitoring";
        public const string UNKNOWN = "Unknown";
    }
    public static class EventStatus
    {
        public const string QUEUED = "Queued";
        public const string PENDING = "Pending";
        public const string RUNNING = "Running";
        public const string STARTED = "Started";
        public const string COMPLETED = "Completed";
        public const string SUCCEEDED = "Succeeded";
        public const string FAILED = "Failed";
        public const string CANCELLED = "Cancelled";
        public const string TIMEOUT = "Timeout";
        public const string SKIPPED = "Skipped";
        public const string PAUSED = "Paused";
        public const string RESUMED = "Resumed";
        public const string UNKNOWN = "Unknown";
    }
}
