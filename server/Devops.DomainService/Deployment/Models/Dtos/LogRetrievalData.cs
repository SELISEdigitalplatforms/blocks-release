namespace Devops.DomainService.Deployment.Models.Dtos
{
    public class PipelineRunStatus
    {
        public List<TaskRunInfo> TaskRuns { get; set; } = new();
        public string Status { get; set; }
        public string? Reason { get; set; }
    }

    public class TaskRunInfo
    {
        public string Name { get; set; }
        public string TaskName { get; set; }
        public string Status { get; set; }
    }

    public class TaskRunStatus
    {
        public string PodName { get; set; }
        public string Status { get; set; }
    }

    public class TaskLogs
    {
        public string TaskRunName { get; set; }
        public string PodName { get; set; }
        public string Status { get; set; }
        public Dictionary<string, string> Steps { get; set; } = new();
    }
}
