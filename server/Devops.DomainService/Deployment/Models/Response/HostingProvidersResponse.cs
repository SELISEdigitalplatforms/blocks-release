using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.Deployment.Models.Response
{
    public class HostingProvidersResponse : BaseApiResponse
    {
        public new List<HostingProvider> Data { get; set; }
    }
}
