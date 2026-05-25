using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.TestingTools;

public class TestingToolContext
{
    private IStrategy strategy;

    public TestingToolContext(IStrategy strategy)
    {
        this.strategy = strategy;
    }

    public Task<TestReport> getInfo(string repoName, string branchName)
    {
        return strategy.getInfo(repoName, branchName);
    }
}