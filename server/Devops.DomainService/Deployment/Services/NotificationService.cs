using Blocks.Genesis.Entities.Release;
using Blocks.Genesis;
using Blocks.Genesis.Notifications;
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
        private readonly INotificationPublisher _publisher;

        public NotificationService(
                                   ILogger<NotificationService> logger,
                                   ICryptoService cryptoService,
                                   ITenants tenants,
                                   IConfiguration configuration,
                                   IHttpHelperServices httpHelperServices,
                                   IDeploymentHubService deploymentHubService,
                                   INotificationPublisher publisher)
        {
            _logger = logger;
            _cryptoService = cryptoService;
            _tenants = tenants;
            _configuration = configuration;
            _httpHelperServices = httpHelperServices;
            _deploymentHubService = deploymentHubService;
            _publisher = publisher;
        }

        /// <summary>Distinct, non-empty user ids.</summary>
        public static List<string> BuildRecipients(IEnumerable<string?>? people, params string?[] extra) =>
            (people ?? Enumerable.Empty<string?>()).Concat(extra ?? Array.Empty<string?>())
                .Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u!).Distinct().ToList();

        /// <summary>Project people of a tenant plus extra ids. A failed lookup yields only the extra ids.</summary>
        public static async Task<List<string>> ResolveRecipientsAsync(IRepoRepository repoRepository, ILogger logger, string tenantId, params string?[] extra)
        {
            List<string>? people = null;
            try { people = await repoRepository.GetProjectPeopleList(tenantId); }
            catch (Exception ex) { logger.LogWarning(ex, "Built-in notification: project people lookup failed. tenant={TenantId} error={ErrorType}", tenantId, ex.GetType().Name); }
            return BuildRecipients(people, extra);
        }

        /// <summary>Payload with the common fields: ids and short text only.</summary>
        public static Dictionary<string, object?> BuildPayload(string eventName, string title, string description, bool? isSuccess, params (string Key, object? Value)[] ids)
        {
            var payload = new Dictionary<string, object?>
            {
                ["event"] = eventName,
                ["title"] = title,
                ["description"] = description,
                ["occurredAt"] = DateTime.UtcNow
            };
            if (isSuccess.HasValue) payload["isSuccess"] = isSuccess.Value;
            foreach (var (key, value) in ids) payload[key] = value;
            return payload;
        }

        /// <summary>Null-safe, never-throwing call for use at action sites.</summary>
        public static async Task SafeSendAsync(INotificationService? service, ILogger logger, string? tenantId, string configurationName, IEnumerable<string?> userIds, IDictionary<string, object?> payload)
        {
            if (service is null || string.IsNullOrWhiteSpace(tenantId)) return;
            try { await service.SendBuiltInAsync(tenantId, configurationName, userIds, payload); }
            catch (Exception ex) { logger.LogWarning(ex, "Built-in notification failed. config={ConfigurationName} tenant={TenantId} status={ErrorType}", configurationName, tenantId, ex.GetType().Name); }
        }

        /// <summary>
        /// The named users of a send: the given users plus, when a root user acts inside a project (impersonated),
        /// the acting user, so console users get the notification too.
        /// </summary>
        public static List<string> NamedUsers(IEnumerable<string?>? userIds, BlocksContext? context)
        {
            var named = BuildRecipients(userIds);
            if (context is { Impersonated: true } && !string.IsNullOrWhiteSpace(context.UserId) && !named.Contains(context.UserId))
                named.Add(context.UserId);
            return named;
        }

        public Task<bool> SendBuiltInAsync(string tenantId, string configurationName, IEnumerable<string?> userIds, IDictionary<string, object?> payload)
        {
            if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(configurationName))
                return Task.FromResult(false);

            var context = BlocksContext.GetContext();

            // Publish returns at once and never throws; who receives it is decided by the notification config.
            _publisher.Publish(new NotificationRequest
            {
                Name = configurationName,
                TenantId = tenantId,
                NamedUserIds = NamedUsers(userIds, context),
                OrganizationId = context?.OrganizationId,
                Payload = payload
            });
            return Task.FromResult(true);
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
                ConfigurationName = _configuration["BlocksAppNotificationReceiver"],
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
                ConfigurationName = _configuration["BlocksAppNotificationReceiver"],
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
