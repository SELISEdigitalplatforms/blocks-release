using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Entities
{
    [BsonIgnoreExtraElements]
    public class RepoCustomDomain : BaseEntity
    {
        public string ProjectId { get; set; }
        public string ProjectEnv { get; set; }
        public string RepoId { get; set; }
        public string RepoUrl { get; set; }
        public string CustomDeploymentDomain { get; set; }
    }
}