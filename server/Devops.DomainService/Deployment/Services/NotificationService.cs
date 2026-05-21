using Blocks.Genesis;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Interfaces;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services
{
    public class NotificationService : INotificationService
    {
        private readonly ILogger<NotificationService> _logger;
        private readonly ICryptoService _cryptoService;
        private readonly ITenants _tenants;
        private readonly IConfiguration _configuration;
        private readonly IHttpHelperServices _httpHelperServices;
        private readonly IDeploymentHubService _deploymentHubService;

        public NotificationService(
                                   ILogger<NotificationService> logger,
                                   ICryptoService cryptoService,
                                   ITenants tenants,
                                   IConfiguration configuration,
                                   IHttpHelperServices httpHelperServices,
                                   IDeploymentHubService deploymentHubService)
        {
            _logger = logger;
            _cryptoService = cryptoService;
            _tenants = tenants;
            _configuration = configuration;
            _httpHelperServices = httpHelperServices;
            _deploymentHubService = deploymentHubService;
        }

        public async Task<bool> NotifyPipeLineLogData(BuildEventResponse logData, List<string> UserIds, string TenantId, string RepoId, string BuildStatus)
        {
            _logger.LogInformation($"Sending notification to users : {string.Join(", ", UserIds)} -- {TenantId}");

            var denormalizedPayload = JsonSerializer.Serialize(new
            {
                Message = logData,
                RepoStatus = new
                {
                    RepoId = RepoId,
                    BuildStatus = BuildStatus
                }
            });

            var requestData = new
            {
                ConnectionId = "",
                Roles = new List<string> { },
                UserIds = UserIds,
                DenormalizedPayload = denormalizedPayload,
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = _configuration["BlocksAppNotificationReceiver"],
                ContentAvailable = true,
                ResponseKey = "status",
                ResponseValue = "sent"
            };

            await _deploymentHubService.SendBuildLogAsync(requestData, UserIds);

            var blocksKey = _configuration["RootTenantId"];
            var tenantId = _configuration["RootTenantId"];
            // var salt = _tenants.GetTenantByID(tenantId)?.TenantSalt;
            var salt = "aG6eKPQVWkiEH5CpwUSOrQEzRqtAktvU6sBzsvq0Q3Gw";
            var actulalSecret = _cryptoService.Hash(tenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (response, result) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            if (response.isSuccess)
            {
                _logger.LogInformation($"Successfully sent notification to users : {string.Join(", ", UserIds)} -- {TenantId}");
            }
            else
            {
                _logger.LogError($"Failed to sent notification to users : {string.Join(", ", UserIds)} -- {TenantId}. Error :  {response.errors}");
            }
            return true;
        }

        public async Task<bool> NotifyPipeLineLogData(List<BuildEventResponse> logData, List<string> UserIds, string TenantId, string RepoId, string BuildStatus)
        {
            _logger.LogInformation($"Sending notification to users : {string.Join(", ", UserIds)} -- {TenantId}");

            var denormalizedPayload = JsonSerializer.Serialize(new
            {
                Message = logData,
                RepoStatus = new
                {
                    RepoId = RepoId,
                    BuildStatus = BuildStatus
                }
            });

            var requestData = new
            {
                ConnectionId = "",
                Roles = new List<string> { },
                UserIds = UserIds,
                DenormalizedPayload = denormalizedPayload,
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = _configuration["BlocksAppNotificationReceiver"],
                ContentAvailable = true,
                ResponseKey = "status",
                ResponseValue = "sent"
            };

            await _deploymentHubService.SendBuildLogAsync(requestData, UserIds);

            var blocksKey = _configuration["RootTenantId"];
            var tenantId = _configuration["RootTenantId"];
            var salt = _tenants.GetTenantByID(tenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(tenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (response, result) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            if (response.isSuccess)
            {
                _logger.LogInformation($"Successfully sent notification to users : {string.Join(", ", UserIds)} -- {TenantId}");
            }
            else
            {
                _logger.LogError($"Failed to sent notification to users : {string.Join(", ", UserIds)} -- {TenantId}. Error :  {response.errors}");
            }
            return true;
        }
    }
}
