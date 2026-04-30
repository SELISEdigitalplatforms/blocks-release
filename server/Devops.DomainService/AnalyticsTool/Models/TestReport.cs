namespace Devops.DomainService.TestingTools.Models;

public class TestReport
{
    public string Type { get; set; }
    public Dictionary<string, string> Details { get; set; }
    public List<VulnerabilityResponse> Vulnerabilities { get; set; }

}