namespace Devops.DomainService.AnalyticsTool.Models
{
    public class PostBuildQueue
    {
        public string ProjectKey { get; set; }
        public string PipelineRunName { get; set; }
        public PipelineTypes PipelineType { get; set; }
        public PipelineEventTypes PipelineEventType { get; set; }

        /// <summary>
        /// The capture attempt a <see cref="PipelineEventTypes.CaptureSastReport"/> or
        /// <see cref="PipelineEventTypes.CaptureScaReport"/> message carries (1 to 4). 0 on every other message,
        /// including those queued before the field existed.
        /// </summary>
        public int Attempt { get; set; }
    }

    public enum PipelineTypes
    {
        RepoDeployment,
        DataGatewayPipeline
    }

    public enum PipelineEventTypes
    {
        RetrieveLog,
        RetrieveDependencyTrackId,
        DeletePipeLine,
        CaptureSastReport,
        CaptureScaReport
    }

}
