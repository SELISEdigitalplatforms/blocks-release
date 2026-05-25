using Blocks.Genesis;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Utilities;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Entities
{
    [BsonIgnoreExtraElements]
    public class Build : BaseEntity
    {
        public string ProjectId { get; set; }
        public string ProjectName { get; set; }
        public string BlocksUserId { get; set; }
        public string RepoId { get; set; }
        public string RepoName { get; set; }
        public string RepoUrl { get; set; }
        public string DefaultDeploymentUrl { get; set; }
        public string CustomDeploymentUrl { get; set; }
        public string Commit { get; set; }
        public string Branch { get; set; }
        public string ImageName { get; set; }
        public string Status { get; set; } = EventStatus.STARTED;
        public string EventName { get; set; } = EventNames.PIPELINE;
        public long Duration { get; set; }
        public string BuildImageName { get; set; }
        public string PipelineRunName { get; set; }
        public string Html_url { get; set; }
        public string DependencyTrackProjectId { get; set; }
        public List<BuildEventResponse> Events { get; set; }
    }
}
