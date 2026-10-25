using Devops.DomainService.Deployment.Interfaces;

namespace Devops.DomainService.AnalyticsTool.Services.Sca;

/// <summary>The build and repo stores, taken together by services that write to both.</summary>
public sealed record BuildAndRepoRepositories(IBuildRepository Builds, IRepoRepository Repos);
