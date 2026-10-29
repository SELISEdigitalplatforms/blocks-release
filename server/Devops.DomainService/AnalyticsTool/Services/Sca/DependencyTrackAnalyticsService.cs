using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pipelines.Sockets.Unofficial.Arenas;

namespace Devops.DomainService.AnalyticsTool.Services.Sca;

public class DependencyTrackAnalyticsService : IDependencyTrackAnalyticsService
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);
    private const string ScaToolsApiBaseUriKey = "ScaToolsApiBaseUri";
    private const string ApiKeyHeader = "X-Api-Key";
    private readonly ILogger<DependencyTrackAnalyticsService> _logger;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly DependencyTrackRepositoryService _dependencyTrackRepositoryService;
    private readonly ICloudBuildSecret _cloudBuildSecret;
    private readonly IConfiguration _configuration;
    private readonly INotificationService? _notificationService;

    public DependencyTrackAnalyticsService(ILogger<DependencyTrackAnalyticsService> logger, IHttpHelperServices httpHelperServices, BuildAndRepoRepositories repositories, DependencyTrackRepositoryService dependencyTrackRepositoryService, ICloudBuildSecret cloudBuildSecret, IConfiguration configuration, INotificationService? notificationService = null)
    {
        _notificationService = notificationService;
        _logger = logger;
        _httpHelperServices = httpHelperServices;
        _buildRepository = repositories.Builds;
        _repoRepository = repositories.Repos;
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

        var formattedRepoName = FormatProjectName(repoName);

        try
        {
            var url = $"{_configuration[ScaToolsApiBaseUriKey]}/api/v1/project/lookup?name={formattedRepoName}&version={version}";

            var headers = new Dictionary<string, string>
            {
                { ApiKeyHeader, _cloudBuildSecret.DependencyTrackApiKey }
            };

            var (apiCallResult, _) = await _httpHelperServices.MakeHttpGetRequest<ScaLookupResponse>(url, null, headers);
            // Only the version that IS the branch: a substring match also read e.g. `dev-x` for `dev`.
            var filtered = apiCallResult.versions
                    .Where(p => string.Equals(p.version, version, StringComparison.Ordinal))
                    .ToList();


            if (apiCallResult.metrics != null)
            {
                metricsDict = MetricsToDetails(apiCallResult.metrics);
            }

            foreach (var project in filtered)
            {
                var vulnerabilitiesUrl =
                    $"{_configuration[ScaToolsApiBaseUriKey]}/api/v1/finding/project/{project.uuid}?suppressed=false";
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
                            EpssScore = item.vulnerability?.epssScore ?? 0,
                            EpssPercentile = item.vulnerability?.epssPercentile ?? 0,
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
        var uuid = await RetrieveScaProjectUuidCore(build);
        var ok = !string.IsNullOrWhiteSpace(uuid);
        await NotifyAnalysisFinishedAsync(build, ok);
        return uuid;
    }

    private async Task NotifyAnalysisFinishedAsync(Build build, bool ok)
    {
        if (_notificationService is null) return;
        try
        {
            await _notificationService.SendBuiltInAsync(build.ProjectId, "release-code-analysis-finished", new[] { build.CreatedBy },
                NotificationService.BuildPayload("release-code-analysis-finished",
                    ok ? "Dependency analysis finished" : "Dependency analysis failed",
                    ok ? "The dependency (SCA) analysis of the build finished." : "The dependency (SCA) analysis of the build did not finish.", ok,
                    ("buildId", build.ItemId), ("repoId", build.RepoId), ("projectId", build.ProjectId), ("analysisType", "SCA")));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Built-in notification failed. config={ConfigurationName} tenant={TenantId} status={ErrorType}", "release-code-analysis-finished", build.ProjectId, ex.GetType().Name);
        }
    }

    private async Task<string> RetrieveScaProjectUuidCore(Build build)
    {
        var formattedRepoName = FormatProjectName(build.RepoName);

        try
        {
            var url = $"{_configuration[ScaToolsApiBaseUriKey]}/api/v1/project/lookup?name={formattedRepoName}&version={build.Branch}";

            var headers = new Dictionary<string, string>
            {
                { ApiKeyHeader, _cloudBuildSecret.DependencyTrackApiKey }
            };

            var (apiCallResult, response) = await _httpHelperServices.MakeHttpRequest<ScaLookupResponse>(_configuration[ScaToolsApiBaseUriKey], url, HttpMethod.Get, null, headers);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully fetched sca data for build {RepoName}", build.RepoName);
                await RecordProjectAsync(build, apiCallResult);
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


    /// <summary>
    /// Turns raw advisory identifiers into links. Null aliases give an empty list, and each identifier is
    /// URL-encoded because it comes from the advisory feed, not from us.
    /// </summary>
    public static List<Alias> ConvertAliasesToLinkAliases(List<Alias>? aliases)
    {
        var result = new List<Alias>();

        foreach (var alias in aliases ?? [])
        {
            if (alias is null) continue;

            var newAlias = new Alias
            {
                cveId = !string.IsNullOrEmpty(alias.cveId)
                    ? $"https://cve.mitre.org/cgi-bin/cvename.cgi?name={Uri.EscapeDataString(alias.cveId)}"
                    : null,
                ghsaId = !string.IsNullOrEmpty(alias.ghsaId)
                    ? $"https://github.com/advisories/{Uri.EscapeDataString(alias.ghsaId)}"
                    : null,
                osvId = !string.IsNullOrEmpty(alias.osvId)
                    ? $"https://osv.dev/vulnerability/{Uri.EscapeDataString(alias.osvId)}"
                    : null
            };

            result.Add(newAlias);
        }

        return result;
    }

    /// <summary>
    /// Today's bookkeeping for a found project: its UUID on the repo and the build, and the project-team mapping.
    /// </summary>
    internal async Task RecordProjectAsync(Build build, ScaLookupResponse project)
    {
        bool repoUpdateResult = await _repoRepository.UpdateRepoDependencyTrackProjectUuid(build.RepoId, project.uuid, build.ProjectId);
        bool buildUpdateResult = await _buildRepository.UpdateBuildDependencyTrackProjectId(build.ItemId, project.uuid, build.ProjectId);
        await EnsureRepoProjectEntry(build, project);
        _logger.LogInformation("Dependency Track Project Uuid Repo update result: {RepoUpdateResult}, Build update result: {BuildUpdateResult}", repoUpdateResult, buildUpdateResult);
    }

    /// <summary>
    /// The live report's <c>details</c>: every <see cref="Metrics"/> property by name, formatted with
    /// <c>ToString()</c> (<c>"null"</c> when absent).
    /// </summary>
    internal static Dictionary<string, string> MetricsToDetails(Metrics metrics)
    {
        var details = new Dictionary<string, string>();
        foreach (PropertyInfo prop in typeof(Metrics).GetProperties())
        {
            object? value = prop.GetValue(metrics);
            details[prop.Name] = value?.ToString() ?? "null";
        }
        return details;
    }

    /// <summary>The Dependency-Track project name for a repository, as the pipeline's BOM upload names it.</summary>
    internal static string FormatProjectName(string repoName) =>
        Regex.Replace(repoName, "[^a-zA-Z0-9]", "-", RegexOptions.None, RegexTimeout).ToLower().Trim()
            .Trim('-')
            .ToLower();

    // ---- Calls used by the per-build capture (ScaCaptureService). Each returns null data on any failure. ----

    /// <summary>The project whose version is exactly the build's branch, with the response status.</summary>
    internal async Task<(ScaLookupResponse? Project, HttpStatusCode Status)> LookupProjectAsync(Build build)
    {
        var url = $"{ScaBaseUri()}/api/v1/project/lookup?name={Uri.EscapeDataString(FormatProjectName(build.RepoName))}&version={Uri.EscapeDataString(build.Branch)}";
        var (project, response) = await _httpHelperServices.MakeHttpRequest<ScaLookupResponse>(ScaBaseUri(), url, HttpMethod.Get, null, ScaHeaders());
        return (response.IsSuccessStatusCode ? project : null, response.StatusCode);
    }

    /// <summary>
    /// Asks Dependency-Track to recompute the project's metrics. The HTTP helper reports a transport failure as an
    /// empty 200, so a request that never arrived reads as accepted; the next attempt then reads the metrics as
    /// they are, which is the same outcome as a refused refresh.
    /// </summary>
    internal async Task<HttpStatusCode> RequestMetricsRefreshAsync(string projectUuid)
    {
        var url = $"{ScaBaseUri()}/api/v1/metrics/project/{Uri.EscapeDataString(projectUuid)}/refresh";
        var (_, response) = await _httpHelperServices.MakeHttpRequest<object>(ScaBaseUri(), url, HttpMethod.Get, null, ScaHeaders());
        return response.StatusCode;
    }

    internal async Task<DependencyTrackProjectMetrics?> GetCurrentMetricsAsync(string projectUuid)
    {
        var url = $"{ScaBaseUri()}/api/v1/metrics/project/{Uri.EscapeDataString(projectUuid)}/current";
        var (metrics, response) = await _httpHelperServices.MakeHttpRequest<DependencyTrackProjectMetrics>(ScaBaseUri(), url, HttpMethod.Get, null, ScaHeaders());
        return response.IsSuccessStatusCode ? metrics : null;
    }

    /// <summary>One page of the project's unsuppressed findings, and the total Dependency-Track reports when it sends one.</summary>
    internal async Task<(SCAVulnerability[]? Findings, long? Total)> GetFindingsPageAsync(string projectUuid, int pageNumber, int pageSize)
    {
        var url = $"{ScaBaseUri()}/api/v1/finding/project/{Uri.EscapeDataString(projectUuid)}?suppressed=false&pageSize={pageSize}&pageNumber={pageNumber}";
        var (findings, response) = await _httpHelperServices.MakeHttpRequest<SCAVulnerability[]>(ScaBaseUri(), url, HttpMethod.Get, null, ScaHeaders());
        if (!response.IsSuccessStatusCode || findings is null) return (null, null);

        long? total = response.Headers.TryGetValues("X-Total-Count", out var values)
                      && long.TryParse(values.FirstOrDefault(), out var parsed)
            ? parsed
            : null;
        return (findings, total);
    }

    private string ScaBaseUri() => _configuration[ScaToolsApiBaseUriKey] ?? string.Empty;

    private Dictionary<string, string> ScaHeaders() => new() { { ApiKeyHeader, _cloudBuildSecret.DependencyTrackApiKey } };

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

        // Dependency-Track keeps one project per repo + branch (name + version), so each one needs
        // its own entry - matching on RepoId alone left every branch after the first unmapped to the team.
        bool exists = dependencyTrackProject.RepoProjects.Any(rp => rp.RepoId == build.RepoId && rp.ProjectUuid == apiCallResult.uuid);

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
