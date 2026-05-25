using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.TestingTools;

public interface IStrategy
{
    public Task<TestReport> getInfo(string repoName, string branchName);
}