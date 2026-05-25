using Devops.DomainService.AnalyticsTool.Models;

namespace Devops.DomainService.AnalyticsTool.Services.Sast
{
    public interface ISonarQubeAuthService
    {
        Task<bool> ProcessSonarQubeUser(string userName, string repoName, string projectGroupKey);
        Task<SonarQubeUserResponse> SearchUser(string email);
        Task<SonarQubeUserResponse> CreateUser(string userName);
        Task<bool> UpdateUserOidcProvider(string userId, string email);
        Task<SonarQubeGroupResponse> SearchGroup(string groupName);
        Task<SonarQubeGroupResponse> CreateGroup(string groupName);
        Task<bool> AddUserToGroup(string userId, string groupId);
        Task<bool> AssignUserPermission(string repoName, string groupName, string[] permissions);
    }
}
