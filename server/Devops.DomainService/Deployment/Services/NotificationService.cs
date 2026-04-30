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
        public NotificationService(
                                   ILogger<NotificationService> logger,
                                   ICryptoService cryptoService,
                                   ITenants tenants,
                                   IConfiguration configuration,
                                   IHttpHelperServices httpHelperServices)
        {
            _logger = logger;
            _cryptoService = cryptoService;
            _tenants = tenants;
            _configuration = configuration;
            _httpHelperServices = httpHelperServices;
        }

        public async Task<bool> NotifyPipeLineLogData(BuildEventResponse logData, List<string> UserIds, string TenantId, string RepoId, string BuildStatus)
        {
            _logger.LogInformation($"Sending notification to users : {string.Join(", ", UserIds)} -- {TenantId}");

            var requestData = new
            {
                ConnectionId = "",
                Roles = new List<string> { },
                UserIds = UserIds,
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    Message = logData,
                    RepoStatus = new
                    {
                        RepoId = RepoId,
                        BuildStatus = BuildStatus
                    }
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = _configuration["BlocksAppNotificationReceiver"],
                ContentAvailable = true,
                ResponseKey = "status",
                ResponseValue = "sent"
            };

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

        public async Task<bool> NotifyPipeLineLogData(List<BuildEventResponse> logData, List<string> UserIds, string TenantId, string RepoId, string BuildStatus)
        {
            _logger.LogInformation($"Sending notification to users : {string.Join(", ", UserIds)} -- {TenantId}");

            var requestData = new
            {
                ConnectionId = "",
                Roles = new List<string> { },
                UserIds = UserIds,
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    Message = logData,
                    RepoStatus = new
                    {
                        RepoId = RepoId,
                        BuildStatus = BuildStatus
                    }
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = _configuration["BlocksAppNotificationReceiver"],
                ContentAvailable = true,
                ResponseKey = "status",
                ResponseValue = "sent"
            };

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
