namespace Devops.DomainService.AnalyticsTool.Models
{
    public class PostBuildQueue
    {
        public string ProjectKey { get; set; }
        public string PipelineRunName { get; set; }
        public PipelineTypes PipelineType { get; set; }
        public PipelineEventTypes PipelineEventType { get; set; }
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
        DeletePipeLine
    }

}
