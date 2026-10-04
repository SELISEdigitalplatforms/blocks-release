using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.TestingTools;

public class SASTStrategy : IStrategy
{
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly ICloudBuildSecret _cloudBuildSecret;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SASTStrategy>? _logger;

    public SASTStrategy(
        IHttpHelperServices httpHelperServices,
        ICloudBuildSecret cloudBuildSecret,
        IConfiguration configuration,
        ILogger<SASTStrategy>? logger = null)
    {
        _httpHelperServices = httpHelperServices;
        _cloudBuildSecret = cloudBuildSecret;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<TestReport> getInfo(string repoName, string branchName)
    {
        var sastToolsApiBaseUri = _configuration["SastToolsApiBaseUri"]?.TrimEnd('/');
        var key = Uri.EscapeDataString(repoName);
        var branch = Uri.EscapeDataString(branchName);
        var headers = new Dictionary<string, string>
        {
            { "Accept", "application/json" },
            { "Authorization", $"Bearer {_cloudBuildSecret.SastBasicAuthToken}" },
        };

        string metricKeys = string.Join(",", CloudBuildConstants.SAST_METRIC_KEYS);
        var measuresUrl =
            $"{sastToolsApiBaseUri}/measures/component?component={key}&branch={branch}&additionalFields=period&metricKeys={metricKeys}";
        var gateUrl =
            $"{sastToolsApiBaseUri}/qualitygates/project_status?projectKey={key}&branch={branch}";
        var newIssuesUrl =
            $"{sastToolsApiBaseUri}/issues/search?components={key}&branch={branch}&issueStatuses=OPEN,CONFIRMED&facets=impactSeverities&ps=1&inNewCodePeriod=true";
        var allIssuesUrl =
            $"{sastToolsApiBaseUri}/issues/search?components={key}&branch={branch}&issueStatuses=OPEN,CONFIRMED&facets=impactSeverities&ps=1";

        var measuresTask = SafeGetAsync<SASTResponse>(measuresUrl, headers);
        var gateTask = SafeGetAsync<SonarProjectStatusResponse>(gateUrl, headers);
        var newIssuesTask = SafeGetAsync<SonarIssuesSearchResponse>(newIssuesUrl, headers);
        var allIssuesTask = SafeGetAsync<SonarIssuesSearchResponse>(allIssuesUrl, headers);

        await Task.WhenAll(measuresTask, gateTask, newIssuesTask, allIssuesTask);

        var apiCallResult = await measuresTask;
        var metrics = MapMeasures(apiCallResult);

        if (apiCallResult == null || metrics.Count == 0)
        {
            return new TestReport
            {
                Type = "SAST",
                Details = null,
                QualityGate = null,
                IssueBreakdown = null
            };
        }

        return new TestReport
        {
            Type = "SAST",
            Details = metrics,
            QualityGate = MapQualityGate(await gateTask),
            IssueBreakdown = MapIssueBreakdown(await newIssuesTask, await allIssuesTask)
        };
    }

    private async Task<T?> SafeGetAsync<T>(string url, Dictionary<string, string> headers) where T : class
    {
        try
        {
            var (result, _) = await _httpHelperServices.MakeHttpGetRequest<T>(url, null, headers);
            return result;
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "SonarQube call failed for {Url}", RedactUrl(url));
            return null;
        }
    }

    private static string RedactUrl(string url)
    {
        // Never log tokens; URL itself has no Authorization header.
        return url;
    }

    private static Dictionary<string, string> MapMeasures(SASTResponse? apiCallResult)
    {
        Dictionary<string, string> metrics = new();
        if (apiCallResult?.Component?.Measures != null)
        {
            foreach (var measure in apiCallResult.Component.Measures)
            {
                var value = measure.Value ?? measure.Period?.value;
                if (string.IsNullOrEmpty(value))
                {
                    continue;
                }
                metrics[measure.Metric] = value;
            }
        }

        if (apiCallResult?.Period != null)
        {
            if (!string.IsNullOrEmpty(apiCallResult.Period.Date))
            {
                metrics["new_code_period_date"] = apiCallResult.Period.Date;
            }
            if (!string.IsNullOrEmpty(apiCallResult.Period.Mode))
            {
                metrics["new_code_period_mode"] = apiCallResult.Period.Mode;
            }
        }

        return metrics;
    }

    private static SastQualityGate? MapQualityGate(SonarProjectStatusResponse? response)
    {
        var status = response?.ProjectStatus;
        if (status == null)
        {
            return null;
        }

        var normalized = status.Status switch
        {
            "OK" or "ERROR" or "NONE" => status.Status,
            _ => "NONE"
        };

        var conditions = new List<SastGateCondition>();
        if (status.Conditions != null)
        {
            foreach (var c in status.Conditions)
            {
                conditions.Add(new SastGateCondition
                {
                    MetricKey = c.MetricKey ?? "",
                    Comparator = c.Comparator is "GT" or "LT" ? c.Comparator : "GT",
                    ErrorThreshold = c.ErrorThreshold ?? "",
                    ActualValue = c.ActualValue,
                    Status = c.Status is "OK" or "ERROR" ? c.Status : "OK"
                });
            }
        }

        return new SastQualityGate { Status = normalized, Conditions = conditions };
    }

    private static SastIssueBreakdown? MapIssueBreakdown(
        SonarIssuesSearchResponse? newCode,
        SonarIssuesSearchResponse? overall)
    {
        var newCounts = MapSeverityCounts(newCode);
        var overallCounts = MapSeverityCounts(overall);
        if (newCounts == null && overallCounts == null)
        {
            return null;
        }

        return new SastIssueBreakdown { NewCode = newCounts, Overall = overallCounts };
    }

    private static SastSeverityCounts? MapSeverityCounts(SonarIssuesSearchResponse? response)
    {
        if (response?.Paging == null)
        {
            return null;
        }

        var counts = new SastSeverityCounts { Total = response.Paging.Total };
        var facet = response.Facets?.FirstOrDefault(f =>
            string.Equals(f.Property, "impactSeverities", StringComparison.OrdinalIgnoreCase));
        if (facet?.Values != null)
        {
            foreach (var v in facet.Values)
            {
                var key = (v.Val ?? "").ToUpperInvariant();
                switch (key)
                {
                    case "BLOCKER": counts.Blocker = v.Count; break;
                    case "HIGH": counts.High = v.Count; break;
                    case "MEDIUM": counts.Medium = v.Count; break;
                    case "LOW": counts.Low = v.Count; break;
                    case "INFO": counts.Info = v.Count; break;
                }
            }
        }

        return counts;
    }
}
