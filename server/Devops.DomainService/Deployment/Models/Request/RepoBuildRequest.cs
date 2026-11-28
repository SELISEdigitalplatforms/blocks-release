namespace Devops.DomainService.Deployment.Models.Request
{
    public class RepoBuildRequest
    {
        public string RepoId { get; set; }
        public string? hostingProviderId { get; set; }
        public string? regionId { get; set; }
        public string? machineConfigId { get; set; }
        // Opt-in from the first-deployment dialog: also create a Blocks Monitor entry for the repo.
        public bool viewInBlocksMonitor { get; set; }
        // The deployment mode to deploy with: "auto" (any case) is Git based, any other value Blocks Cloud based.
        // Left out or blank, the stored mode applies; a change is saved before the pipeline starts.
        public string? DeploymentType { get; set; }
    }
}
