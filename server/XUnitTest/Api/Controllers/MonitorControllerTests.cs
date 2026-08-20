using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Api.Controllers;
using Devops.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers;

[CollectionDefinition("MonitorController environment", DisableParallelization = true)]
public class MonitorControllerEnvironmentCollection;

[Collection("MonitorController environment")]
public class MonitorControllerTests
{
    private const string ProjectKey = "project key";
    private const string RepoId = "repo/id";

    [Fact]
    public async Task ValidProxyRequest_UsesBlocksMonitorBaseUrl()
    {
        var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{\"isSuccess\":true}"));
        var controller = CreateController(handler, new Dictionary<string, string?>
        {
            ["BLOCKS_MONITOR_BASE_URL"] = " https://monitor.example/ "
        });

        var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        result.Should().BeOfType<ContentResult>();
        handler.Requests.Should().ContainSingle();
        handler.Requests[0].RequestUri!.AbsoluteUri.Should()
            .Be("https://monitor.example/Monitor/GetMonitorListByRepoId?ProjectKey=project%20key&repoId=repo%2Fid");
    }

    [Fact]
    public async Task MissingMonitorUrl_FallsBackToBlocksLogicBaseUrl()
    {
        var originalMonitorEnv = Environment.GetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL");
        try
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", null);
            var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{}"));
            var controller = CreateController(handler, new Dictionary<string, string?>
            {
                ["BLOCKS_LOGIC_BASE_URL"] = "https://logic.example"
            });

            await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

            handler.Requests.Should().ContainSingle();
            handler.Requests[0].RequestUri!.ToString().Should()
                .StartWith("https://logic.example/Monitor/GetMonitorListByRepoId");
        }
        finally
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", originalMonitorEnv);
        }
    }

    [Fact]
    public async Task BaseUrlResolution_ChecksRootBeforeFrontendRuntimeBeforeEnvironment()
    {
        var originalMonitorEnv = Environment.GetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL");
        var originalLogicEnv = Environment.GetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL");
        try
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", "https://monitor-env.example");
            Environment.SetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL", "https://logic-env.example");
            var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{}"));
            var controller = CreateController(handler, new Dictionary<string, string?>
            {
                ["BLOCKS_MONITOR_BASE_URL"] = "https://monitor-root.example",
                ["FrontendRuntime:BLOCKS_MONITOR_BASE_URL"] = "https://monitor-frontend.example",
                ["BLOCKS_LOGIC_BASE_URL"] = "https://logic-root.example",
                ["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"] = "https://logic-frontend.example",
            });

            await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

            handler.Requests.Should().ContainSingle();
            handler.Requests[0].RequestUri!.Host.Should().Be("monitor-root.example");
        }
        finally
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", originalMonitorEnv);
            Environment.SetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL", originalLogicEnv);
        }
    }

    [Theory]
    [InlineData(null, "repo")]
    [InlineData("", "repo")]
    [InlineData("   ", "repo")]
    [InlineData("project", null)]
    [InlineData("project", "")]
    [InlineData("project", "   ")]
    public async Task MissingRequiredQuery_ReturnsBadRequestAndDoesNotSend(string projectKey, string repoId)
    {
        var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{}"));
        var controller = CreateController(handler, new Dictionary<string, string?>
        {
            ["BLOCKS_MONITOR_BASE_URL"] = "https://monitor.example"
        });

        var result = await controller.GetMonitorListByRepoId(projectKey, repoId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        var body = objectResult.Value.Should().BeOfType<BaseApiResponse>().Subject;
        body.IsSuccess.Should().BeFalse();
        body.Message.Should().Be("ProjectKey and repoId are required.");
        body.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task MissingBaseUrl_ReturnsInternalServerErrorAndLogs()
    {
        var originalMonitorEnv = Environment.GetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL");
        var originalLogicEnv = Environment.GetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL");
        try
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", null);
            Environment.SetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL", null);
            var logger = new TestLogger<MonitorController>();
            var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{}"));
            var controller = CreateController(handler, new Dictionary<string, string?>(), logger);

            var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

            var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
            objectResult.StatusCode.Should().Be((int)HttpStatusCode.InternalServerError);
            ((BaseApiResponse)objectResult.Value!).Message.Should()
                .Be("Monitor backend service URL is not configured.");
            logger.Entries.Should().Contain(e => e.Level == LogLevel.Error
                && e.Message.Contains("Monitor backend service URL is not configured."));
            handler.Requests.Should().BeEmpty();
        }
        finally
        {
            Environment.SetEnvironmentVariable("BLOCKS_MONITOR_BASE_URL", originalMonitorEnv);
            Environment.SetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL", originalLogicEnv);
        }
    }

    [Theory]
    [InlineData("Authorization", "Bearer token")]
    [InlineData("x-blocks-key", "blocks-key")]
    public async Task SupportedHeaders_AreForwarded(string headerName, string headerValue)
    {
        var handler = new CapturingHandler(JsonResponse(HttpStatusCode.OK, "{}"));
        var controller = CreateController(handler, new Dictionary<string, string?>
        {
            ["BLOCKS_MONITOR_BASE_URL"] = "https://monitor.example"
        });
        controller.ControllerContext.HttpContext.Request.Headers[headerName] = headerValue;

        await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        handler.Requests[0].Headers.TryGetValues(headerName, out var values).Should().BeTrue();
        values.Should().ContainSingle().Which.Should().Be(headerValue);
    }

    [Fact]
    public async Task UpstreamSuccess_ReturnsStatusAndJsonBody()
    {
        const string upstreamBody = "{\"data\":{},\"isSuccess\":true,\"statusCode\":200}";
        var controller = CreateController(
            new CapturingHandler(JsonResponse(HttpStatusCode.OK, upstreamBody)),
            ConfigWithMonitorUrl());

        var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        var content = result.Should().BeOfType<ContentResult>().Subject;
        content.StatusCode.Should().Be((int)HttpStatusCode.OK);
        content.Content.Should().Be(upstreamBody);
        content.ContentType.Should().Contain("application/json");
    }

    [Fact]
    public async Task UpstreamJsonFailure_ReturnsUpstreamStatusAndBody()
    {
        const string upstreamBody = "{\"isSuccess\":false,\"message\":\"nope\",\"statusCode\":404}";
        var controller = CreateController(
            new CapturingHandler(JsonResponse(HttpStatusCode.NotFound, upstreamBody)),
            ConfigWithMonitorUrl());

        var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        var content = result.Should().BeOfType<ContentResult>().Subject;
        content.StatusCode.Should().Be((int)HttpStatusCode.NotFound);
        content.Content.Should().Be(upstreamBody);
    }

    [Fact]
    public async Task UpstreamNonJsonFailure_ReturnsUpstreamStatusAndSynthesizedEnvelope()
    {
        var response = new HttpResponseMessage(HttpStatusCode.BadGateway)
        {
            ReasonPhrase = "Bad Gateway",
            Content = new StringContent("upstream unavailable")
        };
        var controller = CreateController(new CapturingHandler(response), ConfigWithMonitorUrl());

        var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be((int)HttpStatusCode.BadGateway);
        var body = objectResult.Value.Should().BeOfType<BaseApiResponse>().Subject;
        body.IsSuccess.Should().BeFalse();
        body.Message.Should().Be("Failed to fetch monitor list from upstream: Bad Gateway");
        body.StatusCode.Should().Be(HttpStatusCode.BadGateway);
    }

    [Theory]
    [InlineData("http")]
    [InlineData("timeout")]
    [InlineData("general")]
    public async Task ProxyExceptions_ReturnInternalServerErrorAndLog(string exceptionKind)
    {
        var logger = new TestLogger<MonitorController>();
        Exception exception = exceptionKind switch
        {
            "http" => new HttpRequestException("connection failed"),
            "timeout" => new TaskCanceledException("timed out"),
            _ => new InvalidOperationException("unexpected")
        };
        var controller = CreateController(
            new CapturingHandler(exception),
            ConfigWithMonitorUrl(),
            logger);

        var result = await controller.GetMonitorListByRepoId(ProjectKey, RepoId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be((int)HttpStatusCode.InternalServerError);
        ((BaseApiResponse)objectResult.Value!).Message.Should()
            .Be("Failed to fetch monitor list from upstream.");
        logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Exception == exception);
    }

    [Fact]
    public void RouteMetadata_ResolvesToApiMonitorGetMonitorListByRepoId()
    {
        var controllerRoute = typeof(MonitorController).GetCustomAttribute<RouteAttribute>()!.Template;
        var actionRoute = GetAction().GetCustomAttribute<HttpGetAttribute>()!.Template;
        var route = $"{controllerRoute}/{actionRoute}".Replace("[controller]", "Monitor");

        route.Should().Be("api/Monitor/GetMonitorListByRepoId");
    }

    [Fact]
    public void ProtectedEndpointAttribute_IsPresentWithExpectedPermission()
    {
        var protectedEndpoint = CustomAttributeData.GetCustomAttributes(GetAction())
            .Single(attribute => attribute.AttributeType.Name == "ProtectedEndPointAttribute");

        protectedEndpoint.ConstructorArguments.Should().ContainSingle();
        protectedEndpoint.ConstructorArguments[0].Value.Should()
            .Be("blocks-release::monitor::get-list-by-repo-id");
    }

    [Fact]
    public void Endpoint_DoesNotAllowAnonymous()
    {
        GetAction().GetCustomAttributes<AllowAnonymousAttribute>(inherit: true).Should().BeEmpty();
        typeof(MonitorController).GetCustomAttributes<AllowAnonymousAttribute>(inherit: true).Should().BeEmpty();
    }

    [Fact]
    public void ApiStartupPath_RegistersHttpClientFactory()
    {
        var programPath = FindRepoFile(Path.Combine("server", "Api", "Program.cs"));
        var serviceRegistryPath = FindRepoFile(Path.Combine("server", "Devops.DomainService", "ServiceRegistry.cs"));
        var startupSource = File.ReadAllText(programPath) + Environment.NewLine + File.ReadAllText(serviceRegistryPath);

        startupSource.Should().Contain(".AddHttpClient(");
    }

    [Fact]
    public void ReleasePermissionSeed_ContainsMonitorListPermission()
    {
        var seedPath = FindRepoFile(Path.Combine("server", "seed", "release-permissions.upsert.json"));
        var seedSource = File.ReadAllText(seedPath);

        seedSource.Should().Contain("\"Resource\": \"blocks-release::monitor::get-list-by-repo-id\"");
    }

    private static MonitorController CreateController(
        CapturingHandler handler,
        IDictionary<string, string?> config,
        TestLogger<MonitorController>? logger = null)
    {
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory
            .Setup(factory => factory.CreateClient(It.IsAny<string>()))
            .Returns(new HttpClient(handler));

        var controller = new MonitorController(
            httpClientFactory.Object,
            new ConfigurationBuilder().AddInMemoryCollection(config).Build(),
            logger ?? new TestLogger<MonitorController>());

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        return controller;
    }

    private static Dictionary<string, string?> ConfigWithMonitorUrl() =>
        new()
        {
            ["BLOCKS_MONITOR_BASE_URL"] = "https://monitor.example"
        };

    private static HttpResponseMessage JsonResponse(HttpStatusCode statusCode, string body) =>
        new(statusCode)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
        };

    private static MethodInfo GetAction() =>
        typeof(MonitorController).GetMethod(nameof(MonitorController.GetMonitorListByRepoId))!;

    private static string FindRepoFile(string relativePath)
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Could not find {relativePath}");
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage? _response;
        private readonly Exception? _exception;

        public CapturingHandler(HttpResponseMessage response)
        {
            _response = response;
        }

        public CapturingHandler(Exception exception)
        {
            _exception = exception;
        }

        public List<HttpRequestMessage> Requests { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(CloneRequest(request));

            if (_exception is not null)
            {
                throw _exception;
            }

            return Task.FromResult(_response!);
        }

        private static HttpRequestMessage CloneRequest(HttpRequestMessage request)
        {
            var clone = new HttpRequestMessage(request.Method, request.RequestUri);
            foreach (var header in request.Headers)
            {
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            return clone;
        }
    }

    private sealed class TestLogger<T> : ILogger<T>
    {
        public List<LogEntry> Entries { get; } = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Entries.Add(new LogEntry(logLevel, formatter(state, exception), exception));
        }
    }

    private sealed record LogEntry(LogLevel Level, string Message, Exception? Exception);

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();
        public void Dispose()
        {
        }
    }
}
