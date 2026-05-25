using Blocks.Genesis;
using Devops.DomainService.Deployment.Models.Dtos;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Entities
{
    [BsonIgnoreExtraElements]
    public class Repo : BaseEntity
    {
        public string SourceRepoId { get; set; }
        public string SourceReference { get; set; }
        public string BlocksUserId { get; set; }
        public string ProjectId { get; set; }
        public string ProjectName { get; set; }
        public string RepoName { get; set; }
        public string RepoUrl { get; set; }
        public string DefaultDeploymentUrl { get; set; }
        public string CustomDeploymentUrl { get; set; }
        public string Branch { get; set; }
        public string Commit { get; set; }
        public DateTime? LastDeploymentDate { get; set; }
        public string LastDeploymentStatus { get; set; }
        public DeploySettings DeploySettings { get; set; }
        public string DeploymentType { get; set; }
        public GithubWebhook GithubWebhook { get; set; }
        public string RepositoryType { get; set; }
        public string DependencyTrackProjectUuid { get; set; }
    }

    public class GithubWebhook
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public bool Active { get; set; }
        public List<string> Events { get; set; }
        public Config Config { get; set; }
    }

    public class Config
    {
        public string ContentType { get; set; }
        public string InsecureSsl { get; set; }
        public string Url { get; set; }
    }
}