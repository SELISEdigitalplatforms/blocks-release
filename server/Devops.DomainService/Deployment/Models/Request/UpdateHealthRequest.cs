namespace Devops.DomainService.Deployment.Models.Request
{
    /// <summary>
    /// The fields a caller may change on a heartbeat (InboundPing) monitor. Mirrors the editable part of
    /// blocks-monitor's UpdateHealthConfigurationRequest; anything else in the body is ignored.
    /// </summary>
    public class UpdateHealthRequest
    {
        public string ItemId { get; set; } = string.Empty;

        /// <summary>Kept when null.</summary>
        public string? Name { get; set; }

        /// <summary>Kept when zero or negative.</summary>
        public int IntervalInSeconds { get; set; }

        /// <summary>Kept when zero or negative.</summary>
        public int GracePeriodInSeconds { get; set; }

        public bool IsActive { get; set; }
    }
}
