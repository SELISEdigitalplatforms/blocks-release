using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Interfaces;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class NotificationServiceTests
    {
        private readonly Mock<ICryptoService> _crypto = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IDeploymentHubService> _hub = new();
        private readonly IConfiguration _config;

        public NotificationServiceTests()
        {
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["RootTenantId"] = "root",
                    ["NotificationServiceUrl"] = "https://notify.example.com",
                    ["BlocksAppNotificationReceiver"] = "receiver"
                })
                .Build();
            _crypto.Setup(c => c.Hash(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>())).Returns("hashed");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant)null);
        }

        private NotificationService CreateService() =>
            new(new Mock<ILogger<NotificationService>>().Object, _crypto.Object, _tenants.Object, _config, _http.Object, _hub.Object);

        private void SetupPost(bool success) =>
            _http.Setup(h => h.MakeHttpPostRequest<NotificationResponse>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<string>()))
                 .ReturnsAsync((new NotificationResponse { isSuccess = success, errors = success ? null : "err" }, "raw"));

        [Fact]
        public async Task NotifySingle_Success_ReturnsTrue()
        {
            SetupPost(true);
            var result = await CreateService().NotifyPipeLineLogData(
                new BuildEventResponse { BuildId = "b", Message = "m" }, new List<string> { "u1" }, "t", "r", "SUCCEEDED");
            result.Should().BeTrue();
        }

        [Fact]
        public async Task NotifySingle_Failure_ReturnsTrue()
        {
            SetupPost(false);
            var result = await CreateService().NotifyPipeLineLogData(
                new BuildEventResponse { BuildId = "b" }, new List<string> { "u1" }, "t", "r", "FAILED");
            result.Should().BeTrue();
        }

        [Fact]
        public async Task NotifyList_Success_ReturnsTrue()
        {
            SetupPost(true);
            var result = await CreateService().NotifyPipeLineLogData(
                new List<BuildEventResponse> { new() { BuildId = "b" } }, new List<string> { "u1", "u2" }, "t", "r", "SUCCEEDED");
            result.Should().BeTrue();
        }

        [Fact]
        public async Task NotifyList_Failure_ReturnsTrue()
        {
            SetupPost(false);
            var result = await CreateService().NotifyPipeLineLogData(
                new List<BuildEventResponse> { new() { BuildId = "b" } }, new List<string> { "u1" }, "t", "r", "FAILED");
            result.Should().BeTrue();
        }

        [Fact]
        public async Task NotifyList_NullTenant_StillReturnsTrue()
        {
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant)null);
            SetupPost(true);
            var result = await CreateService().NotifyPipeLineLogData(
                new List<BuildEventResponse> { new() { BuildId = "b" } }, new List<string> { "u1" }, "t", "r", "SUCCEEDED");
            result.Should().BeTrue();
        }
    }
}
