using Blocks.Genesis;

namespace Devops.DomainService.DataGatewayDeployment.Entity
{
    public class DataGatewayInstance: BaseEntity
    {
        public string TenantId { get; set; }
        public string ProjectGuid { get; set; }
        public string ProjectEnv { get; set; }
        public string LastPipelineRunName { get; set; }
        public string LastVersion { get; set; }
        public string LastDeploymentStatus { get; set; } 
        public List<string> ClusterNames { get; set; }
        public List<DataGatewayInstanceDeploymentLogs> DataGatewayInstanceDeploymentLog { get; set; }
    }

    public class DataGatewayInstanceDeploymentLogs
    {
        public string PipelineRunName { get; set; }
        public DateTime EventStartDate  { get; set; }
        public DateTime EventFinishDate { get; set; }
        public string EventStatus { get; set; }
        public string Version { get; set; }
    }
}
