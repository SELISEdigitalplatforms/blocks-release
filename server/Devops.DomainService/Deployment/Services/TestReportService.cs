using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Services.Capture;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.Deployment.Services;

public class TestReportService
{
    /// <summary>A report still Pending this long after the build started is shown as Failed (read-time only).</summary>
    internal static readonly TimeSpan StalePendingAfter = TimeSpan.FromHours(2);

    internal const string NotCapturedMessage = "Results were not captured.";

    private TestingToolContext _testToolContext;
    private readonly IBuildRepository _buildRepository;
    private readonly SASTStrategy _sastStrategy;
    private readonly DependencyTrackAnalyticsService _scaAnalyticsService;
    private readonly DASTStrategy _dastStrategy;
    private readonly TimeProvider _time;

    public TestReportService(IBuildRepository buildRepository, SASTStrategy sastStrategy, DependencyTrackAnalyticsService scaAnalyticsService, DASTStrategy dastStrategy, TimeProvider? timeProvider = null)
    {
        _buildRepository = buildRepository;
        _sastStrategy = sastStrategy;
        _scaAnalyticsService = scaAnalyticsService;
        _dastStrategy = dastStrategy;
        _time = timeProvider ?? TimeProvider.System;
    }

    /// <summary>
    /// The build's report of <paramref name="type"/>. SAST and SCA libraries come from the report saved on the build
    /// when there is one, without calling SonarQube or Dependency-Track; builds from before the capture existed
    /// (no saved report) are read live, as are the other types.
    /// </summary>
    public async Task<TestReport> GetReport(string buildId, string type)
    {

        var build = await _buildRepository.GetBuild(buildId);
        var repoName = build.RepoName.Replace("/", "-");
        TestReport? result = null;
        switch (type)
        {
            case "sast" when build.SastReport is { } saved:
                result = FromSaved(saved, build);
                break;
            case "sast":
                _testToolContext = new TestingToolContext(_sastStrategy);
                result = await _testToolContext.getInfo(repoName, build.Branch);
                break;
            case "sca-container":
                result = await _scaAnalyticsService.getInfo(repoName, build.ImageName);
                break;
            case "sca-libraries" when build.ScaReport is { } saved:
                result = FromSaved(saved, build);
                break;
             case "sca-libraries":
                result = await _scaAnalyticsService.getInfo(repoName, build.Branch);
                break;
            case "dast":
                _testToolContext = new TestingToolContext(_dastStrategy);
                result = await _testToolContext.getInfo(repoName, build.Branch);
                break;
            default:
                Console.WriteLine($"unknown type {type}");
                break;
        }

        return result;

    }

    private TestReport FromSaved(SastReport saved, Build build)
    {
        var report = StatusOnly("SAST", saved.Status, saved.Message, build);
        if (report.Status != AnalysisReportStatus.Ready) return report;

        report.CapturedAt = saved.CapturedAt;
        report.AnalysisDate = saved.AnalysisDate;
        report.Revision = saved.Revision;
        report.Details = saved.Metrics is { Count: > 0 } metrics ? new Dictionary<string, string>(metrics) : null;
        report.QualityGate = AnalysisReportMapper.ToLocal(saved.QualityGate);
        report.IssueBreakdown = AnalysisReportMapper.ToLocal(saved.IssueBreakdown);
        return report;
    }

    private TestReport FromSaved(ScaReport saved, Build build)
    {
        var report = StatusOnly("Sca", saved.Status, saved.Message, build);
        if (report.Status != AnalysisReportStatus.Ready) return report;

        report.CapturedAt = saved.CapturedAt;
        report.AnalyzedAt = saved.AnalyzedAt;
        report.FindingsTruncated = saved.FindingsTruncated;
        report.Details = AnalysisReportMapper.ToDetails(saved.Metrics);
        report.Vulnerabilities = (saved.Findings ?? []).Select(AnalysisReportMapper.ToResponse).ToList();
        return report;
    }

    /// <summary>The report with its status and message only; a stale Pending one reads as Failed.</summary>
    private TestReport StatusOnly(string type, string status, string? message, Build build)
    {
        if (status == AnalysisReportStatus.Pending && _time.GetUtcNow() - AnalysisReportUpdates.CreatedAtUtc(build) > StalePendingAfter)
        {
            return new TestReport { Type = type, Status = AnalysisReportStatus.Failed, Message = NotCapturedMessage };
        }

        return new TestReport
        {
            Type = type,
            Status = status,
            Message = status == AnalysisReportStatus.Ready || status == AnalysisReportStatus.Pending ? null : message,
        };
    }
}
