using System.Text.Json;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Genesis = Blocks.Genesis.Entities.Release;
using Local = Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.AnalyticsTool.Services.Capture;

/// <summary>
/// Maps between the tool responses, the Genesis report entities saved on the build and the <c>/build/reports</c>
/// shapes. The SAST quality-gate and issue classes exist in both namespaces with the same members.
/// </summary>
internal static class AnalysisReportMapper
{
    // ---- SAST ----

    public static Genesis.SastQualityGate? ToGenesis(Local.SastQualityGate? gate) => gate is null ? null : new()
    {
        Status = gate.Status,
        Conditions = gate.Conditions.ConvertAll(c => new Genesis.SastGateCondition
        {
            MetricKey = c.MetricKey,
            Comparator = c.Comparator,
            ErrorThreshold = c.ErrorThreshold,
            ActualValue = c.ActualValue,
            Status = c.Status,
        }),
    };

    public static Local.SastQualityGate? ToLocal(Genesis.SastQualityGate? gate) => gate is null ? null : new()
    {
        Status = gate.Status,
        Conditions = (gate.Conditions ?? []).ConvertAll(c => new Local.SastGateCondition
        {
            MetricKey = c.MetricKey,
            Comparator = c.Comparator,
            ErrorThreshold = c.ErrorThreshold,
            ActualValue = c.ActualValue,
            Status = c.Status,
        }),
    };

    public static Genesis.SastIssueBreakdown? ToGenesis(Local.SastIssueBreakdown? breakdown) => breakdown is null ? null : new()
    {
        NewCode = ToGenesis(breakdown.NewCode),
        Overall = ToGenesis(breakdown.Overall),
    };

    public static Local.SastIssueBreakdown? ToLocal(Genesis.SastIssueBreakdown? breakdown) => breakdown is null ? null : new()
    {
        NewCode = ToLocal(breakdown.NewCode),
        Overall = ToLocal(breakdown.Overall),
    };

    private static Genesis.SastSeverityCounts? ToGenesis(Local.SastSeverityCounts? c) => c is null ? null : new()
    {
        Total = c.Total, Blocker = c.Blocker, High = c.High, Medium = c.Medium, Low = c.Low, Info = c.Info,
    };

    private static Local.SastSeverityCounts? ToLocal(Genesis.SastSeverityCounts? c) => c is null ? null : new()
    {
        Total = c.Total, Blocker = c.Blocker, High = c.High, Medium = c.Medium, Low = c.Low, Info = c.Info,
    };

    // ---- SCA ----

    public static Genesis.ScaMetrics ToGenesis(Local.DependencyTrackProjectMetrics m) => new()
    {
        Critical = m.critical,
        High = m.high,
        Medium = m.medium,
        Low = m.low,
        Unassigned = m.unassigned,
        Vulnerabilities = m.vulnerabilities,
        VulnerableComponents = m.vulnerableComponents,
        Components = m.components,
        Suppressed = m.suppressed,
        FindingsTotal = m.findingsTotal,
        FindingsAudited = m.findingsAudited,
        FindingsUnaudited = m.findingsUnaudited,
        InheritedRiskScore = m.inheritedRiskScore,
        Kev = m.kev,
        PolicyViolationsFail = m.policyViolationsFail,
        PolicyViolationsWarn = m.policyViolationsWarn,
        PolicyViolationsInfo = m.policyViolationsInfo,
        PolicyViolationsTotal = m.policyViolationsTotal,
        PolicyViolationsAudited = m.policyViolationsAudited,
        PolicyViolationsUnaudited = m.policyViolationsUnaudited,
        PolicyViolationsSecurityTotal = m.policyViolationsSecurityTotal,
        PolicyViolationsSecurityAudited = m.policyViolationsSecurityAudited,
        PolicyViolationsSecurityUnaudited = m.policyViolationsSecurityUnaudited,
        PolicyViolationsLicenseTotal = m.policyViolationsLicenseTotal,
        PolicyViolationsLicenseAudited = m.policyViolationsLicenseAudited,
        PolicyViolationsLicenseUnaudited = m.policyViolationsLicenseUnaudited,
        PolicyViolationsOperationalTotal = m.policyViolationsOperationalTotal,
        PolicyViolationsOperationalAudited = m.policyViolationsOperationalAudited,
        PolicyViolationsOperationalUnaudited = m.policyViolationsOperationalUnaudited,
        CollectionLogic = m.collectionLogic,
        CollectionLogicChanged = m.collectionLogicChanged,
        FirstOccurrence = ToEpochMilliseconds(m.firstOccurrence),
        LastOccurrence = ToEpochMilliseconds(m.lastOccurrence),
    };

