using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.AnalyticsTool.Services.Sca;

public interface IDependencyTrackAnalyticsService
{
    Task<TestReport> getInfo(string repoName, string version);
    Task<string> RetrieveScaProjectUuid(Build build);
}
