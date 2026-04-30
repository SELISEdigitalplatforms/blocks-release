using System.Net;
using Blocks.Genesis;

namespace Devops.DomainService.Shared.Entities
{
    public class BaseApiResponse: BaseResponse
    {
        public object Data { get; set; }
        public string Message { get; set; }
        public HttpStatusCode StatusCode { get; set; }
    }
}
