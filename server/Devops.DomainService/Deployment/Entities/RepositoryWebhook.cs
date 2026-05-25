using Blocks.Genesis;

namespace Devops.DomainService.Deployment.Entities
{
    public class RepositoryWebhook : BaseEntity
    {
        public string RepoId { get; set; }
        public string RepoUrl { get; set; }

        public string Ref { get; set; }
        public string BeforeSha { get; set; }
        public string AfterSha { get; set; }
        public string HeadCommitSha { get; set; }
        public string HeadCommitMessage { get; set; }
        public string PusherName { get; set; }
        public string PusherEmail { get; set; }
        public DateTime HeadCommitTimestamp { get; set; }
        public string HeadCommitUrl { get; set; }

        public string AuthorName { get; set; }
        public string AuthorEmail { get; set; }

        public string CommitterName { get; set; }
        public string CommitterEmail { get; set; }
    }
}
