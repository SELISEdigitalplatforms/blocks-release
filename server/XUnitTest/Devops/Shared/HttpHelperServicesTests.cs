using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Shared
{
    public class HttpHelperServicesTests
    {
        public sealed class Dto
        {
            public string name { get; set; }
        }

        private readonly Mock<IHttpService> _httpService = new();
        private readonly Mock<IHttpClientFactory> _clientFactory = new();

        private HttpHelperServices CreateService() =>
            new(_httpService.Object, _clientFactory.Object, new Mock<ILogger<HttpHelperServices>>().Object);

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _code;
            private readonly string _body;
            private readonly bool _throw;
            public StubHandler(HttpStatusCode code, string body, bool @throw = false)
            {
                _code = code;
                _body = body;
                _throw = @throw;
            }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                if (_throw) throw new HttpRequestException("network down");
                return Task.FromResult(new HttpResponseMessage(_code) { Content = new StringContent(_body) });
            }
        }

        private void SetupClient(HttpStatusCode code, string body, bool @throw = false) =>
            _clientFactory.Setup(f => f.CreateClient(It.IsAny<string>()))
                          .Returns(new HttpClient(new StubHandler(code, body, @throw)));

        // ---- MakeHttpGetRequest ----

        [Fact]
        public async Task MakeHttpGetRequest_Success_ReturnsData()
        {
            _httpService.Setup(s => s.Get<Dto>("https://api.example.com", It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                        .ReturnsAsync((new Dto { name = "x" }, "raw"));
            var (data, raw) = await CreateService().MakeHttpGetRequest<Dto>("https://api.example.com");
            data.name.Should().Be("x");
            raw.Should().Be("raw");
        }

        [Fact]
        public async Task MakeHttpGetRequest_Exception_ReturnsFailure()
        {
            _httpService.Setup(s => s.Get<Dto>(It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                        .ThrowsAsync(new InvalidOperationException("boom"));
            var (data, raw) = await CreateService().MakeHttpGetRequest<Dto>("https://api.example.com");
            data.Should().BeNull();
            raw.Should().Be("Operation Failed.");
        }

        // ---- MakeHttpPostRequest ----

        [Fact]
        public async Task MakeHttpPostRequest_Success_ReturnsData()
        {
            _httpService.Setup(s => s.Post<Dto>(It.IsAny<object>(), "https://api.example.com", It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                        .ReturnsAsync((new Dto { name = "y" }, "raw"));
            var (data, raw) = await CreateService().MakeHttpPostRequest<Dto>(new { a = 1 }, "https://api.example.com");
            data.name.Should().Be("y");
        }

        [Fact]
        public async Task MakeHttpPostRequest_Exception_ReturnsFailure()
        {
            _httpService.Setup(s => s.Post<Dto>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                        .ThrowsAsync(new InvalidOperationException("boom"));
            var (data, raw) = await CreateService().MakeHttpPostRequest<Dto>(new { a = 1 }, "https://api.example.com");
            data.Should().BeNull();
            raw.Should().Be("Operation Failed.");
        }

        // ---- MakeHttpRequest<T> ----

        [Fact]
        public async Task MakeHttpRequest_Success_DeserializesBody()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"ok\"}");
            var (data, response) = await CreateService().MakeHttpRequest<Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.name.Should().Be("ok");
            response.IsSuccessStatusCode.Should().BeTrue();
        }

        [Fact]
        public async Task MakeHttpRequest_PostWithPayloadAndToken_Succeeds()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"ok\"}");
            var (data, response) = await CreateService().MakeHttpRequest<Dto>("client", "https://api.example.com", HttpMethod.Post,
                new { field = "v" }, new Dictionary<string, string> { ["X-H"] = "1" }, "tok");
            data.name.Should().Be("ok");
        }

        [Fact]
        public async Task MakeHttpRequest_FailureWithValidJson_ReturnsResultAndResponse()
        {
            SetupClient(HttpStatusCode.BadRequest, "{\"name\":\"err\"}");
            var (data, response) = await CreateService().MakeHttpRequest<Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.name.Should().Be("err");
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task MakeHttpRequest_FailureWithInvalidJson_ReturnsNull()
        {
            SetupClient(HttpStatusCode.BadRequest, "not-json");
            var (data, response) = await CreateService().MakeHttpRequest<Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.Should().BeNull();
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task MakeHttpRequest_Exception_ReturnsEmptyResponse()
        {
            SetupClient(HttpStatusCode.OK, "", @throw: true);
            var (data, response) = await CreateService().MakeHttpRequest<Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.Should().BeNull();
            response.Should().NotBeNull();
        }

        // ---- MakeHttpDeleteRequest<T> ----

        [Fact]
        public async Task MakeHttpDeleteRequest_Success_Deserializes()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"del\"}");
            var (data, response) = await CreateService().MakeHttpDeleteRequest<Dto>("client", "https://api.example.com", HttpMethod.Delete, new { id = 1 });
            data.name.Should().Be("del");
        }

        [Fact]
        public async Task MakeHttpDeleteRequest_Exception_ReturnsEmptyResponse()
        {
            SetupClient(HttpStatusCode.OK, "", @throw: true);
            var (data, response) = await CreateService().MakeHttpDeleteRequest<Dto>("client", "https://api.example.com", HttpMethod.Delete);
            data.Should().BeNull();
            response.Should().NotBeNull();
        }

        // ---- MakeHttpRequest<T, E> ----

        [Fact]
        public async Task MakeHttpRequestTE_Success_ReturnsData()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"ok\"}");
            var (data, error, response) = await CreateService().MakeHttpRequest<Dto, Dto>("client", "https://api.example.com", HttpMethod.Post, new { a = 1 });
            data.name.Should().Be("ok");
            error.Should().BeNull();
        }

        [Fact]
        public async Task MakeHttpRequestTE_Failure_ReturnsError()
        {
            SetupClient(HttpStatusCode.UnprocessableEntity, "{\"name\":\"bad\"}");
            var (data, error, response) = await CreateService().MakeHttpRequest<Dto, Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.Should().BeNull();
            error.name.Should().Be("bad");
        }

        [Fact]
        public async Task MakeHttpRequestTE_Exception_ReturnsEmptyResponse()
        {
            SetupClient(HttpStatusCode.OK, "", @throw: true);
            var (data, error, response) = await CreateService().MakeHttpRequest<Dto, Dto>("client", "https://api.example.com", HttpMethod.Get);
            data.Should().BeNull();
            error.Should().BeNull();
            response.Should().NotBeNull();
        }
    
        // ---- MakeHttpDeleteRequest ----

        [Fact]
        public async Task MakeHttpDeleteRequest_ReturnsTheDeserialisedBodyAndTheResponse()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"deleted\"}");

            var (data, response) = await CreateService()
                .MakeHttpDeleteRequest<Dto>("dtrack", "https://api.example.com/x", HttpMethod.Delete);

            data.name.Should().Be("deleted");
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task MakeHttpDeleteRequest_StillReturnsTheResponseOnAFailureStatus()
        {
            SetupClient(HttpStatusCode.NotFound, "{\"name\":\"missing\"}");

            var (_, response) = await CreateService()
                .MakeHttpDeleteRequest<Dto>("dtrack", "https://api.example.com/x", HttpMethod.Delete);

            // The caller decides what a 404 means, so the status has to reach it rather than throw.
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task MakeHttpDeleteRequest_SendsTheBodyWhenTheVerbIsDelete()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"deleted\"}");

            var (data, _) = await CreateService().MakeHttpDeleteRequest<Dto>(
                "dtrack", "https://api.example.com/x", HttpMethod.Delete, new { uuid = "abc" });

            data.Should().NotBeNull();
        }

        [Fact]
        public async Task MakeHttpDeleteRequest_AppliesTheBearerTokenAndExtraHeaders()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"deleted\"}");

            var (data, _) = await CreateService().MakeHttpDeleteRequest<Dto>(
                "dtrack", "https://api.example.com/x", HttpMethod.Delete, null,
                new Dictionary<string, string> { ["X-Api-Key"] = "k" }, "token-1");

            data.Should().NotBeNull();
        }

        [Fact]
        public async Task MakeHttpDeleteRequest_ReturnsAnEmptyResponseRatherThanThrowingOnANetworkFailure()
        {
            SetupClient(HttpStatusCode.OK, string.Empty, @throw: true);

            var (data, response) = await CreateService()
                .MakeHttpDeleteRequest<Dto>("dtrack", "https://api.example.com/x", HttpMethod.Delete);

            data.Should().BeNull();
            response.Should().NotBeNull();
        }

        // ---- MakeHttpRequest ----

        [Fact]
        public async Task MakeHttpRequest_ReturnsTheDataOnSuccess()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"ok\"}");

            var (data, error, response) = await CreateService()
                .MakeHttpRequest<Dto, Dto>("dtrack", "https://api.example.com/x", HttpMethod.Post, new { a = 1 });

            data.name.Should().Be("ok");
            error.Should().BeNull();
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task MakeHttpRequest_ReturnsTheErrorShapeOnAFailureStatus()
        {
            SetupClient(HttpStatusCode.BadRequest, "{\"name\":\"bad request\"}");

            var (data, error, response) = await CreateService()
                .MakeHttpRequest<Dto, Dto>("dtrack", "https://api.example.com/x", HttpMethod.Post, new { a = 1 });

            // A failure body is deserialised into the error type, not the success type.
            data.Should().BeNull();
            error.name.Should().Be("bad request");
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task MakeHttpRequest_AppliesTheBearerTokenAndExtraHeaders()
        {
            SetupClient(HttpStatusCode.OK, "{\"name\":\"ok\"}");

            var (data, _, _) = await CreateService().MakeHttpRequest<Dto, Dto>(
                "dtrack", "https://api.example.com/x", HttpMethod.Post, null,
                new Dictionary<string, string> { ["X-Api-Key"] = "k" }, "token-1");

            data.Should().NotBeNull();
        }

        [Fact]
        public async Task MakeHttpRequest_ReturnsNullsRatherThanThrowingOnANetworkFailure()
        {
            SetupClient(HttpStatusCode.OK, string.Empty, @throw: true);

            var (data, error, response) = await CreateService()
                .MakeHttpRequest<Dto, Dto>("dtrack", "https://api.example.com/x", HttpMethod.Post);

            data.Should().BeNull();
            error.Should().BeNull();
            response.Should().NotBeNull();
        }

        // ---- SendWithTimeoutAsync (#279 P7, C6) ----

        /// <summary>Records the request it was sent, then answers, fails or never answers.</summary>
        private sealed class RecordingHandler : HttpMessageHandler
        {
            private readonly Func<CancellationToken, Task<HttpResponseMessage>> _answer;
            public HttpRequestMessage Request { get; private set; }
            public string RequestBody { get; private set; }

            public RecordingHandler(Func<CancellationToken, Task<HttpResponseMessage>> answer) => _answer = answer;

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Request = request;
                RequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
                return await _answer(cancellationToken);
            }
        }

        private RecordingHandler UseHandler(Func<CancellationToken, Task<HttpResponseMessage>> answer)
        {
            var handler = new RecordingHandler(answer);
            _clientFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
            return handler;
        }

        [Fact]
        public async Task SendWithTimeoutAsync_ADelayedAnswer_IsCancelledAtTheTimeoutAndReportedAsNoAnswer()
        {
            var cancelled = false;
            UseHandler(async token =>
            {
                try
                {
                    await Task.Delay(Timeout.Infinite, token);
                }
                catch (OperationCanceledException)
                {
                    cancelled = true;
                    throw;
                }
                return new HttpResponseMessage(HttpStatusCode.OK);
            });

            var result = await CreateService().SendWithTimeoutAsync(
                "github", "https://api.example.com/hooks", HttpMethod.Get, null, null, "tok", TimeSpan.FromMilliseconds(50));

            cancelled.Should().BeTrue("the call is cancelled, not left running");
            result.TransportFailed.Should().BeTrue();
            result.StatusCode.Should().BeNull("a timeout is never a made-up 200");
        }

        [Fact]
        public async Task SendWithTimeoutAsync_ANetworkFailure_IsReportedAsNoAnswer()
        {
            UseHandler(_ => throw new HttpRequestException("network down"));

            var result = await CreateService().SendWithTimeoutAsync(
                "github", "https://api.example.com/hooks", HttpMethod.Get, null, null, "tok", TimeSpan.FromSeconds(10));

            result.TransportFailed.Should().BeTrue();
        }

        [Theory]
        [InlineData(HttpStatusCode.NotFound, "{\"message\":\"Not Found\"}")]
        [InlineData(HttpStatusCode.Created, "{\"id\":42}")]
        public async Task SendWithTimeoutAsync_ReturnsTheStatusAndBodyAsAnswered(HttpStatusCode status, string body)
        {
            UseHandler(_ => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) }));

            var result = await CreateService().SendWithTimeoutAsync(
                "github", "https://api.example.com/hooks", HttpMethod.Post, null, null, "tok", TimeSpan.FromSeconds(10));

            result.TransportFailed.Should().BeFalse();
            result.StatusCode.Should().Be(status);
            result.Body.Should().Be(body);
        }

        [Fact]
        public async Task SendWithTimeoutAsync_SendsTheTokenHeadersAndPayloadOnTheRequest()
        {
            var handler = UseHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") }));

            await CreateService().SendWithTimeoutAsync(
                "github", "https://api.example.com/hooks/7", HttpMethod.Patch, new { active = true },
                new Dictionary<string, string> { ["Accept"] = "application/vnd.github.v3+json" }, "tok", TimeSpan.FromSeconds(10));

            handler.Request.Method.Should().Be(HttpMethod.Patch);
            handler.Request.RequestUri.Should().Be(new Uri("https://api.example.com/hooks/7"));
            handler.Request.Headers.Authorization.Scheme.Should().Be("Bearer");
            handler.Request.Headers.Authorization.Parameter.Should().Be("tok");
            handler.Request.Headers.Accept.ToString().Should().Be("application/vnd.github.v3+json");
            handler.RequestBody.Should().Be("{\"active\":true}");
        }

        [Fact]
        public async Task SendWithTimeoutAsync_SendsNoAuthorizationWithoutAToken()
        {
            var handler = UseHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") }));

            await CreateService().SendWithTimeoutAsync(
                "github", "https://api.example.com/repos/org/web", HttpMethod.Get, null, null, null, TimeSpan.FromSeconds(10));

            handler.Request.Headers.Authorization.Should().BeNull();
            handler.RequestBody.Should().BeNull();
        }
}
}
