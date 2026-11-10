using System.Net;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Deployment.Services;

/// <summary>
/// Heartbeat update and delete, written straight to blocks-monitor's collection (release cannot call
/// blocks-monitor). The rules and messages match blocks-monitor's HealthConfigurationService, so the
/// release UI behaves exactly as it did when these calls went through blocks-logic.
/// </summary>
/// <remarks>
/// blocks-monitor's heartbeat scheduler is not told about the change: it picks it up on its next
/// database poll. That is no worse than before, when blocks-logic reloaded only its own in-process
/// copy of the scheduler.
/// </remarks>
public class HeartbeatConfigurationService : IHeartbeatConfigurationService
{
    public const string ManagedByBlocksMessage =
        "Infrastructure and Blocks services monitors are managed by Blocks and cannot be changed.";

    private readonly IHeartbeatConfigurationStore _store;
    private readonly ILogger<HeartbeatConfigurationService> _logger;

    public HeartbeatConfigurationService(IHeartbeatConfigurationStore store, ILogger<HeartbeatConfigurationService> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task<BaseApiResponse> UpdateAsync(UpdateHealthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.ItemId))
            return Failure(HttpStatusCode.BadRequest, "ItemId is required.");

        try
        {
            var existing = await _store.GetAsync(request.ItemId);

            // A heartbeat of another tenant is reported as not found, so its existence is not revealed.
            if (existing is null || IsCrossTenantAccess(existing))
                return Failure(HttpStatusCode.NotFound, $"HealthConfiguration not found: {request.ItemId}");

            if (IsManagedByBlocks(existing))
                return Failure(HttpStatusCode.Forbidden, ManagedByBlocksMessage);

            existing.Name = request.Name ?? existing.Name;
            if (request.IntervalInSeconds > 0)
                existing.IntervalInSeconds = request.IntervalInSeconds;
            if (request.GracePeriodInSeconds > 0)
                existing.GracePeriodInSeconds = request.GracePeriodInSeconds;
            existing.IsActive = request.IsActive;
            existing.LastUpdatedDate = DateTime.UtcNow;
            existing.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            // Alert recipients (Emails) are never taken from an update: blocks-monitor owns them.

            await _store.UpdateEditableFieldsAsync(existing);

            return new BaseApiResponse
            {
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK,
                Data = existing,
                Message = $"HealthConfiguration {request.ItemId} updated successfully."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating HealthConfiguration {ItemId}", ForLog(request.ItemId));
            return Failure(HttpStatusCode.InternalServerError, "Error updating configuration.");
        }
    }

    public async Task<BaseApiResponse> DeleteAsync(string itemId)
    {
        if (string.IsNullOrWhiteSpace(itemId))
            return Failure(HttpStatusCode.BadRequest, "itemId is required.");

        try
        {
            var existing = await _store.GetAsync(itemId);

            // blocks-monitor answers a missing heartbeat with a 200 "not found"; kept for the client.
            if (existing is null || IsCrossTenantAccess(existing))
                return Failure(HttpStatusCode.OK, $"HealthConfiguration not found: {itemId}");

            if (IsManagedByBlocks(existing))
                return Failure(HttpStatusCode.Forbidden, ManagedByBlocksMessage);

            if (!await _store.DeleteAsync(itemId))
                _logger.LogWarning("HealthConfiguration {ItemId} was already gone when deleting.", ForLog(itemId));

            return new BaseApiResponse
            {
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK,
                Message = $"HealthConfiguration with ItemId {itemId} deleted successfully."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting HealthConfiguration {ItemId}", ForLog(itemId));
            return Failure(HttpStatusCode.InternalServerError, "Error deleting configuration.");
        }
    }

    public static bool IsManagedByBlocks(MonitorConfiguration heartbeat) =>
        heartbeat.EffectiveMonitorSourceType is MonitorSourceTypes.Infrastructure or MonitorSourceTypes.BlocksServices;

    private static bool IsCrossTenantAccess(MonitorConfiguration heartbeat)
    {
        string? callerTenantId;
        try
        {
            callerTenantId = BlocksContext.GetContext()?.TenantId;
        }
        catch
        {
            callerTenantId = null;
        }

        return !string.IsNullOrEmpty(callerTenantId)
            && !string.IsNullOrEmpty(heartbeat.TenantId)
            && !string.Equals(callerTenantId, heartbeat.TenantId, StringComparison.Ordinal);
    }

    /// <summary>The item id comes from the request: strip line breaks so it cannot forge log entries.</summary>
    public static string ForLog(string? value) =>
        (value ?? string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);

    private static BaseApiResponse Failure(HttpStatusCode statusCode, string message) => new()
    {
        IsSuccess = false,
        StatusCode = statusCode,
        Message = message
    };
}
