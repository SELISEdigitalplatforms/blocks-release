using System.Net;
using Blocks.Genesis;
using Microsoft.Extensions.Logging;

using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using FluentValidation;
using Devops.DomainService.VersionControlSystems.Interfaces;

namespace Devops.DomainService.Deployment.Services;

public class VcsRepositoryService
{
    private readonly ILogger<VcsRepositoryService> _logger;
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly IValidator<RepoDomainUpdateRequest> _repoDomainUpdateRequestValidator;
    
    public VcsRepositoryService(
                        ILogger<VcsRepositoryService> logger,
                        IBuildRepository buildRepository,
                        IRepoRepository repoRepository,
                        IValidator<RepoDomainUpdateRequest> repoDomainUpdateRequestValidator)
    {
        _logger = logger;
        _buildRepository = buildRepository;
        _repoRepository = repoRepository;
        _repoDomainUpdateRequestValidator = repoDomainUpdateRequestValidator;
    }

    
    public async Task<Build?> GetBuildWithRepo(string buildId)
    {
        var builds = await _buildRepository.GetBuild(buildId);
        if (builds != null)
            return builds;
        return null;
    }

    public async Task<IReadOnlyList<RepoWithBuildsResponse>> GetRepos(string projectId)
    {
        var result = _repoRepository.GetReposWithBuildsAsync(projectId);
        return await result;
    }


    public async Task<BaseApiResponse> UpdateRepo(RepoUpdateRequest request)
    {
        try
        {
            Repo repo = await _repoRepository.GetRepo(request.RepoId);
            if (repo != null)
            {
                if (!string.IsNullOrWhiteSpace(request.HostingProviderId) && !string.IsNullOrWhiteSpace(request.RegionId) && !string.IsNullOrWhiteSpace(request.MachineConfigId))
                    request.deploySettings = await _repoRepository.GetDeploySettings(request.HostingProviderId, request.RegionId, request.MachineConfigId);

                if (!string.IsNullOrWhiteSpace(request.DeploymentType))
                {
                    if (string.Equals(request.DeploymentType, RepoDeploymentType.Auto, StringComparison.OrdinalIgnoreCase))
                    {
                        request.DeploymentType = RepoDeploymentType.Auto;
                    }
                    else
                    {
                        request.DeploymentType = RepoDeploymentType.Manual;
                    }

                    if (repo.DeploymentType != request.DeploymentType)
                    {

                    }
                }
                
                var result = await _repoRepository.UpdateRepo(request);
                if (result)
                {
                    return new BaseApiResponse()
                    {
                        IsSuccess = true,
                        Message = "Repository updated successfully.",
                        StatusCode = HttpStatusCode.OK
                    };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to update repository for {ex.Message}");
            return new BaseApiResponse()
            {
                IsSuccess = false,
                Message = $"Failed to update repository {ex.Message}",
                StatusCode = HttpStatusCode.OK
            };
        }


        return new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Repository not found.",
            StatusCode = HttpStatusCode.BadRequest
        };
    }
    public async Task<BaseApiResponse> UpdateRepoDomain(RepoDomainUpdateRequest request)
    {
        try
        {
            var validationResult = await _repoDomainUpdateRequestValidator.ValidateAsync(request);

            if (!validationResult.IsValid)
            {
                return new BuildResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => string.IsNullOrWhiteSpace(e.PropertyName) ? "validation_error" : e.PropertyName, e => e.ErrorMessage)
                };
            }

            List<RepoCustomDomain> repoCustomDomains = new List<RepoCustomDomain>();

            repoCustomDomains = await TransformToRepoCustomDomains(request);
            var saveresult = await _repoRepository.UpsertRepoCustomDomainsAsync(repoCustomDomains);

            var bulkUpdateResult = await _repoRepository.UpdateRepoDomain(request);
            if (saveresult.IsAcknowledged && bulkUpdateResult.IsAcknowledged)
            {
                return new BuildResponse
                {
                    IsSuccess = true,
                    Message = $"Modified: {bulkUpdateResult.ModifiedCount} repository custom domains",
                    StatusCode = HttpStatusCode.OK
                };
            }
            return new BuildResponse
            {
                IsSuccess = false,
                Message = "Something went wrong.",
                StatusCode = HttpStatusCode.OK
            };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to update repository domains for {ex.Message}");
            return new BuildResponse
            {
                IsSuccess = false,
                Message = ex.Message,
                StatusCode = HttpStatusCode.BadRequest
            };
        }

    }

    public async Task<List<RepoCustomDomain>> TransformToRepoCustomDomains(RepoDomainUpdateRequest request)
    {
        var result = new List<RepoCustomDomain>();
        try
        {

            var projectId = BlocksContext.GetContext()?.TenantId;
            if (request?.repoWithDomains == null || string.IsNullOrWhiteSpace(projectId))
                return result;

            var existingDomains = await _repoRepository.GetRepoCustomDomainsAsync(request.repoWithDomains, projectId);

            foreach (var repo in request.repoWithDomains)
            {
                if (string.IsNullOrWhiteSpace(repo.RepoId) || string.IsNullOrWhiteSpace(repo.CustomDeploymentDomain))
                    continue;

                var existing = existingDomains.FirstOrDefault(e =>
                    e.RepoId == repo.RepoId &&
                    e.ProjectId == projectId &&
                    e.ProjectEnv == request.ProjectEnv
                );

                if (existing != null)
                {
                    existing.CustomDeploymentDomain = repo.CustomDeploymentDomain;
                    result.Add(existing);
                }
                else
                {
                    var domainEntry = new RepoCustomDomain
                    {
                        ItemId = Guid.NewGuid().ToString(),
                        ProjectId = projectId,
                        ProjectEnv = request.ProjectEnv,
                        RepoId = repo.RepoId,
                        RepoUrl = repo.RepoUrl,
                        CustomDeploymentDomain = repo.CustomDeploymentDomain
                    };
                    result.Add(domainEntry);
                }

            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to update repository for {ex.Message}");
        }
        return result;
    }

}
