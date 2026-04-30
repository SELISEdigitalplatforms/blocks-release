using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.Deployment.Services;

public class TestReportService
{
    private TestingToolContext _testToolContext;
    private readonly IBuildRepository _buildRepository;
    private readonly SASTStrategy _sastStrategy;
    private readonly DependencyTrackAnalyticsService _scaAnalyticsService;
    private readonly DASTStrategy _dastStrategy;

    public TestReportService(IBuildRepository buildRepository, SASTStrategy sastStrategy, DependencyTrackAnalyticsService scaAnalyticsService, DASTStrategy dastStrategy)
    {
        _buildRepository = buildRepository;
        _sastStrategy = sastStrategy;
        _scaAnalyticsService = scaAnalyticsService;
        _dastStrategy = dastStrategy;
    }

    public async Task<TestReport> GetReport(string buildId, string type)
    {

        var build = await _buildRepository.GetBuild(buildId);
        var repoName = build.RepoName.Replace("/", "-");
        TestReport? result = null;
        switch (type)
        {
            case "sast":
                _testToolContext = new TestingToolContext(_sastStrategy);
                result = await _testToolContext.getInfo(repoName, build.Branch);
                break;
            case "sca-container":
                result = await _scaAnalyticsService.getInfo(repoName, build.ImageName);
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

}