using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Heartbeat (InboundPing) monitor update and delete for the release UI. Same routes and response
/// envelope the client used on blocks-logic's HealthController, so only the client's base URL changed.
/// </summary>
[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    private readonly IHeartbeatConfigurationService _heartbeatConfigurationService;

    public HealthController(IHeartbeatConfigurationService heartbeatConfigurationService)
    {
        _heartbeatConfigurationService = heartbeatConfigurationService;
    }

    [HttpPost("UpdateHealth")]
    [ProtectedEndPoint("blocks-release::monitor::manage-health")]
    public Task<BaseApiResponse> UpdateHealth([FromBody] UpdateHealthRequest request)
        => _heartbeatConfigurationService.UpdateAsync(request);

    [HttpDelete("DeleteHealth")]
    [ProtectedEndPoint("blocks-release::monitor::manage-health")]
    public Task<BaseApiResponse> DeleteHealth([FromQuery] string itemId)
        => _heartbeatConfigurationService.DeleteAsync(itemId);
}
