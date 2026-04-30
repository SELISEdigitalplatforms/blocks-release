namespace Devops.DomainService.TestingTools.Models;
public class Author
{
}

public class Metrics
{
    public int critical { get; set; }
    public int high { get; set; }
    public int medium { get; set; }
    public int low { get; set; }
    public int unassigned { get; set; }
    public int vulnerabilities { get; set; }
    public int vulnerableComponents { get; set; }
    public int components { get; set; }
    public int suppressed { get; set; }
    public int findingsTotal { get; set; }
    public int findingsAudited { get; set; }
    public int findingsUnaudited { get; set; }
    public double inheritedRiskScore { get; set; }
    public int policyViolationsFail { get; set; }
    public int policyViolationsWarn { get; set; }
    public int policyViolationsInfo { get; set; }
    public int policyViolationsTotal { get; set; }
    public int policyViolationsAudited { get; set; }
    public int policyViolationsUnaudited { get; set; }
    public int policyViolationsSecurityTotal { get; set; }
    public int policyViolationsSecurityAudited { get; set; }
    public int policyViolationsSecurityUnaudited { get; set; }
    public int policyViolationsLicenseTotal { get; set; }
    public int policyViolationsLicenseAudited { get; set; }
    public int policyViolationsLicenseUnaudited { get; set; }
    public int policyViolationsOperationalTotal { get; set; }
    public int policyViolationsOperationalAudited { get; set; }
    public int policyViolationsOperationalUnaudited { get; set; }
    public string collectionLogic { get; set; }
    public bool collectionLogicChanged { get; set; }
    public object firstOccurrence { get; set; }
    public object lastOccurrence { get; set; }
}

public class ScaLookupResponse
{
    public string name { get; set; }
    public string uuid { get; set; }
    public Metrics metrics { get; set; }
    public List<VersionInfo> versions { get; set; }
}

public class VersionInfo
{
    public string uuid { get; set; }
    public string version { get; set; }
    public bool active { get; set; }
}


