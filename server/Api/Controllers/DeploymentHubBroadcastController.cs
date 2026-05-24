using System.Text.Json;
using Devops.DomainService.Deployment.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Internal endpoint used by non-API processes (e.g. the Worker) to fan out
/// notifications through this API instance's SignalR hub. Authenticated via
/// a shared <c>X-Internal-Secret</c> header — never expose to public traffic.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("[controller]")]
public class DeploymentHubBroadcastController : ControllerBase
{
    private const string SecretHeader = "X-Internal-Secret";

    private readonly IDeploymentHubService _deploymentHubService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeploymentHubBroadcastController> _logger;

    public DeploymentHubBroadcastController(
        IDeploymentHubService deploymentHubService,
        IConfiguration configuration,
        ILogger<DeploymentHubBroadcastController> logger)
    {
        _deploymentHubService = deploymentHubService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> Broadcast(
        [FromHeader(Name = SecretHeader)] string? secret,
        [FromBody] BroadcastRequest request)
    {
        var expected = _configuration["InternalHubSecret"] ?? _configuration["RootTenantId"];
        if (string.IsNullOrWhiteSpace(expected) ||
            string.IsNullOrWhiteSpace(secret) ||
            !string.Equals(secret, expected, StringComparison.Ordinal))
        {
            _logger.LogWarning("[DeploymentHub] Rejected broadcast: missing or invalid {Header}.", SecretHeader);
            return Unauthorized();
        }

        if (request?.Payload is null)
        {
            return BadRequest("Payload is required.");
        }

        // Payload is bound as JsonElement so the JSON shape is preserved when re-serialized for SignalR clients.
        await _deploymentHubService.SendBuildLogAsync(request.Payload.Value, request.UserIds);
        return Ok();
    }

    public class BroadcastRequest
    {
        public JsonElement? Payload { get; set; }
        public List<string>? UserIds { get; set; }
    }
}
