using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Api.Controllers;
using Devops.DomainService.Deployment.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers
{
    public class DeploymentHubBroadcastControllerTests
    {
        private readonly Mock<IDeploymentHubService> _hub = new();

        private DeploymentHubBroadcastController CreateController(string expectedSecret)
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["InternalHubSecret"] = expectedSecret })
                .Build();
            return new DeploymentHubBroadcastController(_hub.Object, config, new Mock<ILogger<DeploymentHubBroadcastController>>().Object);
        }

        private static DeploymentHubBroadcastController.BroadcastRequest RequestWithPayload()
        {
            using var doc = JsonDocument.Parse("{\"log\":\"hello\"}");
            return new DeploymentHubBroadcastController.BroadcastRequest
            {
                Payload = doc.RootElement.Clone(),
                UserIds = new List<string> { "u1" }
            };
        }

        [Fact]
        public async Task Broadcast_InvalidSecret_ReturnsUnauthorized()
        {
            var result = await CreateController("expected").Broadcast("wrong", RequestWithPayload());
            result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task Broadcast_MissingSecret_ReturnsUnauthorized()
        {
            var result = await CreateController("expected").Broadcast(null, RequestWithPayload());
            result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task Broadcast_NoExpectedConfigured_ReturnsUnauthorized()
        {
            var result = await CreateController("").Broadcast("anything", RequestWithPayload());
            result.Should().BeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task Broadcast_NullPayload_ReturnsBadRequest()
        {
            var request = new DeploymentHubBroadcastController.BroadcastRequest { Payload = null };
            var result = await CreateController("secret").Broadcast("secret", request);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Broadcast_Valid_SendsAndReturnsOk()
        {
            var result = await CreateController("secret").Broadcast("secret", RequestWithPayload());
            result.Should().BeOfType<OkResult>();
            _hub.Verify(h => h.SendBuildLogAsync(It.IsAny<object>(), It.IsAny<IReadOnlyCollection<string>>()), Times.Once);
        }
    }
}
