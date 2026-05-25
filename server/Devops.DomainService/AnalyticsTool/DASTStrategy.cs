using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.TestingTools;

public class DASTStrategy : IStrategy
{
    public Task<TestReport> getInfo(string repoName, string branchName)
    {
        return Task.FromResult(new TestReport());
    }
}