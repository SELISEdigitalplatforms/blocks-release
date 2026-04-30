using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.RepositoryServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class AnalyticsToolController : Controller
    {
        private readonly ChangeControllerContext _changeControllerContext;
        private readonly DependencyTrackAuthService _dependencyTrackAuthService;
        private readonly DependencyTrackAnalyticsService _scaAnalyticsService;
        private readonly IBuildRepository _buildRepository;
        public AnalyticsToolController(DependencyTrackAuthService dependencyTrackAuthService, ChangeControllerContext changeControllerContext, DependencyTrackAnalyticsService scaAnalyticsService, IBuildRepository buildRepository)
        {
            _dependencyTrackAuthService = dependencyTrackAuthService;
            _changeControllerContext = changeControllerContext;
            _scaAnalyticsService = scaAnalyticsService;
            _buildRepository = buildRepository;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> ProcessDependencyTrackUser([FromQuery] string ProjectKey, string buildId)
        {
            _changeControllerContext.ChangeContext(new ProjectKeyQuery { ProjectKey = ProjectKey });
            var userName = BlocksContext.GetContext().UserName;
            var userId = BlocksContext.GetContext().UserId;
            var projectId = BlocksContext.GetContext().TenantId;
            Build build = await _buildRepository.GetBuild(buildId);
            if (build is not null)
            {
                var uuidRetrievieResult = await _scaAnalyticsService.RetrieveScaProjectUuid(build);
            }
            bool userCreationResult = await _dependencyTrackAuthService.ProcessDependenctytrackOidcUser(userName, projectId);
            return Ok(new BaseResponse()
            {
                IsSuccess = userCreationResult
            });
        }
    }
}
