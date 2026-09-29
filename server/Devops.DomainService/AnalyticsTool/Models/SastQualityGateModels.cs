using System.Text.Json.Serialization;

namespace Devops.DomainService.TestingTools.Models;

public class SastQualityGate
{
    public string Status { get; set; } = "NONE";
    public List<SastGateCondition> Conditions { get; set; } = new();
}

public class SastGateCondition
{
    public string MetricKey { get; set; } = "";
    public string Comparator { get; set; } = "GT";
    public string ErrorThreshold { get; set; } = "";
    public string? ActualValue { get; set; }
    public string Status { get; set; } = "OK";
}

public class SastIssueBreakdown
{
    public SastSeverityCounts? NewCode { get; set; }
    public SastSeverityCounts? Overall { get; set; }
}

public class SastSeverityCounts
{
    public int Total { get; set; }
    public int Blocker { get; set; }
    public int High { get; set; }
    public int Medium { get; set; }
    public int Low { get; set; }
    public int Info { get; set; }
}

/// <summary>SonarQube qualitygates/project_status payload.</summary>
public class SonarProjectStatusResponse
{
    [JsonPropertyName("projectStatus")]
    public SonarProjectStatus? ProjectStatus { get; set; }
}

public class SonarProjectStatus
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("conditions")]
    public List<SonarGateCondition>? Conditions { get; set; }
}

public class SonarGateCondition
{
    [JsonPropertyName("metricKey")]
    public string? MetricKey { get; set; }

    [JsonPropertyName("comparator")]
    public string? Comparator { get; set; }

    [JsonPropertyName("errorThreshold")]
    public string? ErrorThreshold { get; set; }

    [JsonPropertyName("actualValue")]
    public string? ActualValue { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}

/// <summary>SonarQube issues/search payload (paging + impactSeverities facet).</summary>
public class SonarIssuesSearchResponse
{
    [JsonPropertyName("paging")]
    public SonarPaging? Paging { get; set; }

    [JsonPropertyName("facets")]
    public List<SonarFacet>? Facets { get; set; }
}

public class SonarPaging
{
    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SonarFacet
{
    [JsonPropertyName("property")]
    public string? Property { get; set; }

    [JsonPropertyName("values")]
    public List<SonarFacetValue>? Values { get; set; }
}

public class SonarFacetValue
{
    [JsonPropertyName("val")]
    public string? Val { get; set; }

    [JsonPropertyName("count")]
    public int Count { get; set; }
}
