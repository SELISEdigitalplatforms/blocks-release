using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Devops.DomainService.Deployment.Services;

/// <summary>
/// Creates the Blocks Monitor entry a user opts into on a repository's first deployment. It does what
/// blocks-monitor's own "Add monitor" does: insert into its MonitorConfigurations collection (which
/// lives in the shared root database), then nudge its worker over the queue to schedule the monitor.
/// </summary>
public class MonitorProvisioningService : IMonitorProvisioningService
{
    public const string MonitorConfigurationsCollection = "MonitorConfigurations";
    public const string MonitorConfigurationUpdateListener = "blocks_alert_monitor_config_update_listener";

    // The "Add monitor" form's defaults, converted the way that form converts them on submit.
    private const int DefaultIntervalInSeconds = 60;
    private const int DefaultTimeoutInSeconds = 30;
    private const string EmptyCustomHttpHeaders = "{\"\":\"\"}";

    private readonly ILogger<MonitorProvisioningService> _logger;
    private readonly IMongoCollection<MonitorConfiguration> _monitorConfigurations;
    private readonly IMessageClient _messageClient;

    public MonitorProvisioningService(
        ILogger<MonitorProvisioningService> logger,
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        IMessageClient messageClient)
    {
        _logger = logger;
        _messageClient = messageClient;
        var db = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
        _monitorConfigurations = db.GetCollection<MonitorConfiguration>(MonitorConfigurationsCollection);
    }

    public async Task<string?> CreateMonitorForRepoAsync(Repo repo)
    {
        var monitor = BuildMonitor(repo, BlocksContext.GetContext()?.UserId, DateTime.UtcNow);
        if (monitor is null)
            return "The repository has no deployment URL to monitor.";

        try
        {
            // blocks-monitor allows one monitor per deployed repo; a retried first deploy must not add a second.
            var existing = await _monitorConfigurations.CountDocumentsAsync(
                m => m.TenantId == monitor.TenantId && m.RepoId == monitor.RepoId);
            if (existing > 0)
            {
                _logger.LogInformation("Repo {RepoId} already has a Blocks Monitor entry; skipping.", repo.ItemId);
                return null;
            }

            await _monitorConfigurations.InsertOneAsync(monitor);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Blocks Monitor entry for repo {RepoId}.", repo.ItemId);
            return "Failed to add the repository to Blocks Monitor.";
        }

        try
        {
            await _messageClient.SendToConsumerAsync(new ConsumerMessage<MonitorConfigurationUpdateQueue>
            {
                ConsumerName = MonitorConfigurationUpdateListener,
                Payload = new MonitorConfigurationUpdateQueue { MonitorId = monitor.ItemId }
            });
        }
        catch (Exception ex)
        {
            // Not fatal: the monitor worker also polls the collection, so it picks the monitor up on its next pass.
            _logger.LogError(ex, "Failed to queue Blocks Monitor reload for monitor {MonitorId}.", monitor.ItemId);
        }

        return null;
    }

    /// <summary>Maps a repository to its monitor, or null when there is no URL to monitor.</summary>
    public static MonitorConfiguration? BuildMonitor(Repo repo, string? userId, DateTime now)
    {
        var url = NormalizeUrl(!string.IsNullOrWhiteSpace(repo.CustomDeploymentUrl)
            ? repo.CustomDeploymentUrl
            : repo.DefaultDeploymentUrl);
        if (url is null)
            return null;

        return new MonitorConfiguration
        {
            ItemId = Guid.NewGuid().ToString(),
            TenantId = repo.ProjectId,
            Name = MonitorName(repo),
            Url = url,
            RepoId = repo.ItemId,
            RepoName = repo.RepoName,
            MonitorConfigurationType = MonitorConfigurationTypes.OutboundPing,
            MonitorSourceType = MonitorSourceTypes.DeployedServices,
            ProtocolType = MonitorProtocolTypes.HTTP,
            HttpMethodType = MonitorHttpMethodTypes.HEAD,
            IntervalInSeconds = DefaultIntervalInSeconds,
            TimeoutInSeconds = DefaultTimeoutInSeconds,
            CustomHttpHeaders = EmptyCustomHttpHeaders,
            IsActive = true,
            CreatedDate = now,
            LastUpdatedDate = now,
            CreatedBy = userId,
            LastUpdatedBy = userId
        };
    }

    /// <summary>The last path segment of the repository URL, e.g. "VanGuard" for https://github.com/nuzattasnim/VanGuard.</summary>
    public static string MonitorName(Repo repo)
    {
        var repoUrl = repo.RepoUrl?.Trim().TrimEnd('/') ?? string.Empty;
        var name = repoUrl[(repoUrl.LastIndexOf('/') + 1)..];
        return string.IsNullOrWhiteSpace(name) ? repo.RepoName : name;
    }

    // Deployment URLs are stored with or without a scheme; the monitor worker needs an absolute URL.
    private static string? NormalizeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        url = url.Trim();
        return url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                ? url
                : $"https://{url}";
    }
}
