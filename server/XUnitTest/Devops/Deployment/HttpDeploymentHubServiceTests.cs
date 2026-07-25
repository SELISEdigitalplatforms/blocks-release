using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Devops.DomainService.Deployment.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class HttpDeploymentHubServiceTests
    {
        private readonly Mock<IHttpClientFactory> _clientFactory = new();

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _code;
            private readonly bool _throw;
            public int Calls { get; private set; }
            public StubHandler(HttpStatusCode code, bool @throw = false) { _code = code; _throw = @throw; }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Calls++;
                if (_throw) throw new HttpRequestException("down");
                return Task.FromResult(new HttpResponseMessage(_code) { Content = new StringContent("body") });
            }
        }

        private HttpDeploymentHubService CreateService(Dictionary<string, string> settings)
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            return new HttpDeploymentHubService(_clientFactory.Object, config, new Mock<ILogger<HttpDeploymentHubService>>().Object);
        }

        private StubHandler SetupClient(HttpStatusCode code, bool @throw = false)
        {
            var handler = new StubHandler(code, @throw);
            _clientFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
            return handler;
        }

        [Fact]
        public async Task SendBuildLogAsync_NoBaseUrl_DropsWithoutHttpCall()
        {
            var handler = SetupClient(HttpStatusCode.OK);
            var sut = CreateService(new Dictionary<string, string> { ["InternalHubSecret"] = "s" });
            await sut.SendBuildLogAsync(new { log = "x" }, new[] { "u1" });
            handler.Calls.Should().Be(0);
        }

        [Fact]
        public async Task SendBuildLogAsync_NoSecret_DropsWithoutHttpCall()
        {
            var handler = SetupClient(HttpStatusCode.OK);
            var sut = CreateService(new Dictionary<string, string> { ["DeploymentApiBaseUrl"] = "https://api.example.com" });
            await sut.SendBuildLogAsync(new { log = "x" }, null);
            handler.Calls.Should().Be(0);
        }

        [Fact]
        public async Task SendBuildLogAsync_Configured_PostsToBroadcast()
        {
            var handler = SetupClient(HttpStatusCode.OK);
            var sut = CreateService(new Dictionary<string, string>
            {
                ["DeploymentApiBaseUrl"] = "https://api.example.com/",
                ["InternalHubSecret"] = "secret"
            });
            await sut.SendBuildLogAsync(new { log = "x" }, new[] { "u1", "u1", "" });
            handler.Calls.Should().Be(1);
        }

        [Fact]
        public async Task SendBuildLogAsync_NonSuccess_LogsAndSwallows()
        {
            var handler = SetupClient(HttpStatusCode.InternalServerError);
            var sut = CreateService(new Dictionary<string, string>
            {
                ["DeploymentApiBaseUrl"] = "https://api.example.com",
                ["RootTenantId"] = "root"
            });
            await sut.SendBuildLogAsync(new { log = "x" }, new[] { "u1" });
            handler.Calls.Should().Be(1);
        }

        [Fact]
        public async Task SendBuildLogAsync_Exception_Swallows()
        {
            SetupClient(HttpStatusCode.OK, @throw: true);
            var sut = CreateService(new Dictionary<string, string>
            {
                ["DeploymentApiBaseUrl"] = "https://api.example.com",
                ["InternalHubSecret"] = "secret"
            });
            var act = () => sut.SendBuildLogAsync(new { log = "x" }, new[] { "u1" });
            await act.Should().NotThrowAsync();
        }
    }
}
