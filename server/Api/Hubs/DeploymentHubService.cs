using Devops.DomainService.Deployment.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace BlocksTemplate.Api.Hubs
{
    public class DeploymentHubService : IDeploymentHubService
    {
        private const string EventName = "BuildLogNotification";

        private readonly IHubContext<DeploymentLogHub> _hubContext;
        private readonly ILogger<DeploymentHubService> _logger;

        public DeploymentHubService(IHubContext<DeploymentLogHub> hubContext, ILogger<DeploymentHubService> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        public async Task SendBuildLogAsync(object payload, IReadOnlyCollection<string>? userIds = null)
        {
            var targetGroups = userIds?
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            if (targetGroups is null || targetGroups.Count == 0)
            {
                _logger.LogInformation("[DeploymentHub] Broadcasting {Event} to all clients.", EventName);
                await _hubContext.Clients.All.SendAsync(EventName, payload);
                return;
            }

            _logger.LogInformation("[DeploymentHub] Sending {Event} to {Count} user group(s): {UserIds}",
                EventName, targetGroups.Count, string.Join(",", targetGroups));

            await _hubContext.Clients.Groups(targetGroups).SendAsync(EventName, payload);
        }
    }
}
