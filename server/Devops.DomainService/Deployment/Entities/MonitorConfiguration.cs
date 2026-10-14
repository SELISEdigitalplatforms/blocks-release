using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.Deployment.Entities
{
    // Mirror of blocks-monitor's DomainService.Monitor.Entity.MonitorConfiguration. Release writes these
    // straight into blocks-monitor's "MonitorConfigurations" collection, so the enum members (stored as
    // their integer values) and property names must stay in step with that service's entity.

    public enum MonitorHttpMethodTypes
    {
        HEAD,
        GET,
        POST
    }

    public enum MonitorProtocolTypes
    {
        HTTP,
        HTTPS
    }

    public enum MonitorConfigurationTypes
    {
        OutboundPing,
        InboundPing
    }

    public enum MonitorSourceTypes
    {
        Infrastructure,
        DeployedServices,
        BlocksServices,
        ExternalServices,
        OtherServices,
    }

    [BsonIgnoreExtraElements]
    public class MonitorConfiguration : BaseEntity
    {
        public string? TenantId { get; set; }
        public string? ExternalServiceId { get; set; }
        public string? ExternalServiceName { get; set; }
        public string? RepoId { get; set; }
        public string? RepoName { get; set; }
        public string Name { get; set; }
        public string Url { get; set; }

        public MonitorConfigurationTypes MonitorConfigurationType { get; set; }
        public MonitorSourceTypes? MonitorSourceType { get; set; }

        public MonitorProtocolTypes? ProtocolType { get; set; }
        public MonitorHttpMethodTypes? HttpMethodType { get; set; }

        public int IntervalInSeconds { get; set; }
        public int TimeoutInSeconds { get; set; }
        public int GracePeriodInSeconds { get; set; } = 30;

        public bool IsActive { get; set; } = true;
        public bool CurrentStatus { get; set; } = true;

        public string? CustomHttpHeaders { get; set; }
        public List<string> SuccessHttpResponseCodes { get; set; } = new List<string>();
        public List<string> Regions { get; set; } = new List<string>();
        public List<string> Emails { get; set; } = new List<string>();
    }
}
