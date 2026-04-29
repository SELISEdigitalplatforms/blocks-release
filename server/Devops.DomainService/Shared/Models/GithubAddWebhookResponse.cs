using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Shared.Models
{
    [BsonIgnoreExtraElements]
    public class GitHubErrorResponse
    {
        public string Message { get; set; }
        public List<GitHubErrorDetail> Errors { get; set; }
        public string Documentation_Url { get; set; }
        public string Status { get; set; }
    }

    [BsonIgnoreExtraElements]
    public class GitHubErrorDetail
    {
        public string Resource { get; set; }
        public string Code { get; set; }
        public string Message { get; set; }
    }


}
