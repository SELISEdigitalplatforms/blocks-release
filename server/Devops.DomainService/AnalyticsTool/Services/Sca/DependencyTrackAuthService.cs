using System.Net;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools.Entity;
using Devops.DomainService.TestingTools.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.AnalyticsTool.Services.Sca
{
    public class DependencyTrackAuthService : IDependencyTrackAuthService
    {
        private readonly ILogger<DependencyTrackAuthService> _logger;
        private readonly IHttpHelperServices _httpHelperServices;
        private readonly IConfiguration _configuration;
        private readonly DependencyTrackRepositoryService _dependencyTrackRepositoryService;
        private readonly ICloudBuildSecret _cloudBuildSecret;

        public DependencyTrackAuthService(ILogger<DependencyTrackAuthService> logger, IHttpHelperServices httpHelperServices, IConfiguration configuration, DependencyTrackRepositoryService dependencyTrackRepositoryService, ICloudBuildSecret cloudBuildSecret)
        {
            _logger = logger;
            _httpHelperServices = httpHelperServices;
            _configuration = configuration;
            _dependencyTrackRepositoryService = dependencyTrackRepositoryService;
            _cloudBuildSecret = cloudBuildSecret;
        }


        public async Task<bool> ProcessDependencyTrackOidcUser(string username, string projectName)
        {
            var userCreated = await CreateDependencyTrackOidcUser(username);
            if (!userCreated)
            {
                _logger.LogWarning("Failed to create user : {Username}", username);
            }

            var dependencyTrackDefaultTeamId = _cloudBuildSecret.DependencyTrackDefaultTeamId;
            var defaultTeamAdded = await AddDependencyTrackOidcTeam(username, dependencyTrackDefaultTeamId);
            if (!defaultTeamAdded)
            {
                _logger.LogWarning("Failed to add user {Username} to team {TeamId} or membership already exists.", username, dependencyTrackDefaultTeamId);
            }

            var dependencyTrackProject = await EnsureDependencyTrackProjectExists(projectName);
            if (dependencyTrackProject is not null)
            {
                if (dependencyTrackProject.ProjectTeamUuid is not null && dependencyTrackProject.RepoProjects.Count > 0)
                {
                    var projectTeamAdded = await AddDependencyTrackOidcTeam(username, dependencyTrackProject.ProjectTeamUuid);
                    if (!projectTeamAdded)
                    {
                        _logger.LogWarning("Failed to add user {Username} to team {TeamId} or membership already exists.", username, dependencyTrackProject.ProjectTeamUuid);
                    }
                    foreach (var repo in dependencyTrackProject.RepoProjects)
                    {
                        var teamMapped = await MapDependencyTrackTeamToProject(dependencyTrackProject.ProjectTeamUuid, repo.ProjectUuid);
                        if (!teamMapped)
                        {
                            _logger.LogWarning("Failed to map team {TeamUuid} to project {ProjectUuid} or mapping already exists.", dependencyTrackProject.ProjectTeamUuid, repo.ProjectUuid);
                        }
                    }
                }
                return false;
            }
            return true;
        }

        public async Task<DependencyTrackProjects> EnsureDependencyTrackProjectExists(string projectName)
        {
            var projectId = BlocksContext.GetContext().TenantId;

            DependencyTrackProjects existingProject = await _dependencyTrackRepositoryService.GetDependencyTrackProject(projectId);
            if (existingProject is not null && existingProject.ProjectTeamUuid is not null)
            {
                _logger.LogInformation("DependencyTrack project already exists for projectId {ProjectId}", projectId);
                return existingProject;
            }

            if (existingProject is null)
            {
                existingProject = new DependencyTrackProjects
                {
                    ItemId = Guid.NewGuid().ToString(),
                    ProjectId = projectId,
                    ProjectName = projectName,
                    RepoProjects = new List<RepoProject>()
                };
            }

            var teamCreated = await CreateDependencyTrackOidcTeam(projectName);
            if (teamCreated is null)
            {
                _logger.LogWarning("Failed to create DependencyTrack team with name {ProjectName}", projectName);
            }
            else
            {
                existingProject.ProjectTeamUuid = teamCreated.uuid;
                existingProject.ProjectTeamName = teamCreated.name;
            }

            await _dependencyTrackRepositoryService.SaveDependencyTrackProject(existingProject);
            _logger.LogInformation("DependencyTrack project created for projectId {ProjectId}", projectId);

            return existingProject;
        }


        public async Task<bool> CreateDependencyTrackOidcUser(string oidcUsername)
        {
            var url = $"{_configuration["DependencyTrackBaseUrl"]}/user/oidc";
            var dependencyTrackApiKey = _cloudBuildSecret.DependencyTrackApiKey;
            var payload = new
            {
                username = oidcUsername
            };
            var headers = new Dictionary<string, string>
            {
                { "Content-Type", "application/json" },
                { "Accept", "*/*" },
                { "X-Api-Key", dependencyTrackApiKey }
            };
            var (_, response) = await _httpHelperServices.MakeHttpRequest<object>(_configuration["ScaToolsApiBaseUri"], url, HttpMethod.Put, payload, headers);
            if (response.StatusCode == HttpStatusCode.Created)
            {
                _logger.LogInformation("Dependency track user created with oidc protocol with username {Username}", oidcUsername);
                return true;
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("Dependency track user already exists with oidc protocol with username {Username}", oidcUsername);
                return false;
            }
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Failed to create dependency track user with username {Username} for {ErrorContent}", oidcUsername, errorContent);
                return false;
            }
            return false;
        }

        public async Task<bool> AddDependencyTrackOidcTeam(string username, string uuid)
        {
            var url = $"{_configuration["DependencyTrackBaseUrl"]}/user/{username}/membership";
            var dependencyTrackApiKey = _cloudBuildSecret.DependencyTrackApiKey;
            var payload = new
            {
                uuid
            };
            var headers = new Dictionary<string, string>
            {
                { "Content-Type", "application/json" },
                { "X-Api-Key", dependencyTrackApiKey }
            };
            var (_, response) = await _httpHelperServices.MakeHttpRequest<object>(
                _configuration["ScaToolsApiBaseUri"], url, HttpMethod.Post, payload, headers, null);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Dependency track team membership added for user {Username} with uuid {Uuid}", username, uuid);
            }
            if (response.StatusCode == HttpStatusCode.NotModified)
            {
                _logger.LogInformation("Dependency track team membership already exists for user {Username} with uuid {Uuid}", username, uuid);
                return false;
            }
            return true;
        }

        public async Task<DependencyTrackTeamCreateResponse> CreateDependencyTrackOidcTeam(string teamName)
        {
            var url = $"{_configuration["DependencyTrackBaseUrl"]}/team";
            var dependencyTrackApiKey = _cloudBuildSecret.DependencyTrackApiKey;
            var payload = new
            {
                name = teamName
            };
            var headers = new Dictionary<string, string>
            {
                { "Content-Type", "application/json" },
                { "X-Api-Key", dependencyTrackApiKey }
            };

            var (result, response) = await _httpHelperServices.MakeHttpRequest<DependencyTrackTeamCreateResponse>(
                _configuration["ScaToolsApiBaseUri"], url, HttpMethod.Put, payload, headers, null);

            if (response.StatusCode == HttpStatusCode.Created)
            {
                _logger.LogInformation("Dependency track team created with name {TeamName} and team uuid {TeamUuid}", teamName, result.uuid);
                return result;
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("Dependency track team already exists with name {TeamName}", teamName);
                return null;
            }
            return null;
        }



        public async Task<bool> MapDependencyTrackTeamToProject(string teamUuid, string projectUuid)
        {
            var url = $"{_configuration["DependencyTrackBaseUrl"]}/acl/mapping";
            var dependencyTrackApiKey = _cloudBuildSecret.DependencyTrackApiKey;
            var payload = new
            {
                team = teamUuid,
                project = projectUuid
            };
            var headers = new Dictionary<string, string>
            {
                { "Content-Type", "application/json" },
                { "X-Api-Key", dependencyTrackApiKey }
            };
            var (_, response) = await _httpHelperServices.MakeHttpRequest<object>(
                _configuration["ScaToolsApiBaseUri"], url, HttpMethod.Put, payload, headers, null);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Dependency track team {TeamUuid} mapped to project {ProjectUuid}", teamUuid, projectUuid);
            }
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                _logger.LogInformation("Dependency track team {TeamUuid} is already mapped to project {ProjectUuid}", teamUuid, projectUuid);
                return false;
            }
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                _logger.LogInformation("Invalid payload for team {TeamUuid} is already mapped to project {ProjectUuid}", teamUuid, projectUuid);
                return false;
            }
            return true;
        }
    }
}
