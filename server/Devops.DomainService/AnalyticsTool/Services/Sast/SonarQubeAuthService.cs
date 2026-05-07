using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.AnalyticsTool.Services.Sast
{
    public class SonarQubeAuthService : ISonarQubeAuthService
    {
        private readonly ILogger<SonarQubeAuthService> _logger;
        private readonly IHttpHelperServices _httpHelperServices;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ICloudBuildSecret _cloudBuildSecret;
        private readonly IConfiguration _configuration;

        public SonarQubeAuthService(
            ILogger<SonarQubeAuthService> logger,
            IHttpHelperServices httpHelperServices,
            IHttpClientFactory httpClientFactory,
            ICloudBuildSecret cloudBuildSecret,
            IConfiguration configuration)
        {
            _logger = logger;
            _httpHelperServices = httpHelperServices;
            _httpClientFactory = httpClientFactory;
            _cloudBuildSecret = cloudBuildSecret;
            _configuration = configuration;
        }

        public async Task<bool> ProcessSonarQubeUser(string userName, string repoName, string projectGroupKey)
        {
            // Step 1 — User Handling
            var existingUser = await SearchUser(userName);
            string userId;
            string userLogin;
            if(repoName == null)
            {
                _logger.LogWarning("Repository name is null. Cannot assign permissions without a valid repository name.");
                return false;
            }

            repoName = repoName.Replace("/", "-");

            if (existingUser is null)
            {
                var createdUser = await CreateUser(userName);
                if (createdUser is null)
                {
                    _logger.LogWarning("Failed to create SonarQube user: {UserName}", userName);
                    return false;
                }

                userId = createdUser.id;
                userLogin = createdUser.login;

                var oidcUpdated = await UpdateUserOidcProvider(userId, userName);
                if (!oidcUpdated)
                {
                    _logger.LogWarning("Failed to set OIDC provider for SonarQube user: {UserName}", userName);
                }
            }
            else
            {
                userId = existingUser.id;
                userLogin = existingUser.login;
            }

            // Step 2 — Group Handling
            var groupName = $"Blocks_{projectGroupKey}";
            var existingGroup = await SearchGroup(groupName);
            string groupId;

            if (existingGroup is null)
            {
                var createdGroup = await CreateGroup(groupName);
                if (createdGroup is null)
                {
                    _logger.LogWarning("Failed to create SonarQube group: {GroupName}", groupName);
                    return false;
                }

                groupId = createdGroup.id;
            }
            else
            {
                groupId = existingGroup.id;
            }

            // Step 3 — Add User to Group
            var membershipAdded = await AddUserToGroup(userId, groupId);
            if (!membershipAdded)
            {
                _logger.LogWarning("Failed to add user {UserLogin} to group {GroupName} or membership already exists.", userLogin, groupName);
            }

            // Step 4 — Assign Permissions
            var permissionAssigned = await AssignUserPermission(repoName, groupName, CloudBuildConstants.SONARQUBE_PERMISSIONS);
            if (!permissionAssigned)
            {
                _logger.LogWarning("One or more permission assignments failed for group {GroupName} on project {RepoName}.", groupName, repoName);
            }

            return true;
        }

        private Dictionary<string, string> BearerAuthHeaders()
        {
            return new Dictionary<string, string>
            {
                { "Authorization", $"Bearer {_cloudBuildSecret.SonarQubeToken}" }
            };
        }

        public async Task<SonarQubeUserResponse> SearchUser(string email)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/users-management/users?q={Uri.EscapeDataString(email)}";
            var headers = BearerAuthHeaders();

            var (result, _) = await _httpHelperServices.MakeHttpGetRequest<SonarQubeUserSearchResponse>(url, null, headers);
            if (result?.users is not null && result.users.Count > 0)
            {
                var match = result.users.FirstOrDefault(u =>
                    string.Equals(u.login, email, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(u.email, email, StringComparison.OrdinalIgnoreCase));

                _logger.LogInformation(match is not null
                    ? "SonarQube user found: {Email}"
                    : "SonarQube user search returned results but no exact match for: {Email}", email);

                return match;
            }

            _logger.LogInformation("SonarQube user not found: {Email}", email);
            return null;
        }

        public async Task<SonarQubeUserResponse> CreateUser(string userName)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/users-management/users";
            var payload = new
            {
                login = userName,
                name = userName,
                email = userName,
                local = false
            };
            var headers = BearerAuthHeaders();
            headers["Content-Type"] = "application/json";

            var (result, response) = await _httpHelperServices.MakeHttpRequest<SonarQubeUserResponse>(
                _configuration["SonarQubeBaseUri"], url, HttpMethod.Post, payload, headers);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SonarQube user created: {UserName}", userName);
                return result;
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("SonarQube user already exists: {UserName}", userName);
                return null;
            }

            _logger.LogError("Failed to create SonarQube user: {UserName}, Status: {StatusCode}", userName, response.StatusCode);
            return null;
        }

        public async Task<bool> UpdateUserOidcProvider(string userId, string email)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/users-management/users/{userId}";
            var payload = new
            {
                externalProvider = "oidc",
                externalLogin = email
            };

            var client = _httpClientFactory.CreateClient(_configuration["SonarQubeBaseUri"]);
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _cloudBuildSecret.SonarQubeToken);

            var json = JsonSerializer.Serialize(payload);
            var request = new HttpRequestMessage(HttpMethod.Patch, url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/merge-patch+json")
            };

            var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SonarQube user OIDC provider updated for user: {UserId}", userId);
                return true;
            }

            _logger.LogError("Failed to update OIDC provider for SonarQube user: {UserId}, Status: {StatusCode}", userId, response.StatusCode);
            return false;
        }

        public async Task<SonarQubeGroupResponse> SearchGroup(string groupName)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/authorizations/groups?q={Uri.EscapeDataString(groupName)}";
            var headers = BearerAuthHeaders();

            var (result, _) = await _httpHelperServices.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(url, null, headers);
            if (result?.groups is not null && result.groups.Count > 0)
            {
                var match = result.groups.FirstOrDefault(g =>
                    string.Equals(g.name, groupName, StringComparison.OrdinalIgnoreCase));

                if (match is not null)
                    _logger.LogInformation("SonarQube group found: {GroupName}", groupName);
                else
                    _logger.LogInformation("SonarQube group search returned results but no exact match for: {GroupName}", groupName);

                return match;
            }

            _logger.LogInformation("SonarQube group not found: {GroupName}", groupName);
            return null;
        }

        public async Task<SonarQubeGroupResponse> CreateGroup(string groupName)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/authorizations/groups";
            var payload = new
            {
                name = groupName,
                description = ""
            };
            var headers = BearerAuthHeaders();
            headers["Content-Type"] = "application/json";

            var (result, response) = await _httpHelperServices.MakeHttpRequest<SonarQubeGroupResponse>(
                _configuration["SonarQubeBaseUri"], url, HttpMethod.Post, payload, headers);

            if (response.StatusCode == HttpStatusCode.Created || response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SonarQube group created: {GroupName}", groupName);
                return result;
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("SonarQube group already exists: {GroupName}", groupName);
                return null;
            }

            _logger.LogError("Failed to create SonarQube group: {GroupName}, Status: {StatusCode}", groupName, response.StatusCode);
            return null;
        }

        public async Task<bool> AddUserToGroup(string userId, string groupId)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/v2/authorizations/group-memberships";
            var payload = new
            {
                userId,
                groupId
            };
            var headers = BearerAuthHeaders();
            headers["Content-Type"] = "application/json";

            var (_, response) = await _httpHelperServices.MakeHttpRequest<object>(
                _configuration["SonarQubeBaseUri"], url, HttpMethod.Post, payload, headers);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("User {UserId} added to group {GroupId} in SonarQube.", userId, groupId);
                return true;
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("User {UserId} is already a member of group {GroupId} in SonarQube.", userId, groupId);
                return false;
            }

            _logger.LogError("Failed to add user {UserId} to group {GroupId} in SonarQube, Status: {StatusCode}", userId, groupId, response.StatusCode);
            return false;
        }

        public async Task<bool> AssignUserPermission(string repoName, string groupName, string[] permissions)
        {
            var url = $"{_configuration["SonarQubeBaseUri"]}/api/permissions/add_group";

            var client = _httpClientFactory.CreateClient(_configuration["SonarQubeBaseUri"]);
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_cloudBuildSecret.SonarQubeToken}:"));
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", credentials);

            var allSucceeded = true;
            foreach (var permission in permissions)
            {
                var formBody = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("projectKey", repoName),
                    new KeyValuePair<string, string>("groupName", groupName),
                    new KeyValuePair<string, string>("permission", permission)
                });

                var response = await client.PostAsync(url, formBody);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Assigned '{Permission}' permission to group {GroupName} on project {RepoName} in SonarQube.", permission, groupName, repoName);
                }
                else
                {
                    _logger.LogError("Failed to assign '{Permission}' permission to group {GroupName} on project {RepoName} in SonarQube, Status: {StatusCode}", permission, groupName, repoName, response.StatusCode);
                    allSucceeded = false;
                }
            }

            return allSucceeded;
        }
    }
}
