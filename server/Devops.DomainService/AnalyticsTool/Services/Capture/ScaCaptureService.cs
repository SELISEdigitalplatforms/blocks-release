using System.Net;
using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.AnalyticsTool.Services.Capture;

/// <summary>
/// Saves a build's own Dependency-Track results on <c>Build.ScaReport</c>, one scheduled attempt at a time, once
/// the project whose version is the build's branch has analysed a BOM uploaded since the build started.
/// </summary>
public class ScaCaptureService
{
    private const string ToolName = "Dependency-Track";
    private const int FindingsPageSize = 100;
    private const int MaxFindingsPages = 20;
    internal const int MaxSavedFindings = 2000;
    internal const int MaxSavedFindingsBytes = 4 * 1024 * 1024;

    private static readonly string[] SeverityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "UNASSIGNED"];

    private readonly DependencyTrackAnalyticsService _dependencyTrack;
    private readonly IBuildRepository _builds;
    private readonly IMessageClient _messageClient;
    private readonly ILogger<ScaCaptureService> _logger;
    private readonly INotificationService? _notifications;
    private readonly TimeProvider _time;

    public ScaCaptureService(
        DependencyTrackAnalyticsService dependencyTrack,
        IBuildRepository builds,
        IMessageClient messageClient,
        ILogger<ScaCaptureService> logger,
        INotificationService? notifications = null,
        TimeProvider? timeProvider = null)
    {
        _dependencyTrack = dependencyTrack;
        _builds = builds;
        _messageClient = messageClient;
        _logger = logger;
        _notifications = notifications;
        _time = timeProvider ?? TimeProvider.System;
    }

    /// <summary>
    /// Capture attempt <paramref name="attempt"/> (1-4). A message the report is not waiting for changes nothing.
    /// Dependency-Track errors count as "not ready" and are never thrown, so the message is not redelivered at once.
    /// </summary>
    public async Task CaptureAsync(Build build, int attempt)
    {
        if (!AnalysisReportUpdates.IsAwaitedAttempt(build.ScaReport?.Status, build.ScaReport?.Attempts, attempt))
        {
            _logger.LogInformation("SCA capture attempt {Attempt} for build {BuildId} skipped: the report is {Status} after {Attempts} attempts.",
                attempt, build.ItemId, build.ScaReport?.Status ?? "absent", build.ScaReport?.Attempts);
            return;
        }

        Outcome outcome;
        try
        {
            outcome = await TryCaptureAsync(build, attempt);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SCA capture attempt {Attempt} for build {BuildId} failed.", attempt, build.ItemId);
            outcome = Outcome.NotReady("the attempt failed");
        }

        if (outcome.Report is { } report)
        {
            if (await _builds.TrySaveScaReport(build.ItemId, attempt - 1, report, build.ProjectId))
            {
                _logger.LogInformation("SCA report of build {BuildId} captured on attempt {Attempt} with {Count} findings{Truncated}.",
                    build.ItemId, attempt, report.Findings.Count, report.FindingsTruncated ? " (truncated)" : "");
                await AnalysisReportUpdates.NotifyAsync(_notifications, _logger, build, AnalysisReportKind.Sca, ok: true, null);
            }
            return;
        }

        if (outcome.RefreshRequested)
        {
            // Read the refreshed metrics on the next attempt; nothing is saved yet but the attempt count.
            await ScheduleNextAsync(build, attempt);
            return;
        }

        _logger.LogInformation("SCA capture attempt {Attempt} for build {BuildId} not ready: {Reason}.", attempt, build.ItemId, outcome.Reason);
        if (attempt < AnalysisReportUpdates.MaxAttempts)
        {
            await ScheduleNextAsync(build, attempt);
            return;
        }

        var message = AnalysisReportUpdates.AttemptsExhausted(ToolName);
        var failed = new ScaReport { Status = AnalysisReportStatus.Failed, Attempts = attempt, Message = message };
        if (await _builds.TrySaveScaReport(build.ItemId, attempt - 1, failed, build.ProjectId))
        {
            _logger.LogWarning("SCA report of build {BuildId} failed: {Message}", build.ItemId, message);
            await AnalysisReportUpdates.NotifyAsync(_notifications, _logger, build, AnalysisReportKind.Sca, ok: false, message);
        }
    }

    private async Task<Outcome> TryCaptureAsync(Build build, int attempt)
    {
        var (project, lookupStatus) = await _dependencyTrack.LookupProjectAsync(build);
        if (project is null || string.IsNullOrEmpty(project.uuid))
            return Outcome.NotReady(lookupStatus == HttpStatusCode.NotFound ? "no project for the branch yet" : $"lookup returned {(int)lookupStatus}");

        // The lookup matches name and version itself; this guards against any other version's data being saved.
        if (!string.Equals(project.version, build.Branch, StringComparison.Ordinal))
            return Outcome.NotReady("the project found is another version");

        var bomImportedAt = AnalysisReportUpdates.FromEpochMilliseconds(project.lastBomImport);
        var analyzedAt = AnalysisReportUpdates.FromEpochMilliseconds(project.lastVulnerabilityAnalysis);
        if (bomImportedAt is null || bomImportedAt < AnalysisReportUpdates.CreatedAtUtc(build)
            || analyzedAt is null || analyzedAt < bomImportedAt)
            return Outcome.NotReady("no analysed BOM since the build started");

        // The first ready attempt: today's bookkeeping, then a metrics refresh. Build.DependencyTrackProjectId equal to
        // this project marks both as done, so a later attempt goes straight to the capture.
        if (build.DependencyTrackProjectId != project.uuid)
        {
            await _dependencyTrack.RecordProjectAsync(build, project);
            var refresh = await _dependencyTrack.RequestMetricsRefreshAsync(project.uuid);
            if (refresh is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("Dependency-Track refused the metrics refresh for project {ProjectUuid} ({Status}); the API key lacks PORTFOLIO_MANAGEMENT. Capturing the metrics as reported.",
                    project.uuid, (int)refresh);
            }
            else if ((int)refresh is < 200 or > 299)
            {
                return Outcome.NotReady($"metrics refresh returned {(int)refresh}");
            }
            else if (attempt < AnalysisReportUpdates.MaxAttempts)
            {
                return Outcome.Refreshing;
            }
            // A refresh on the last attempt: capture now with the metrics available rather than fail.
        }

        var metrics = await _dependencyTrack.GetCurrentMetricsAsync(project.uuid);
        if (metrics is null) return Outcome.NotReady("metrics unavailable");

        var (findings, more) = await ReadFindingsAsync(project.uuid);
        if (findings is null) return Outcome.NotReady("findings unavailable");

        var (kept, truncated) = BoundFindings(findings.Select(AnalysisReportMapper.ToFinding));
        return Outcome.Ready(new ScaReport
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = attempt,
            CapturedAt = _time.GetUtcNow().UtcDateTime,
            ProjectUuid = project.uuid,
            ProjectName = project.name,
            ProjectVersion = project.version,
            BomImportedAt = bomImportedAt.Value.UtcDateTime,
            AnalyzedAt = analyzedAt.Value.UtcDateTime,
            Metrics = AnalysisReportMapper.ToGenesis(metrics),
            Findings = kept,
            FindingsTruncated = truncated || more,
        });
    }

    /// <summary>
    /// Up to <see cref="MaxFindingsPages"/> pages of findings. Also returns whether Dependency-Track holds more than
    /// were read. Null when any page fails.
    /// </summary>
    private async Task<(List<SCAVulnerability>? Findings, bool More)> ReadFindingsAsync(string projectUuid)
    {
        var findings = new List<SCAVulnerability>();
        var seen = new HashSet<string>();
        long? total = null;

        for (var page = 1; page <= MaxFindingsPages; page++)
        {
            var (items, pageTotal) = await _dependencyTrack.GetFindingsPageAsync(projectUuid, page, FindingsPageSize);
            if (items is null) return (null, false);
            total ??= pageTotal;

            // Keyed by component and vulnerability, so a server that ignores paging and repeats a page adds nothing.
            var added = 0;
            foreach (var item in items)
            {
                if (item.component?.uuid is { } component && item.vulnerability?.uuid is { } vulnerability
                    && !seen.Add($"{component}/{vulnerability}")) continue;
                findings.Add(item);
                added++;
            }

            if (added == 0 || items.Length < FindingsPageSize || (total is { } t && findings.Count >= t))
                return (findings, false);
        }

        return (findings, total is null || total > findings.Count);
    }

    /// <summary>
    /// Most severe first (CRITICAL to UNASSIGNED, then CVSS v3, or v4 where v3 is absent, descending), cut at
    /// <see cref="MaxSavedFindings"/> entries or <see cref="MaxSavedFindingsBytes"/> of JSON.
    /// </summary>
    internal static (List<ScaFinding> Kept, bool Truncated) BoundFindings(IEnumerable<ScaFinding> findings)
    {
        var sorted = findings
            .OrderBy(f => SeverityRank(f.Severity))
            .ThenByDescending(f => f.CvssV3BaseScore ?? f.CvssV4Score ?? double.MinValue)
            .ToList();

        var kept = new List<ScaFinding>();
        long bytes = 2; // the enclosing brackets
        foreach (var finding in sorted)
        {
            var size = JsonSerializer.SerializeToUtf8Bytes(finding).Length + 1; // plus the separating comma
            if (kept.Count == MaxSavedFindings || bytes + size > MaxSavedFindingsBytes)
                return (kept, true);
            kept.Add(finding);
            bytes += size;
        }
        return (kept, false);
    }

    private static int SeverityRank(string? severity)
    {
        var index = Array.FindIndex(SeverityOrder, s => string.Equals(s, severity, StringComparison.OrdinalIgnoreCase));
        return index < 0 ? SeverityOrder.Length : index;
    }

    private async Task ScheduleNextAsync(Build build, int attempt)
    {
        var pending = new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = attempt };
        if (!await _builds.TrySaveScaReport(build.ItemId, attempt - 1, pending, build.ProjectId)) return;

        try
        {
            await AnalysisReportUpdates.ScheduleCaptureAsync(_messageClient, build, AnalysisReportKind.Sca, attempt + 1,
                _time.GetUtcNow() + AnalysisReportUpdates.RetryDelayAfter(attempt));
        }
        catch (Exception ex)
        {
            // The report stays Pending and reads as Failed two hours after the build started.
            _logger.LogError(ex, "Could not schedule SCA capture attempt {Attempt} for build {BuildId}.", attempt + 1, build.ItemId);
        }
    }

    private sealed record Outcome(ScaReport? Report, bool RefreshRequested, string? Reason)
    {
        public static readonly Outcome Refreshing = new(null, true, null);

        public static Outcome Ready(ScaReport report) => new(report, false, null);

        public static Outcome NotReady(string reason) => new(null, false, reason);
    }
}
