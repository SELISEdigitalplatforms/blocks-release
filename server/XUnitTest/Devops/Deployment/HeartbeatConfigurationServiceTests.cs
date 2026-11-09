using System;
using System.Net;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// <see cref="HeartbeatConfigurationService"/> must apply blocks-monitor's heartbeat rules, since release
    /// now writes these changes itself instead of going through blocks-logic.
    /// </summary>
    public class HeartbeatConfigurationServiceTests : IDisposable
    {
        private const string Tenant = "tenant-1";
        private readonly Mock<IHeartbeatConfigurationStore> _store = new();
        private readonly HeartbeatConfigurationService _sut;

        public HeartbeatConfigurationServiceTests()
        {
            SetCallerTenant(Tenant);
            _sut = new HeartbeatConfigurationService(_store.Object, new Mock<ILogger<HeartbeatConfigurationService>>().Object);
        }

        public void Dispose() => BlocksContext.ClearContext();

        private static void SetCallerTenant(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        private static MonitorConfiguration AHeartbeat(MonitorSourceTypes? source = MonitorSourceTypes.DeployedServices) => new()
        {
            ItemId = "hb-1",
            TenantId = Tenant,
            Name = "old name",
            Url = "https://monitor/api/health/ping/hb-1",
            MonitorConfigurationType = MonitorConfigurationTypes.InboundPing,
            MonitorSourceType = source,
            IntervalInSeconds = 120,
            GracePeriodInSeconds = 45,
            IsActive = true
        };

        private void Existing(MonitorConfiguration? heartbeat) =>
            _store.Setup(s => s.GetAsync("hb-1")).ReturnsAsync(heartbeat);

        // ---- Update ----

        [Fact]
        public async Task Update_ChangesOnlyTheEditableFields_AndKeepsUnsetOnes()
        {
            var heartbeat = AHeartbeat();
            Existing(heartbeat);

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1", IsActive = false });

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            _store.Verify(s => s.UpdateEditableFieldsAsync(It.Is<MonitorConfiguration>(m =>
                m.Name == "old name"
                && m.IntervalInSeconds == 120
                && m.GracePeriodInSeconds == 45
                && m.IsActive == false
                && m.LastUpdatedBy == "user-1")), Times.Once);
        }

        [Fact]
        public async Task Update_AppliesPositiveIntervalsAndANewName()
        {
            Existing(AHeartbeat());

            await _sut.UpdateAsync(new UpdateHealthRequest
            {
                ItemId = "hb-1", Name = "new name", IntervalInSeconds = 300, GracePeriodInSeconds = 60, IsActive = true
            });

            _store.Verify(s => s.UpdateEditableFieldsAsync(It.Is<MonitorConfiguration>(m =>
                m.Name == "new name" && m.IntervalInSeconds == 300 && m.GracePeriodInSeconds == 60)), Times.Once);
        }

        [Fact]
        public async Task Update_MissingHeartbeat_IsNotFound()
        {
            Existing(null);

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.NotFound);
            _store.Verify(s => s.UpdateEditableFieldsAsync(It.IsAny<MonitorConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Update_AnotherTenantsHeartbeat_IsReportedAsNotFound()
        {
            var heartbeat = AHeartbeat();
            heartbeat.TenantId = "other-tenant";
            Existing(heartbeat);

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1" });

            result.StatusCode.Should().Be(HttpStatusCode.NotFound);
            _store.Verify(s => s.UpdateEditableFieldsAsync(It.IsAny<MonitorConfiguration>()), Times.Never);
        }

        [Theory]
        [InlineData(MonitorSourceTypes.BlocksServices)]
        [InlineData(MonitorSourceTypes.Infrastructure)]
        public async Task Update_ManagedByBlocks_IsRefused(MonitorSourceTypes source)
        {
            Existing(AHeartbeat(source));

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1" });

            result.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            result.Message.Should().Be(HeartbeatConfigurationService.ManagedByBlocksMessage);
            _store.Verify(s => s.UpdateEditableFieldsAsync(It.IsAny<MonitorConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Update_LegacySourceTypeField_StillCountsAsManaged()
        {
            var heartbeat = AHeartbeat(source: null);
            heartbeat.LegacyMonitorSourceType = MonitorSourceTypes.BlocksServices;
            Existing(heartbeat);

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1" });

            result.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Update_WithoutItemId_IsABadRequest()
        {
            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = " " });

            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            _store.Verify(s => s.GetAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Update_StoreFailure_IsAFailedResponse()
        {
            Existing(AHeartbeat());
            _store.Setup(s => s.UpdateEditableFieldsAsync(It.IsAny<MonitorConfiguration>()))
                  .ThrowsAsync(new InvalidOperationException("db down"));

            var result = await _sut.UpdateAsync(new UpdateHealthRequest { ItemId = "hb-1" });

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
            result.Message.Should().NotContain("db down");
        }

        // ---- Delete ----

        [Fact]
        public async Task Delete_RemovesTheHeartbeat()
        {
            Existing(AHeartbeat());
            _store.Setup(s => s.DeleteAsync("hb-1")).ReturnsAsync(true);

            var result = await _sut.DeleteAsync("hb-1");

            result.IsSuccess.Should().BeTrue();
            _store.Verify(s => s.DeleteAsync("hb-1"), Times.Once);
        }

        [Fact]
        public async Task Delete_MissingHeartbeat_IsA200NotFound()
        {
            Existing(null);

            var result = await _sut.DeleteAsync("hb-1");

            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
            _store.Verify(s => s.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_AnotherTenantsHeartbeat_IsNotDeleted()
        {
            var heartbeat = AHeartbeat();
            heartbeat.TenantId = "other-tenant";
            Existing(heartbeat);

            var result = await _sut.DeleteAsync("hb-1");

            result.IsSuccess.Should().BeFalse();
            _store.Verify(s => s.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_ManagedByBlocks_IsRefused()
        {
            Existing(AHeartbeat(MonitorSourceTypes.BlocksServices));

            var result = await _sut.DeleteAsync("hb-1");

            result.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            _store.Verify(s => s.DeleteAsync(It.IsAny<string>()), Times.Never);
        }
    }
}
