namespace Devops.DomainService.TestingTools.Models;

public class SCAResultResponse
{
    public List<object> authors { get; set; }
    public string name { get; set; }
    public string version { get; set; }
    public string classifier { get; set; }
    public string collectionLogic { get; set; }
    public string purl { get; set; }
    public string directDependencies { get; set; }
    public string uuid { get; set; }
    public List<object> children { get; set; }
    public List<object> properties { get; set; }
    public List<object> tags { get; set; }
    public long lastBomImport { get; set; }
    public string lastBomImportFormat { get; set; }
    public double lastInheritedRiskScore { get; set; }
    public long lastVulnerabilityAnalysis { get; set; }
    public bool active { get; set; }
    public bool isLatest { get; set; }
    public Metadata metadata { get; set; }
    public List<Version> versions { get; set; }
    public Metrics metrics { get; set; }
}

public class Metadata
{
    public List<Author> authors { get; set; }
}

public class Version
{
    public string uuid { get; set; }
    public string version { get; set; }
    public bool active { get; set; }
}

