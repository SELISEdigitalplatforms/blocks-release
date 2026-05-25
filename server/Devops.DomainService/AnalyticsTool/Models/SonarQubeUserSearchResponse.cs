namespace Devops.DomainService.AnalyticsTool.Models
{
    public class SonarQubeUserSearchResponse
    {
        public List<SonarQubeUserResponse> users { get; set; }
        public SonarQubePage page { get; set; }
    }
}
