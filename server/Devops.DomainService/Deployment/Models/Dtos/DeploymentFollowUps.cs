using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;

namespace Devops.DomainService.Deployment.Models.Dtos;

/// <summary>
/// What a started deploy hands its follow-up work to: the post-build queue, the opted-in Blocks Monitor entry and
/// the user notifications. Taken together so the build service's constructor stays small.
/// </summary>
public sealed record DeploymentFollowUps(
    IMessageClient MessageClient,
    IMonitorProvisioningService MonitorProvisioning,
    INotificationService? Notifications = null);
