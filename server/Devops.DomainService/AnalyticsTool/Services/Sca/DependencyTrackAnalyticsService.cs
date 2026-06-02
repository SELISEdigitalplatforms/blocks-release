using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.TestingTools.Entity;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pipelines.Sockets.Unofficial.Arenas;

namespace Devops.DomainService.AnalyticsTool.Services.Sca;

public class DependencyTrackAnalyticsService : IDependencyTrackAnalyticsService
{
    private readonly ILogger<DependencyTrackAnalyticsService> _logger;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly DependencyTrackRepositoryService _dependencyTrackRepositoryService;
    private readonly ICloudBuildSecret _cloudBuildSecret;
    private readonly IConfiguration _configuration;

    public DependencyTrackAnalyticsService(ILogger<DependencyTrackAnalyticsService> logger, IHttpHelperServices httpHelperServices, IBuildRepository buildRepository, IRepoRepository repoRepository, DependencyTrackRepositoryService dependencyTrackRepositoryService, ICloudBuildSecret cloudBuildSecret, IConfiguration configuration)
    {
        _logger = logger;
        _httpHelperServices = httpHelperServices;
        _buildRepository = buildRepository;
        _repoRepository = repoRepository;
        _dependencyTrackRepositoryService = dependencyTrackRepositoryService;
        _cloudBuildSecret = cloudBuildSecret;
        _configuration = configuration;
    }

    public async Task<TestReport> getInfo(string repoName, string version)
    {
        var result = new TestReport()
        {
            Type = "Sca"
        };
        List<VulnerabilityResponse> Vulnerabilities = new List<VulnerabilityResponse>();
        Dictionary<string, string> metricsDict = new Dictionary<string, string>();

        var formattedRepoName = Regex.Replace(repoName, "[^a-zA-Z0-9]", "-").ToLower().Trim()
                    .Trim('-')
                    .ToLower();

        try
        {
            var url = $"{_configuration["ScaToolsApiBaseUri"]}/api/v1/project/lookup?name={formattedRepoName}&version={version}";

            var headers = new Dictionary<string, string>
            {
                { "X-Api-Key", _cloudBuildSecret.DependencyTrackApiKey }
            };

            var (apiCallResult, _) = await _httpHelperServices.MakeHttpGetRequest<ScaLookupResponse>(url, null, headers);
            var filtered = apiCallResult.versions
                    .Where(p => p.version != null && p.version.Contains(version, StringComparison.OrdinalIgnoreCase))
                    .ToList();


            if (apiCallResult.metrics != null)
            {
                PropertyInfo[] properties = typeof(Metrics).GetProperties();
                foreach (var prop in properties)
                {
                    object value = prop.GetValue(apiCallResult.metrics);
                    metricsDict[prop.Name] = value?.ToString() ?? "null";
                }
            }

            foreach (var project in filtered)
            {
                var vulnerabilitiesUrl =
                    $"{_configuration["ScaToolsApiBaseUri"]}/api/v1/finding/project/{project.uuid}?suppressed=false";
                var (scaVulnerabilitiesResponse, _) = await _httpHelperServices.MakeHttpGetRequest<SCAVulnerability[]>(vulnerabilitiesUrl, null, headers);


                if (scaVulnerabilitiesResponse is not null)
                {

                    foreach (var item in scaVulnerabilitiesResponse)
                    {
                        Vulnerabilities.Add(new VulnerabilityResponse
                        {
                            Name = item.component?.name,
                            Version = item.component?.version,
                            LatestVersion = item.component?.latestVersion,
                            Id = item.vulnerability?.vulnId,
                            Score = item.vulnerability?.cvssV3BaseScore?.ToString(), // Nullable, so use ?.ToString()
                            Severity = item.vulnerability?.severity,
                            Group = item.component?.group,
                            EpssScore = item.vulnerability.epssScore,
                            EpssPercentile = item.vulnerability.epssPercentile,
                            Description = item.vulnerability?.description,
                            CweName = item.vulnerability?.cweName,
                            Aliases = ConvertAliasesToLinkAliases(item.vulnerability?.aliases)
                        });
                    }

                }
            }

            result.Details = metricsDict;
            result.Vulnerabilities = Vulnerabilities;
        }
        catch (Exception ex)
        {
            _logger.LogInformation("Failed to fetch sca data: {ErrorMessage}", ex.Message);
        }



        return result;
    }

