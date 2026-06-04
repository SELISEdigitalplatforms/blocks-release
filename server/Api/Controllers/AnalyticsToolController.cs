using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sast;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.RepositoryServices;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class AnalyticsToolController : Controller
    {
        private readonly DependencyTrackAuthService _dependencyTrackAuthService;
        private readonly DependencyTrackAnalyticsService _scaAnalyticsService;
        private readonly IBuildRepository _buildRepository;
        private readonly ISonarQubeAuthService _sonarQubeAuthService;
        private readonly ITokenRepository _tokenRepository;


        public AnalyticsToolController(DependencyTrackAuthService dependencyTrackAuthService, DependencyTrackAnalyticsService scaAnalyticsService, IBuildRepository buildRepository, ISonarQubeAuthService sonarQubeAuthService, ITokenRepository tokenRepository)
        {
            _dependencyTrackAuthService = dependencyTrackAuthService;
            _scaAnalyticsService = scaAnalyticsService;
            _buildRepository = buildRepository;
            _sonarQubeAuthService = sonarQubeAuthService;
            _tokenRepository = tokenRepository;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> ProcessDependencyTrackUser([FromQuery] string buildId)
        {
            var userId = BlocksContext.GetContext()?.UserId;
            var user = await _tokenRepository.GetUserByIdAsync(userId);
            var projectId = BlocksContext.GetContext()?.TenantId;
            var userName = user?.UserName;
            var build = await _buildRepository.GetBuild(buildId);
            if (build is not null)
            {
                var uuidRetrievedResult = await _scaAnalyticsService.RetrieveScaProjectUuid(build);
            }
            bool userCreationResult = await _dependencyTrackAuthService.ProcessDependencyTrackOidcUser(userName, projectId);
            return Ok(new BaseResponse()
            {
                IsSuccess = userCreationResult
            });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> ProcessSonarQubeUser([FromQuery] string ProjectKey, string buildId)
        {
            var userId = BlocksContext.GetContext()?.UserId;
            var user = await _tokenRepository.GetUserByIdAsync(userId);
            var build = await _buildRepository.GetBuild(buildId);
            var userName = user?.UserName;
            if (build is null || string.IsNullOrEmpty(userName))
            {
                return BadRequest(new BaseApiResponse()
                {
                    IsSuccess = false,
                    Message = "Invalid buildId"
                });
            }
            bool result = await _sonarQubeAuthService.ProcessSonarQubeUser(userName, build.RepoName, ProjectKey);
            return Ok(new BaseResponse()
            {
                IsSuccess = result
            });
        }
    }
}
