namespace Devops.DomainService.AnalyticsTool.Models
{
    public class SonarQubeGroupSearchResponse
    {
        public List<SonarQubeGroupResponse> groups { get; set; }
        public SonarQubePage page { get; set; }
    }
}
