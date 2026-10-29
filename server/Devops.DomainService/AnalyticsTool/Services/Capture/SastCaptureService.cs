using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.TestingTools;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.AnalyticsTool.Services.Capture;

/// <summary>
/// Saves a build's own SonarQube results on <c>Build.SastReport</c>, one scheduled attempt at a time, once
/// SonarQube has analysed the build's branch since the build started.
/// </summary>
public class SastCaptureService
{
    private const string ToolName = "SonarQube";

    private readonly SASTStrategy _sast;
    private readonly IBuildRepository _builds;
    private readonly IMessageClient _messageClient;
    private readonly ILogger<SastCaptureService> _logger;
    private readonly INotificationService? _notifications;
    private readonly TimeProvider _time;

    public SastCaptureService(
        SASTStrategy sast,
        IBuildRepository builds,
        IMessageClient messageClient,
        ILogger<SastCaptureService> logger,
        INotificationService? notifications = null,
        TimeProvider? timeProvider = null)
    {
        _sast = sast;
        _builds = builds;
        _messageClient = messageClient;
        _logger = logger;
        _notifications = notifications;
        _time = timeProvider ?? TimeProvider.System;
    }

    /// <summary>
    /// Capture attempt <paramref name="attempt"/> (1-4). A message the report is not waiting for changes nothing.
    /// SonarQube errors count as "not ready" and are never thrown, so the message is not redelivered at once.
    /// </summary>
    public async Task CaptureAsync(Build build, int attempt)
    {
        if (!AnalysisReportUpdates.IsAwaitedAttempt(build.SastReport?.Status, build.SastReport?.Attempts, attempt))
        {
            _logger.LogInformation("SAST capture attempt {Attempt} for build {BuildId} skipped: the report is {Status} after {Attempts} attempts.",
                attempt, build.ItemId, build.SastReport?.Status ?? "absent", build.SastReport?.Attempts);
            return;
        }

        var projectKey = build.RepoName.Replace("/", "-");
        SastReport? captured;
        try
        {
            captured = await TryCaptureAsync(build, projectKey, attempt);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SAST capture attempt {Attempt} for build {BuildId} failed.", attempt, build.ItemId);
            captured = null;
        }

        if (captured is null)
        {
            await NotReadyAsync(build, projectKey, attempt);
            return;
        }

        if (await _builds.TrySaveSastReport(build.ItemId, attempt - 1, captured, build.ProjectId))
        {
            _logger.LogInformation("SAST report of build {BuildId} captured on attempt {Attempt}.", build.ItemId, attempt);
            await AnalysisReportUpdates.NotifyAsync(_notifications, _logger, build, AnalysisReportKind.Sast, ok: true, null);
        }
    }

    /// <summary>The Ready report, or null while SonarQube has no analysis of this build or a query fails.</summary>
    private async Task<SastReport?> TryCaptureAsync(Build build, string projectKey, int attempt)
    {
        var branches = await _sast.GetBranchesAsync(projectKey);
        var analysedAt = AnalysisReportUpdates.ParseSonarDate(
            branches?.Branches?.FirstOrDefault(b => b.Name == build.Branch)?.AnalysisDate);
        if (analysedAt is null || analysedAt < AnalysisReportUpdates.CreatedAtUtc(build))
        {
            _logger.LogInformation("SAST capture attempt {Attempt} for build {BuildId}: no analysis of branch since the build started.",
                attempt, build.ItemId);
            return null;
        }

        var data = await _sast.QueryAsync(projectKey, build.Branch);
        var metrics = SASTStrategy.MapMeasures(data.Measures);
        // No measures is "no data" on the live path too; saving it as Ready would show an empty report for good.
        if (!data.AllSucceeded || metrics.Count == 0)
        {
            _logger.LogInformation("SAST capture attempt {Attempt} for build {BuildId}: a SonarQube query failed or returned no measures.", attempt, build.ItemId);
            return null;
        }

        // Optional metadata: the lookup's branch parameter is internal to SonarQube, so its failure costs only these fields.
        var analysis = await _sast.GetLatestAnalysisAsync(projectKey, build.Branch);

        return new SastReport
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = attempt,
            CapturedAt = _time.GetUtcNow().UtcDateTime,
            ProjectKey = projectKey,
            Branch = build.Branch,
            AnalysisKey = analysis?.Key,
            AnalysisDate = AnalysisReportUpdates.ParseSonarDate(analysis?.Date)?.UtcDateTime,
            Revision = analysis?.Revision,
            Metrics = metrics,
            QualityGate = AnalysisReportMapper.ToGenesis(SASTStrategy.MapQualityGate(data.Gate)),
            IssueBreakdown = AnalysisReportMapper.ToGenesis(SASTStrategy.MapIssueBreakdown(data.NewIssues, data.AllIssues)),
        };
    }

    private async Task NotReadyAsync(Build build, string projectKey, int attempt)
    {
        if (attempt >= AnalysisReportUpdates.MaxAttempts)
        {
            var message = AnalysisReportUpdates.AttemptsExhausted(ToolName);
            var failed = new SastReport
            {
                Status = AnalysisReportStatus.Failed, Attempts = attempt, Message = message, ProjectKey = projectKey, Branch = build.Branch,
            };
            if (await _builds.TrySaveSastReport(build.ItemId, attempt - 1, failed, build.ProjectId))
            {
                _logger.LogWarning("SAST report of build {BuildId} failed: {Message}", build.ItemId, message);
                await AnalysisReportUpdates.NotifyAsync(_notifications, _logger, build, AnalysisReportKind.Sast, ok: false, message);
            }
            return;
        }

        var pending = new SastReport
        {
            Status = AnalysisReportStatus.Pending, Attempts = attempt, ProjectKey = projectKey, Branch = build.Branch,
        };
        if (!await _builds.TrySaveSastReport(build.ItemId, attempt - 1, pending, build.ProjectId)) return;

        try
        {
            await AnalysisReportUpdates.ScheduleCaptureAsync(_messageClient, build, AnalysisReportKind.Sast, attempt + 1,
                _time.GetUtcNow() + AnalysisReportUpdates.RetryDelayAfter(attempt));
        }
        catch (Exception ex)
        {
            // The report stays Pending and reads as Failed two hours after the build started.
            _logger.LogError(ex, "Could not schedule SAST capture attempt {Attempt} for build {BuildId}.", attempt + 1, build.ItemId);
        }
    }
}
