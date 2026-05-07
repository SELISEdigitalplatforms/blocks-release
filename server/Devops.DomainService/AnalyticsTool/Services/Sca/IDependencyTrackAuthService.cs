using Devops.DomainService.TestingTools.Entity;
using Devops.DomainService.TestingTools.Models;

namespace Devops.DomainService.AnalyticsTool.Services.Sca;

public interface IDependencyTrackAuthService
{
    Task<bool> ProcessDependencyTrackOidcUser(string username, string projectName);
    Task<DependencyTrackProjects> EnsureDependencyTrackProjectExists(string projectName);
    Task<bool> CreateDependencyTrackOidcUser(string oidcUsername);
    Task<bool> AddDependencyTrackOidcTeam(string username, string uuid);
    Task<DependencyTrackTeamCreateResponse> CreateDependencyTrackOidcTeam(string teamName);
    Task<bool> MapDependencyTrackTeamToProject(string teamUuid, string projectUuid);
}