    public async Task<string> RetrieveScaProjectUuid(Build build)
    {
        var formattedRepoName = Regex.Replace(build.RepoName, "[^a-zA-Z0-9]", "-").ToLower().Trim()
                    .Trim('-')
                    .ToLower();

        try
        {
            var url = $"{_configuration["ScaToolsApiBaseUri"]}/api/v1/project/lookup?name={formattedRepoName}&version={build.Branch}";

            var headers = new Dictionary<string, string>
            {
                { "X-Api-Key", _cloudBuildSecret.DependencyTrackApiKey }
            };

            var (apiCallResult, response) = await _httpHelperServices.MakeHttpRequest<ScaLookupResponse>(_configuration["ScaToolsApiBaseUri"], url, HttpMethod.Get, null, headers);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully fetched sca data for build {RepoName}", build.RepoName);
                bool repoUpdateResult = await _repoRepository.UpdateRepoDependencyTrackProjectUuid(build.RepoId, apiCallResult.uuid, build.ProjectId);
                bool buildUpdateResult = await _buildRepository.UpdateBuildDependencyTrackProjectId(build.ItemId, apiCallResult.uuid, build.ProjectId);
                bool checkProjectEntry = await EnsureRepoProjectEntry(build, apiCallResult);
                _logger.LogInformation("Dependency Track Project Uuid Repo update result: {RepoUpdateResult}, Build update result: {BuildUpdateResult}", repoUpdateResult, buildUpdateResult);
            }
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                _logger.LogError("Authorization error for build {RepoName}", build.RepoName);
            }
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogInformation("No sca project found for build {RepoName}", build.RepoName);
                return null;
            }
            return apiCallResult.uuid;
        }
        catch (Exception ex)
        {
            Console.WriteLine("Failed to fetch sca data: {0}", ex.Message);
            return null;
        }
    }


    public static List<Alias> ConvertAliasesToLinkAliases(List<Alias> aliases)
    {
        var result = new List<Alias>();

        foreach (var alias in aliases)
        {
            var newAlias = new Alias
            {
                cveId = !string.IsNullOrEmpty(alias.cveId)
                    ? $"https://cve.mitre.org/cgi-bin/cvename.cgi?name={alias.cveId}"
                    : null,
                ghsaId = !string.IsNullOrEmpty(alias.ghsaId)
                    ? $"https://github.com/advisories/{alias.ghsaId}"
                    : null,
                osvId = !string.IsNullOrEmpty(alias.osvId)
                    ? $"https://osv.dev/vulnerability/{alias.osvId}"
                    : null
            };

            result.Add(newAlias);
        }

        return result;
    }

    public async Task<bool> EnsureRepoProjectEntry(Build build, ScaLookupResponse apiCallResult)
    {
        if (apiCallResult == null || string.IsNullOrEmpty(apiCallResult.uuid))
        {
            _logger.LogWarning("apiCallResult or uuid is null, cannot ensure RepoProject entry.");
            return false;
        }

        DependencyTrackProjects dependencyTrackProject = await _dependencyTrackRepositoryService.GetDependencyTrackProject(build.ProjectId);
        if (dependencyTrackProject == null)
        {
            _logger.LogWarning("No DependencyTrackProjects found for projectId {ProjectId}", build.ProjectId);

            dependencyTrackProject = new DependencyTrackProjects
            {
                ItemId = Guid.NewGuid().ToString(),
                ProjectId = build.ProjectId,
                RepoProjects = new List<RepoProject>()
            };
        }

        if (dependencyTrackProject.RepoProjects == null)
            dependencyTrackProject.RepoProjects = new List<RepoProject>();

        bool exists = dependencyTrackProject.RepoProjects.Any(rp => rp.RepoId == build.RepoId);

        if (!exists)
        {
            dependencyTrackProject.RepoProjects.Add(new RepoProject
            {
                RepoId = build.RepoId,
                ProjectUuid = apiCallResult.uuid
            });

            await _dependencyTrackRepositoryService.SaveDependencyTrackProject(dependencyTrackProject);
            _logger.LogInformation("Added RepoProject entry for RepoId {RepoId} with ProjectUuid {ProjectUuid} to DependencyTrackProjects {ProjectId}", build.RepoId, apiCallResult.uuid, dependencyTrackProject.ProjectId);
            return true;
        }
        else
        {
            _logger.LogInformation("RepoProject entry for RepoId {RepoId} already exists in DependencyTrackProjects {ProjectId}", build.RepoId, dependencyTrackProject.ProjectId);
            return false;
        }
    }
}
