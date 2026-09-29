using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Configuration;

namespace Devops.DomainService.TestingTools;

public class SASTStrategy : IStrategy
{
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly ICloudBuildSecret _cloudBuildSecret;
    private readonly IConfiguration _configuration;

    public SASTStrategy(IHttpHelperServices httpHelperServices, ICloudBuildSecret cloudBuildSecret, IConfiguration configuration)
    {
        _httpHelperServices = httpHelperServices;
        _cloudBuildSecret = cloudBuildSecret;
        _configuration = configuration;
    }

    public async Task<TestReport> getInfo(string repoName, string branchName)
    {
        string metricKeys = string.Join(",", CloudBuildConstants.SAST_METRIC_KEYS);
        var sastToolsApiBaseUri = _configuration["SastToolsApiBaseUri"];
        var url = $"{sastToolsApiBaseUri}/measures/component?component={repoName}&branch={branchName}&additionalFields=period&metricKeys={metricKeys}";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "Authorization", $"Bearer {_cloudBuildSecret.SastBasicAuthToken}" },
            };
        var (apiCallResult, _) = await _httpHelperServices.MakeHttpGetRequest<SASTResponse>(url, null, headers);

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

        // Null response or no usable keys → Details=null so the client shows Data Processing.
        if (apiCallResult == null || metrics.Count == 0)
        {
            return new TestReport
            {
                Type = "SAST",
                Details = null
            };
        }

        return new TestReport
        {
            Type = "SAST",
            Details = metrics
        };
    }
}
