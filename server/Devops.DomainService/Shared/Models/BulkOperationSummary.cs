namespace Devops.DomainService.Shared.Models
{
    public class BulkOperationSummary
    {
        public int MatchedCount { get; set; }
        public int ModifiedCount { get; set; }
        public int RequestedCount { get; set; }
        public bool IsAcknowledged { get; set; }
    }

}
