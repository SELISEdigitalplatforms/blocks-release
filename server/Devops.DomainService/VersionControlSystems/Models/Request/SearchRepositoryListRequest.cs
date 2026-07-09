namespace Devops.DomainService.VersionControlSystems.Models.Request
{
    public class SearchRepositoryListRequest
    {
        public string Search { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }
}
