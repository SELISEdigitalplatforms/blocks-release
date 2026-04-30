namespace Devops.DomainService.VersionControlSystems.Models.Response
{
    public class GithubUserOrgResponse
    {
        public ulong id { get; set; }
        public string node_id { get; set; }
        public string avatar_url { get; set; }
        public string description { get; set; }
        public string login { get; set; }
    }
}
