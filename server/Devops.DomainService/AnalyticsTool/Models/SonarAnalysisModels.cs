using System.Text.Json.Serialization;

namespace Devops.DomainService.TestingTools.Models;

/// <summary>SonarQube <c>api/project_branches/list</c> payload.</summary>
public class SonarProjectBranchesResponse
{
    [JsonPropertyName("branches")]
    public List<SonarProjectBranch>? Branches { get; set; }
}

public class SonarProjectBranch
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>Kept as SonarQube's string (for example <c>2026-10-28T10:06:12+0000</c>); parsed by <c>AnalysisReportUpdates.ParseSonarDate</c>.</summary>
    [JsonPropertyName("analysisDate")]
    public string? AnalysisDate { get; set; }
}

/// <summary>SonarQube <c>api/project_analyses/search</c> payload.</summary>
public class SonarProjectAnalysesResponse
{
    [JsonPropertyName("analyses")]
    public List<SonarProjectAnalysis>? Analyses { get; set; }
}

public class SonarProjectAnalysis
{
    [JsonPropertyName("key")]
    public string? Key { get; set; }

    [JsonPropertyName("date")]
    public string? Date { get; set; }

    [JsonPropertyName("revision")]
    public string? Revision { get; set; }
}
