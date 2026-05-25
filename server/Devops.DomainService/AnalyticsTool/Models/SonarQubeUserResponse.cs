namespace Devops.DomainService.AnalyticsTool.Models
{
    public class SonarQubeUserResponse
    {
        public string id { get; set; }
        public string login { get; set; }
        public string name { get; set; }
        public string email { get; set; }
        public bool active { get; set; }
        public bool local { get; set; }
        public string externalLogin { get; set; }
        public string externalProvider { get; set; }
    }
}
