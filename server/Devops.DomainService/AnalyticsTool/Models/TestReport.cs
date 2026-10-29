using System.Text.Json.Serialization;

namespace Devops.DomainService.TestingTools.Models;

/// <summary>
/// The <c>GET /build/reports</c> payload. The fields after <see cref="IssueBreakdown"/> describe a report saved on
/// the build; they are left out of the JSON when null, so a live (legacy) report keeps today's exact shape.
/// </summary>
public class TestReport
{
    public string Type { get; set; }
    public Dictionary<string, string> Details { get; set; }
    public List<VulnerabilityResponse> Vulnerabilities { get; set; }
    public SastQualityGate QualityGate { get; set; }
    public SastIssueBreakdown IssueBreakdown { get; set; }

    /// <summary><c>Pending</c>, <c>Ready</c>, <c>NotRun</c> or <c>Failed</c>; null for a live report.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }

    /// <summary>Why the report is <c>NotRun</c> or <c>Failed</c>.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Message { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? CapturedAt { get; set; }

    /// <summary>SAST: the SonarQube analysis the saved results come from, when known.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? AnalysisDate { get; set; }

    /// <summary>SAST: the commit SonarQube analysed, when known.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Revision { get; set; }

    /// <summary>SCA: Dependency-Track's last vulnerability analysis of the project.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? AnalyzedAt { get; set; }

    /// <summary>SCA: true when the saved findings were cut to the most severe ones.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? FindingsTruncated { get; set; }
}
