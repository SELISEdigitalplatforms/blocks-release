using System.Net;
using Blocks.Genesis;

namespace ReleaseDriver
{
    public class BaseApiResponse : BaseResponse
    {
        public object? Data { get; set; }

        public string? Message { get; set; }

        public HttpStatusCode StatusCode { get; set; }
        public string? Error { get; set; }
        public string? Reason { get; set; }


    }
}
