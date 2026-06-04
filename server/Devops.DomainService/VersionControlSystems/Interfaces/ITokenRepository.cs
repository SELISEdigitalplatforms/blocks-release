using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Models.Response;

namespace Devops.DomainService.VersionControlSystems.Interfaces;

public interface ITokenRepository
{
    public Task<bool> saveToken(RepositoryToken repositoryToken);
    public Task<RepositoryToken> getToken();
    public Task<string> getToken(string userId);
    public Task<List<RepositoryToken>> getTokens();
    public Task UpdateUsernameAsync(string id, List<UserOrganizations> orgs);
    public Task<bool> DeleteTokenAsync();
    public Task<bool> DeleteTokenAsync(string blocksUserId);
    public Task<User> GetUserByIdAsync(string itemId);
}