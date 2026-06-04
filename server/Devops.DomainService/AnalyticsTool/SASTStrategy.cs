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
        //dev-aks
        //l3-net-ipex-business
        string metricKeys = string.Join(",", CloudBuildConstants.SAST_METRIC_KEYS);
        var sastToolsApiBaseUri = _configuration["SastToolsApiBaseUri"];
        var url = $"{sastToolsApiBaseUri}/measures/component?component={repoName}&branch={branchName}&additionalFields=period&metricKeys={metricKeys}";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "Authorization", $"Bearer {_cloudBuildSecret.SastBasicAuthToken}" },
            };
        var (apiCallResult, _) = await _httpHelperServices.MakeHttpGetRequest<SASTResponse>(url, null, headers);

        //convert response to generic response
        Dictionary<string, string> metrics = new();
        if (apiCallResult?.Component?.Measures != null)
        {
            foreach (var measure in apiCallResult.Component.Measures)
            {
                metrics[measure.Metric] = measure.Value;
            }
        }
        var result = new TestReport
        {
            Type = "SAST",
            Details = metrics
        };
        return result;
    }
}
