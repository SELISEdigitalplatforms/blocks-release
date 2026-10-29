using System.Globalization;
using System.Text.RegularExpressions;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Utilities;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.AnalyticsTool.Services.Capture;

/// <summary>
/// The rules every writer of a build's saved SAST/SCA report shares: the attempt schedule, the conditional
/// transitions outside capture (log poller, timeout, cancel) and the one notification per report.
/// </summary>
internal static class AnalysisReportUpdates
{
    public const int MaxAttempts = 4;

    public static readonly TimeSpan SastFirstAttemptDelay = TimeSpan.FromMinutes(1);

    /// <summary>Later than SAST: Dependency-Track imports the BOM, analyses it and computes metrics in turn.</summary>
    public static readonly TimeSpan ScaFirstAttemptDelay = TimeSpan.FromMinutes(3);

    public const string NotificationConfig = "release-code-analysis-finished";

    public const string CancelledMessage = "The build was cancelled.";
    public const string TimedOutMessage = "The pipeline did not finish within 30 minutes.";

    public static string StepDidNotSucceed(string step) => $"The {step} step did not succeed.";

    public static string StepDidNotRun(string step) => $"The {step} step did not run.";

    public static string AttemptsExhausted(string tool) => $"{tool} results were not available after {MaxAttempts} attempts.";

    /// <summary>How long to wait after a not-ready <paramref name="attempt"/> before the next one: 2, 5, then 10 minutes.</summary>
    public static TimeSpan RetryDelayAfter(int attempt) => attempt switch
    {
        1 => TimeSpan.FromMinutes(2),
        2 => TimeSpan.FromMinutes(5),
        _ => TimeSpan.FromMinutes(10),
    };

    /// <summary>Whether a capture message for <paramref name="attempt"/> is the one this report is waiting for.</summary>
    public static bool IsAwaitedAttempt(string? status, int? attempts, int attempt) =>
        status == AnalysisReportStatus.Pending && attempts == attempt - 1;

    /// <summary>Queues capture <paramref name="attempt"/> for delivery at <paramref name="deliverAt"/>.</summary>
    public static Task ScheduleCaptureAsync(
        IMessageClient messageClient, Build build, AnalysisReportKind kind, int attempt, DateTimeOffset deliverAt)
    {
        var message = new PostBuildQueue
        {
            ProjectKey = build.ProjectId,
            PipelineRunName = build.PipelineRunName,
            PipelineType = PipelineTypes.RepoDeployment,
            PipelineEventType = kind == AnalysisReportKind.Sast
                ? PipelineEventTypes.CaptureSastReport
                : PipelineEventTypes.CaptureScaReport,
            Attempt = attempt,
        };
        return messageClient.SendToConsumerAsync(new ConsumerMessage<PostBuildQueue>
        {
            ConsumerName = CloudBuildConstants.POST_BUILD_LISTENER,
            Payload = message,
            ScheduledEnqueueTimeUtc = deliverAt,
        });
    }

    /// <summary>
    /// Ends the report if it is still <c>Pending</c> and, only when this call ended it, notifies the build's creator.
    /// A report another writer already ended is left as it is.
    /// </summary>
    public static async Task EndPendingAsync(
        IBuildRepository builds, INotificationService? notifications, ILogger logger,
        string pipelineRunName, AnalysisReportKind kind, string status, string message, string tenantId, Tenant? project = null)
    {
        var ended = project is null
            ? await builds.TryEndPendingReport(pipelineRunName, kind, status, message, tenantId)
            : await builds.TryEndPendingReport(pipelineRunName, kind, status, message, project);
        if (ended is null) return;

        logger.LogInformation("{Kind} report of build {BuildId} set to {Status}: {Message}", kind, ended.ItemId, status, message);
        await NotifyAsync(notifications, logger, ended, kind, ok: false, message);
    }

    /// <summary>
    /// The <c>release-code-analysis-finished</c> notification for one report, sent by whoever made the report
    /// terminal. Best effort: a failed send is logged and never fails the capture.
    /// </summary>
    public static async Task NotifyAsync(
        INotificationService? notifications, ILogger logger, Build build, AnalysisReportKind kind, bool ok, string? message)
    {
        if (notifications is null) return;

        var (title, description) = (kind, ok) switch
        {
            (AnalysisReportKind.Sast, true) => ("Code analysis finished", "The code (SAST) analysis of the build finished."),
            (AnalysisReportKind.Sast, false) => ("Code analysis failed", message ?? ""),
            (_, true) => ("Dependency analysis finished", "The dependency (SCA) analysis of the build finished."),
            (_, false) => ("Dependency analysis failed", message ?? ""),
        };

        try
        {
            await notifications.SendBuiltInAsync(build.ProjectId, NotificationConfig, new[] { build.CreatedBy },
                NotificationService.BuildPayload(NotificationConfig, title, description, ok,
                    ("buildId", build.ItemId), ("repoId", build.RepoId), ("projectId", build.ProjectId),
                    ("analysisType", kind == AnalysisReportKind.Sast ? "SAST" : "SCA")));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Built-in notification failed. config={ConfigurationName} tenant={TenantId} status={ErrorType}",
                NotificationConfig, build.ProjectId, ex.GetType().Name);
        }
    }

    /// <summary>The build's creation time as UTC (MongoDB returns UTC; an unspecified kind is taken as UTC).</summary>
    public static DateTimeOffset CreatedAtUtc(Build build) =>
        build.CreatedDate.Kind == DateTimeKind.Local
            ? new DateTimeOffset(build.CreatedDate.ToUniversalTime())
            : new DateTimeOffset(DateTime.SpecifyKind(build.CreatedDate, DateTimeKind.Utc));

    private static readonly Regex CompactOffset =
        new(@"([+-]\d{2})(\d{2})$", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));

    /// <summary>
    /// Parses a SonarQube date such as <c>2026-10-28T10:06:12+0000</c>; .NET wants the offset as <c>+00:00</c>.
    /// </summary>
    public static DateTimeOffset? ParseSonarDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = CompactOffset.Replace(value.Trim(), "$1:$2");
        return DateTimeOffset.TryParse(normalized, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed
            : null;
    }

    /// <summary>Dependency-Track epoch milliseconds as UTC.</summary>
    public static DateTimeOffset? FromEpochMilliseconds(long? value) =>
        value is { } ms ? DateTimeOffset.FromUnixTimeMilliseconds(ms) : null;
}
