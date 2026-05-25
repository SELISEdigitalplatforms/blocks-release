namespace Devops.DomainService.AnalyticsTool.Models
{
    public class SonarQubeGroupResponse
    {
        public string id { get; set; }
        public string name { get; set; }
        public string description { get; set; }
        public bool managed { get; set; }
    }

    public class SonarQubePage
    {
        public int pageIndex { get; set; }
        public int pageSize { get; set; }
        public int total { get; set; }
    }
}
