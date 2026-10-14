namespace Devops.DomainService.Deployment.Models.Dtos
{
    /// <summary>
    /// Payload blocks-monitor's worker consumes to reload its monitor schedule. Genesis routes a message
    /// to its consumer by the payload's type name, so this class name must match blocks-monitor's exactly.
    /// </summary>
    public class MonitorConfigurationUpdateQueue
    {
        public string MonitorId { get; set; }
    }
}
