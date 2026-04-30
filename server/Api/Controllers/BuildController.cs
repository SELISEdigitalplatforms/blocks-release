using System.Net;
using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class BuildController : ControllerBase
{
    private readonly BuildService _buildService;
    private readonly IBuildRepository _buildRepository;
    private readonly IRepoRepository _repoRepository;
    private readonly ChangeControllerContext _changeControllerContext;
    private readonly TestReportService _testReportService;
    private readonly IDataGatewayDeploymentService _dataGatewayDeploymentService;
    public BuildController(BuildService buildService, 
                           IBuildRepository buildRepository,
                           IRepoRepository repoRepository,
                           ChangeControllerContext changeControllerContext, 
                           TestReportService testReportService,
                           IDataGatewayDeploymentService dataGatewayDeploymentService)
    {
        _buildService = buildService;
        _changeControllerContext = changeControllerContext;
        _buildRepository = buildRepository;
        _testReportService = testReportService;
        _repoRepository = repoRepository;
        _dataGatewayDeploymentService = dataGatewayDeploymentService;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetById([FromQuery] string buildId, string ProjectKey)
    {
        _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
        var builds = await _buildService.GetBuildWithRepo(buildId);
        if(builds != null)
        {
            return Ok(new BaseApiResponse()
            {
                Data = builds,
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            });
        }
        return BadRequest(new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Failed to get builds.",
        });
    }

    [HttpGet("repos")]
    [Authorize]
    public async Task<IActionResult> GetRepos([FromQuery] string ProjectKey)
    {
        _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
        var repoWithBuilds = await _buildService.GetRepos(ProjectKey);
        if(repoWithBuilds != null)
        {
            return Ok(new BaseApiResponse()
            {
                Data = repoWithBuilds,
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            });
        }
            
        return BadRequest(new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Failed to get repos.",
        });
    }

    [HttpGet("repos-list")]
    [Authorize]
    public async Task<IActionResult> GetReposList([FromQuery] string ProjectKey)
    {
        _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
        var repoList = await _repoRepository.GetRepos();
        if (repoList != null)
        {
            return Ok(new BaseApiResponse()
            {
                Data = repoList,
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            });
        }

        return BadRequest(new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Failed to get repos.",
        });
    }

    [HttpGet("repo-details")]
    [Authorize]
    public async Task<IActionResult> GetRepoDetails([FromQuery] string ProjectKey, string RepoId)
    {
        _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
        try
        {
            var repoBuildList = await _repoRepository.GetRepoBuildList(RepoId);
            var repo = await _repoRepository.GetRepo(RepoId);
            if (repo is null)
            {
                return BadRequest(new BaseApiResponse()
                {
                    Data = new
                    {
                        Repo = repo,
                        Build = repoBuildList
                    },
                    IsSuccess = false,
                    StatusCode = HttpStatusCode.BadRequest
                });
            }
            return Ok(new BaseApiResponse()
            {
                Data = new {
                    Repo = repo,
                    Build = repoBuildList
                },
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            });
            
        }
        catch (Exception ex) 
        {
            return BadRequest(new BaseApiResponse()
            {
                IsSuccess = false,
                Message = ex.Message,
            });
        }
    }

    [HttpPost("repo-update")]
    [Authorize]
    public async Task<BaseApiResponse> RepoDomainUpdateRequest([FromBody] RepoDomainUpdateRequest request)
    {
        _changeControllerContext.ChangeContext(request);
        return await _buildService.UpdateRepoDomain(request);
  
    }

    [HttpPost("run-build")]
    [Authorize]
    public async Task<IActionResult> RunBuild([FromBody] RepoBuildRequest request)
    {
        if (string.IsNullOrEmpty(request.RepoId))
            return BadRequest(new BaseApiResponse()
            {
                IsSuccess = false,
                StatusCode= HttpStatusCode.BadRequest,
                Message = "Repo id is required"
            });
        _changeControllerContext.ChangeContext(request);
        var response = await _buildService.RunBuild(request);
        if (response.StatusCode == HttpStatusCode.OK) return Ok(response);
        return BadRequest(response);
    }

    [HttpPost("manual")]
    [Authorize]
    public async Task<ActionResult<BuildResponse>> ManualBuild([FromBody] RepoBuildRequest request)
    {
        if (string.IsNullOrEmpty(request.RepoId))
        {
            return BadRequest(new BaseApiResponse()
            {
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest,
                Message = "Repo id is required"
            });
        }
        _changeControllerContext.ChangeContext(request);
        var response = await _buildService.ManualBuild(request);
        if (response.StatusCode == HttpStatusCode.OK) return Ok(response);
        return BadRequest(response);

    }

    [HttpPost("repo-settings-update")]
    [Authorize]
    public async Task<IActionResult> RepoSettingsUpdate([FromBody] RepoUpdateRequest request)
    {
        _changeControllerContext.ChangeContext(request);
        var response =  await _buildService.UpdateRepo(request);
        return Ok(response);
    }

    [HttpGet("settings")]
    [Authorize]
    public async Task<IActionResult> GetHostingProviders()
    {
        List<HostingProvider> providers = await _buildRepository.GetHostingProviders();

        return Ok(new HostingProvidersResponse()
        {
            IsSuccess = true,
            Data = providers,
            StatusCode = HttpStatusCode.OK
        });
    }
    
    [HttpGet("reports")]
    [Authorize]
    public async Task<IActionResult> GetReports([FromQuery]  string buildId, string type, string ProjectKey)
    {
        _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
        var result = await _testReportService.GetReport(buildId, type);
        return Ok(new BaseApiResponse()
        {
            IsSuccess = true,
            StatusCode= HttpStatusCode.OK,
            Data = result
        });
    }

    [ApiExplorerSettings(IgnoreApi = true)]
    [HttpGet("DatagatewayPipelineInitiate")]
    [Authorize]
    public async Task<IActionResult> DatagatewayPipelineInitiate([FromQuery] string projectKey)
    {
        var result = await _dataGatewayDeploymentService.InitiateManualDataGatewayInstanceCreation(projectKey);
        if (result)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }

}