    /// <summary>
    /// The saved metrics as the report's <c>details</c>: the live report's keys and formatting
    /// (<see cref="DependencyTrackAnalyticsService.MetricsToDetails"/>), plus <c>kev</c>.
    /// </summary>
    public static Dictionary<string, string> ToDetails(Genesis.ScaMetrics? m)
    {
        if (m is null) return new Dictionary<string, string>();

        var live = new Local.Metrics
        {
            critical = m.Critical,
            high = m.High,
            medium = m.Medium,
            low = m.Low,
            unassigned = m.Unassigned,
            vulnerabilities = m.Vulnerabilities,
            vulnerableComponents = m.VulnerableComponents,
            components = m.Components,
            suppressed = m.Suppressed,
            findingsTotal = m.FindingsTotal,
            findingsAudited = m.FindingsAudited,
            findingsUnaudited = m.FindingsUnaudited,
            inheritedRiskScore = m.InheritedRiskScore,
            policyViolationsFail = m.PolicyViolationsFail,
            policyViolationsWarn = m.PolicyViolationsWarn,
            policyViolationsInfo = m.PolicyViolationsInfo,
            policyViolationsTotal = m.PolicyViolationsTotal,
            policyViolationsAudited = m.PolicyViolationsAudited,
            policyViolationsUnaudited = m.PolicyViolationsUnaudited,
            policyViolationsSecurityTotal = m.PolicyViolationsSecurityTotal,
            policyViolationsSecurityAudited = m.PolicyViolationsSecurityAudited,
            policyViolationsSecurityUnaudited = m.PolicyViolationsSecurityUnaudited,
            policyViolationsLicenseTotal = m.PolicyViolationsLicenseTotal,
            policyViolationsLicenseAudited = m.PolicyViolationsLicenseAudited,
            policyViolationsLicenseUnaudited = m.PolicyViolationsLicenseUnaudited,
            policyViolationsOperationalTotal = m.PolicyViolationsOperationalTotal,
            policyViolationsOperationalAudited = m.PolicyViolationsOperationalAudited,
            policyViolationsOperationalUnaudited = m.PolicyViolationsOperationalUnaudited,
            collectionLogic = m.CollectionLogic,
            collectionLogicChanged = m.CollectionLogicChanged,
            firstOccurrence = m.FirstOccurrence,
            lastOccurrence = m.LastOccurrence,
        };

        var details = DependencyTrackAnalyticsService.MetricsToDetails(live);
        details["kev"] = m.Kev.ToString();
        return details;
    }

    public static Genesis.ScaFinding ToFinding(Local.SCAVulnerability item) => new()
    {
        ComponentName = item.component?.name,
        ComponentGroup = item.component?.group,
        ComponentVersion = item.component?.version,
        LatestVersion = item.component?.latestVersion,
        VulnId = item.vulnerability?.vulnId,
        Source = item.vulnerability?.source,
        Severity = item.vulnerability?.severity,
        CvssV3BaseScore = item.vulnerability?.cvssV3BaseScore,
        CvssV4Score = item.vulnerability?.cvssV4Score,
        EpssScore = item.vulnerability?.epssScore,
        EpssPercentile = item.vulnerability?.epssPercentile,
        CweName = item.vulnerability?.cweName,
        Cwes = (item.vulnerability?.cwes ?? []).Where(c => c is not null)
            .Select(c => new Genesis.ScaCwe { CweId = c.cweId, Name = c.name }).ToList(),
        Description = item.vulnerability?.description,
        Aliases = (item.vulnerability?.aliases ?? []).Where(a => a is not null)
            .Select(a => new Genesis.ScaAlias { CveId = a.cveId, GhsaId = a.ghsaId, OsvId = a.osvId }).ToList(),
    };

    /// <summary>A saved finding in the live report's <see cref="Local.VulnerabilityResponse"/> shape.</summary>
    public static Local.VulnerabilityResponse ToResponse(Genesis.ScaFinding f) => new()
    {
        Name = f.ComponentName,
        Group = f.ComponentGroup,
        Version = f.ComponentVersion,
        LatestVersion = f.LatestVersion,
        Id = f.VulnId,
        Score = f.CvssV3BaseScore?.ToString(),
        Severity = f.Severity,
        EpssScore = f.EpssScore ?? 0,
        EpssPercentile = f.EpssPercentile ?? 0,
        CweName = f.CweName,
        Description = f.Description,
        Aliases = DependencyTrackAnalyticsService.ConvertAliasesToLinkAliases(
            (f.Aliases ?? []).Select(a => new Local.Alias { cveId = a.CveId, ghsaId = a.GhsaId, osvId = a.OsvId }).ToList()),
    };

    /// <summary>
    /// Dependency-Track's metric timestamps: <see cref="Local.Metrics"/> types them as <c>object</c>, which the JSON
    /// reader fills with a <see cref="JsonElement"/>.
    /// </summary>
    internal static long? ToEpochMilliseconds(object? value) => value switch
    {
        null => null,
        long l => l,
        int i => i,
        JsonElement { ValueKind: JsonValueKind.Number } e when e.TryGetInt64(out var n) => n,
        JsonElement { ValueKind: JsonValueKind.String } e when long.TryParse(e.GetString(), out var n) => n,
        string s when long.TryParse(s, out var n) => n,
        _ => null,
    };
}
