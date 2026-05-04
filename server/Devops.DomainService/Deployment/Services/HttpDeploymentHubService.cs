using System.Net.Http.Json;
using Devops.DomainService.Deployment.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services
{
    /// <summary>
    /// Fan-out implementation of <see cref="IDeploymentHubService"/> for processes that don't
    /// host the SignalR hub themselves (e.g. the Worker). It POSTs the payload to the API's
    /// internal broadcast endpoint, which then forwards it to connected SignalR clients.
    /// </summary>
    public class HttpDeploymentHubService : IDeploymentHubService
    {
        private const string HttpClientName = "deployment-hub";
        private const string BroadcastPath = "/api/DeploymentHubBroadcast/broadcast";
        private const string SecretHeader = "X-Internal-Secret";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<HttpDeploymentHubService> _logger;

        public HttpDeploymentHubService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<HttpDeploymentHubService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendBuildLogAsync(object payload, IReadOnlyCollection<string>? userIds = null)
        {
            var baseUrl = _configuration["DeploymentApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                _logger.LogWarning("[DeploymentHub] DeploymentApiBaseUrl is not configured; dropping notification.");
                return;
            }

            var secret = _configuration["InternalHubSecret"] ?? _configuration["RootTenantId"];
            if (string.IsNullOrWhiteSpace(secret))
            {
                _logger.LogWarning("[DeploymentHub] InternalHubSecret/RootTenantId is not configured; dropping notification.");
                return;
            }

            var url = baseUrl.TrimEnd('/') + BroadcastPath;
            var body = new BroadcastRequest
            {
                Payload = payload,
                UserIds = userIds?.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList() ?? new List<string>()
            };

            try
            {
                var client = _httpClientFactory.CreateClient(HttpClientName);
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = JsonContent.Create(body)
                };
                request.Headers.TryAddWithoutValidation(SecretHeader, secret);

                using var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[DeploymentHub] Broadcast call to {Url} failed: {Status} {Body}",
                        url, (int)response.StatusCode, content);
                }
                else
                {
                    _logger.LogInformation("[DeploymentHub] Broadcast forwarded to {Url} for {Count} user(s).",
                        url, body.UserIds.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DeploymentHub] Failed to call API broadcast endpoint at {Url}.", url);
            }
        }

        private sealed class BroadcastRequest
        {
            public object Payload { get; set; } = default!;
            public List<string> UserIds { get; set; } = new();
        }
    }
}
