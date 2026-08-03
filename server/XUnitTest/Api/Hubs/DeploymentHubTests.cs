using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using BlocksTemplate.Api.Hubs;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Connections.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Api.Hubs
{
    /// <summary>
    /// Covers the SignalR hub and the hub service that fans build logs out to
    /// per user groups. SendAsync is an extension method over IClientProxy, so the
    /// assertions target SendCoreAsync.
    /// </summary>
    public class DeploymentHubTests
    {
        private const string EventName = "BuildLogNotification";

        private readonly Mock<IHubContext<DeploymentLogHub>> _hubContext = new();
        private readonly Mock<IHubClients> _clients = new();
        private readonly Mock<IClientProxy> _proxy = new();
        private readonly Mock<ILogger<DeploymentHubService>> _logger = new();

        public DeploymentHubTests()
        {
            _hubContext.SetupGet(h => h.Clients).Returns(_clients.Object);
            _clients.SetupGet(c => c.All).Returns(_proxy.Object);
            _clients.Setup(c => c.Groups(It.IsAny<IReadOnlyList<string>>())).Returns(_proxy.Object);
        }

        private DeploymentHubService Service() => new(_hubContext.Object, _logger.Object);

        [Fact]
        public async Task SendBuildLogAsync_NoUserIds_BroadcastsToAllClients()
        {
            await Service().SendBuildLogAsync(new { log = "hello" });

            _clients.VerifyGet(c => c.All, Times.Once);
            _proxy.Verify(p => p.SendCoreAsync(EventName, It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
            _clients.Verify(c => c.Groups(It.IsAny<IReadOnlyList<string>>()), Times.Never);
        }

        [Fact]
        public async Task SendBuildLogAsync_OnlyBlankUserIds_BroadcastsToAllClients()
        {
            await Service().SendBuildLogAsync(new { log = "hello" }, new[] { "", "   ", null });

            _clients.VerifyGet(c => c.All, Times.Once);
            _clients.Verify(c => c.Groups(It.IsAny<IReadOnlyList<string>>()), Times.Never);
        }

        [Fact]
        public async Task SendBuildLogAsync_UserIds_SendsToDistinctGroupsOnly()
        {
            IReadOnlyList<string> groups = null;
            _clients
                .Setup(c => c.Groups(It.IsAny<IReadOnlyList<string>>()))
                .Callback<IReadOnlyList<string>>(g => groups = g)
                .Returns(_proxy.Object);

            await Service().SendBuildLogAsync(new { log = "hello" }, new[] { "u1", "u2", "u1", " " });

            groups.Should().BeEquivalentTo(new[] { "u1", "u2" });
            _proxy.Verify(p => p.SendCoreAsync(EventName, It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
            _clients.VerifyGet(c => c.All, Times.Never);
        }

        // ---- DeploymentLogHub ----

        private sealed class TestHttpContextFeature : IHttpContextFeature
        {
            public HttpContext HttpContext { get; set; }
        }

        private static DeploymentLogHub HubWith(string queryString, Mock<IGroupManager> groups)
        {
            var httpContext = new DefaultHttpContext();
            httpContext.Request.QueryString = new QueryString(queryString);

            var features = new Microsoft.AspNetCore.Http.Features.FeatureCollection();
            features.Set<IHttpContextFeature>(new TestHttpContextFeature { HttpContext = httpContext });

            var callerContext = new Mock<HubCallerContext>();
            callerContext.SetupGet(c => c.Features).Returns(features);
            callerContext.SetupGet(c => c.ConnectionId).Returns("conn-1");

            return new DeploymentLogHub
            {
                Context = callerContext.Object,
                Groups = groups.Object
            };
        }

        [Fact]
        public async Task OnConnectedAsync_WithUserId_JoinsUserGroup()
        {
            var groups = new Mock<IGroupManager>();

            await HubWith("?userId=u1", groups).OnConnectedAsync();

            groups.Verify(g => g.AddToGroupAsync("conn-1", "u1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task OnConnectedAsync_WithoutUserId_JoinsNothing()
        {
            var groups = new Mock<IGroupManager>();

            await HubWith("?other=x", groups).OnConnectedAsync();

            groups.Verify(g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task OnDisconnectedAsync_WithUserId_LeavesUserGroup()
        {
            var groups = new Mock<IGroupManager>();

            await HubWith("?userId=u1", groups).OnDisconnectedAsync(null);

            groups.Verify(g => g.RemoveFromGroupAsync("conn-1", "u1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task OnDisconnectedAsync_WithoutUserId_LeavesNothing()
        {
            var groups = new Mock<IGroupManager>();

            await HubWith(string.Empty, groups).OnDisconnectedAsync(new InvalidOperationException("dropped"));

            groups.Verify(g => g.RemoveFromGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
