using System.Net;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MonitorController : ControllerBase
{
    private const string MonitorListPath = "/Monitor/GetMonitorListByRepoId";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MonitorController> _logger;

    public MonitorController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<MonitorController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("GetMonitorListByRepoId")]
    [ProtectedEndPoint("blocks-release::monitor::get-list-by-repo-id")]
    public async Task<IActionResult> GetMonitorListByRepoId(
        [FromQuery] string ProjectKey,
        [FromQuery] string repoId)
    {
        if (string.IsNullOrWhiteSpace(ProjectKey) || string.IsNullOrWhiteSpace(repoId))
        {
            return StatusCode((int)HttpStatusCode.BadRequest, CreateEnvelope(
                "ProjectKey and repoId are required.",
                HttpStatusCode.BadRequest));
        }

        var baseUrl = ResolveMonitorBaseUrl();
        if (baseUrl is null)
        {
            _logger.LogError("Monitor backend service URL is not configured.");
            return StatusCode((int)HttpStatusCode.InternalServerError, CreateEnvelope(
                "Monitor backend service URL is not configured.",
                HttpStatusCode.InternalServerError));
        }

        var upstreamUrl = BuildUpstreamUrl(baseUrl, ProjectKey, repoId);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, upstreamUrl);
            ForwardHeader(request, "Authorization");
            ForwardHeader(request, "x-blocks-key");

            var client = _httpClientFactory.CreateClient();
            using var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";

            if (response.IsSuccessStatusCode || IsJsonBody(body))
            {
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = body,
                    ContentType = contentType
                };
            }

            var failure = CreateEnvelope(
                $"Failed to fetch monitor list from upstream: {response.ReasonPhrase}",
                response.StatusCode);

            return StatusCode((int)response.StatusCode, failure);
        }
        catch (HttpRequestException ex)
        {
            return HandleProxyException(ex);
        }
        catch (TaskCanceledException ex)
        {
            return HandleProxyException(ex);
        }
        catch (Exception ex)
        {
            return HandleProxyException(ex);
        }
    }

    private string? ResolveMonitorBaseUrl()
    {
        var candidates = new[]
        {
            _configuration["BLOCKS_MONITOR_BASE_URL"],
            _configuration["FrontendRuntime:BLOCKS_MONITOR_BASE_URL"],
            Environment.GetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL"),
            _configuration["BLOCKS_LOGIC_BASE_URL"],
            _configuration["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"],
            Environment.GetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL"),
        };

        return candidates
            .Select(value => value?.Trim())
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
            ?.TrimEnd('/');
    }

    private static string BuildUpstreamUrl(string baseUrl, string projectKey, string repoId)
    {
        var encodedProjectKey = Uri.EscapeDataString(projectKey);
        var encodedRepoId = Uri.EscapeDataString(repoId);
        return $"{baseUrl}{MonitorListPath}?ProjectKey={encodedProjectKey}&repoId={encodedRepoId}";
    }

    private void ForwardHeader(HttpRequestMessage upstreamRequest, string headerName)
    {
        if (!Request.Headers.TryGetValue(headerName, out var values) || values.Count == 0)
        {
            return;
        }

        var nonEmptyValues = values.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray();
        if (nonEmptyValues.Length > 0)
        {
            upstreamRequest.Headers.TryAddWithoutValidation(headerName, nonEmptyValues);
        }
    }

    private IActionResult HandleProxyException(Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch monitor list from upstream.");
        return StatusCode((int)HttpStatusCode.InternalServerError, CreateEnvelope(
            "Failed to fetch monitor list from upstream.",
            HttpStatusCode.InternalServerError));
    }

    private static bool IsJsonBody(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        try
        {
            using var _ = System.Text.Json.JsonDocument.Parse(body);
            return true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    private static BaseApiResponse CreateEnvelope(string message, HttpStatusCode statusCode) =>
        new()
        {
            Data = null,
            IsSuccess = false,
            Message = message,
            StatusCode = statusCode
        };
}
