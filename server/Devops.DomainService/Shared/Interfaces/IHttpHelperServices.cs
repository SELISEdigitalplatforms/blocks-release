namespace Devops.DomainService.Shared.Interfaces
{
    public interface IHttpHelperServices
    {
        Task<(T?, HttpResponseMessage Response)> MakeHttpRequest<T>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class;
        Task<(T?, HttpResponseMessage Response)> MakeHttpDeleteRequest<T>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class;
        Task<(T? data, E? error, HttpResponseMessage Response)> MakeHttpRequest<T, E>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class where E : class;
        Task<(T?,string)> MakeHttpGetRequest<T>(string url, string token = null, Dictionary<string, string> headers = null) where T : class;
        Task<(T?,string)> MakeHttpPostRequest<T>(object payload, string url, Dictionary<string, string> headers = null, string token = null, string contentType = "application/json") where T : class;
    }
}
