using System.Text;
using System.Text.Json;
using Blocks.Genesis;
using Devops.DomainService.Shared.Interfaces;
using Microsoft.Extensions.Logging;

namespace Devops.DomainService.Shared.Services
{
    public class HttpHelperServices : IHttpHelperServices
    {
        private const string JsonContentType = "application/json";
        private const string BearerScheme = "Bearer";

        private readonly ILogger<HttpHelperServices> _logger;
        private readonly IHttpService _httpService;
        private readonly IHttpClientFactory _httpClientFactory;

        public HttpHelperServices(IHttpService httpService, IHttpClientFactory httpClientFactory, ILogger<HttpHelperServices> logger)
        {
            _logger = logger;
            _httpService = httpService;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<(T?, string)> MakeHttpGetRequest<T>(string url, string token = null, Dictionary<string, string> headers = null) where T : class
        {
            try
            {
                _logger.LogInformation($"Making GET request to: {url}");
                HttpMethod httpMethod = new HttpMethod("GET");
                var (data, rawResponse) = await _httpService.Get<T>(url, headers);
                return (data, rawResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error making GET request to: {Url} ", url, ex.Message);
                return (null, "Operation Failed.");
            }
        }

        public async Task<(T?, string)> MakeHttpPostRequest<T>(object payload, string url, Dictionary<string, string> headers = null, string token = null, string contentType = JsonContentType) where T : class
        {
            try
            {
                var (data, rawResponse) = await _httpService.Post<T>(payload, url, contentType, headers);

                return (data, rawResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error making POST request to: {Url}", url);
                return (null, "Operation Failed.");
            }
        }

        public async Task<(T?, HttpResponseMessage Response)> MakeHttpRequest<T>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class
        {
            try
            {
                _logger.LogInformation($"Making {method.Method} request to: {url}");

                var client = _httpClientFactory.CreateClient(clientName);

                if (!string.IsNullOrEmpty(token))
                {
                    client.DefaultRequestHeaders.Authorization =
                        new System.Net.Http.Headers.AuthenticationHeaderValue(BearerScheme, token);
                }

                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                HttpRequestMessage request = new HttpRequestMessage(method, url);

                if ((method == HttpMethod.Post || method == HttpMethod.Put || method == HttpMethod.Patch) && payload != null)
                {
                    string jsonPayload = JsonSerializer.Serialize(payload);
                    request.Content = new StringContent(jsonPayload, Encoding.UTF8, JsonContentType);
                }

                var response = await client.SendAsync(request);

                var contentString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Request failed with status code: {response.StatusCode}, Body: {contentString}");
                    try
                    {
                        var result = JsonSerializer.Deserialize<T>(contentString);
                        return (result, response);
                    }
                    catch (JsonException)
                    {
                        return (null, response);

                    }
                }

                var deserialized = JsonSerializer.Deserialize<T>(contentString);
                return (deserialized, response);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error making {method.Method} request to: {url}, Exception: {ex.Message}");
                return (null, new HttpResponseMessage());
            }
        }


        public async Task<(T?, HttpResponseMessage Response)> MakeHttpDeleteRequest<T>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class
        {
            try
            {
                _logger.LogInformation($"Making {method.Method} request to: {url}");

                var client = _httpClientFactory.CreateClient(clientName);

                if (!string.IsNullOrEmpty(token))
                {
                    client.DefaultRequestHeaders.Authorization =
                        new System.Net.Http.Headers.AuthenticationHeaderValue(BearerScheme, token);
                }

                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                HttpRequestMessage request = new HttpRequestMessage(method, url);

                if ((method == HttpMethod.Delete) && payload != null)
                {
                    string jsonPayload = JsonSerializer.Serialize(payload);
                    request.Content = new StringContent(jsonPayload, Encoding.UTF8, JsonContentType);
                }

                var response = await client.SendAsync(request);

                var contentString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Request failed with status code: {response.StatusCode}, Body: {contentString}");
                }

                var deserialized = JsonSerializer.Deserialize<T>(contentString);
                return (deserialized, response);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error making {method.Method} request to: {url}, Exception: {ex.Message}");
                return (null, new HttpResponseMessage());
            }
        }


        public async Task<HttpCallResult> SendWithTimeoutAsync(string clientName, string url, HttpMethod method, object? payload, Dictionary<string, string>? headers, string? token, TimeSpan timeout)
        {
            using var cancellation = new CancellationTokenSource(timeout);
            try
            {
                var client = _httpClientFactory.CreateClient(clientName);
                using var request = new HttpRequestMessage(method, url);
                // Headers go on this request only, never on the client, which the factory may hand out again.
                if (!string.IsNullOrEmpty(token))
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(BearerScheme, token);
                if (headers != null)
                {
                    foreach (var header in headers)
                        request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                }
                if (payload != null)
                    request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, JsonContentType);

                using var response = await client.SendAsync(request, cancellation.Token);
                var body = await response.Content.ReadAsStringAsync(cancellation.Token);
                return new HttpCallResult(response.StatusCode, body);
            }
            catch (Exception ex) when (ex is OperationCanceledException or HttpRequestException)
            {
                // The caller logs the outcome with its own context; the payload and token never are.
                return HttpCallResult.NoAnswer();
            }
        }

        public async Task<(T? data, E? error, HttpResponseMessage Response)> MakeHttpRequest<T, E>(string clientName, string url, HttpMethod method,  object? payload = null, Dictionary<string, string>? headers = null, string? token = null)
        where T : class
        where E : class
        {
            try
            {
                _logger.LogInformation($"Making {method.Method} request to: {url}");

                var client = _httpClientFactory.CreateClient(clientName);

                // Add Authorization header if token is provided
                if (!string.IsNullOrEmpty(token))
                {
                    client.DefaultRequestHeaders.Authorization =
                        new System.Net.Http.Headers.AuthenticationHeaderValue(BearerScheme, token);
                }

                // Add any additional headers
                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                HttpRequestMessage request = new HttpRequestMessage(method, url);

                // Add payload if method is POST or PUT
                if ((method == HttpMethod.Post || method == HttpMethod.Put || method == HttpMethod.Patch) && payload != null)
                {
                    string jsonPayload = JsonSerializer.Serialize(payload);
                    request.Content = new StringContent(jsonPayload, Encoding.UTF8, JsonContentType);
                }

                var response = await client.SendAsync(request);
                var contentString = await response.Content.ReadAsStringAsync();

                var jsonOptions = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"Request succeeded with status code: {response.StatusCode}");
                    var successData = JsonSerializer.Deserialize<T>(contentString, jsonOptions);
                    return (successData, null, response);
                }
                else
                {
                    _logger.LogError($"Request failed with status code: {response.StatusCode}, Body: {contentString}");
                    var errorData = JsonSerializer.Deserialize<E>(contentString, jsonOptions);
                    return (null, errorData, response);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error making {method.Method} request to: {url}, Exception: {ex}");
                return (null, null, new HttpResponseMessage());
            }
        }



    }
}
