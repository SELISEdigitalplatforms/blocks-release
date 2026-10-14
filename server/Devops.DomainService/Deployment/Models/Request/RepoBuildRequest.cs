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
    }
}
