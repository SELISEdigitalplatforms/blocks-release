using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Entity;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.DataGetwayDeployment.Models;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class DataGatewayDeploymentRepositoryIntegrationTests
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IBlocksSecret> _secret = new();

        public DataGatewayDeploymentRepositoryIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            _secret.SetupGet(s => s.RootDatabaseName).Returns("BlocksRootDb");
        }

        private DataGatewayDeploymentRepository CreateRepo() =>
            new(new Mock<ILogger<DataGatewayDeploymentRepository>>().Object, _fixture.DbContextProvider, _secret.Object);

        private static Tenant NewTenant(string tenantId) => new()
        {
            TenantId = tenantId,
            Name = "proj",
            Environment = "dev",
            DbConnectionString = "cs",
            JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
        };

        [Fact]
        public async Task GetTenantByIdAsync_NotFound_ReturnsNull()
        {
            (await CreateRepo().GetTenantByIdAsync(Guid.NewGuid().ToString("N"))).Should().BeNull();
        }

        [Fact]
        public async Task GetTenantByIdAsync_Found_ReturnsTenant()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<Tenant>("Tenants").InsertOneAsync(NewTenant(tenantId));
            var result = await CreateRepo().GetTenantByIdAsync(tenantId);
            result.Should().NotBeNull();
            result.TenantId.Should().Be(tenantId);
        }

        [Fact]
        public async Task GetBlocksGuidAsync_Found_ReturnsGuid()
        {
            var groupId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<BlocksGuid>("BlocksGuids").InsertOneAsync(new BlocksGuid
            {
                ItemId = Guid.NewGuid().ToString("N"),
                TenantGroupId = groupId,
                OriginalValue = "o",
                EncodedValue = "e"
            });
            var result = await CreateRepo().GetBlocksGuidAsync(groupId);
            result.Should().NotBeNull();
            result.EncodedValue.Should().Be("e");
        }

        [Fact]
        public async Task AddAndGetDataGatewayInstance_RoundTrips()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            var sut = CreateRepo();
            var instance = new DataGatewayInstance
            {
                ItemId = Guid.NewGuid().ToString("N"),
                TenantId = tenantId,
                ProjectGuid = "guid-1",
                DataGatewayInstanceDeploymentLog = new List<DataGatewayInstanceDeploymentLogs>()
            };

            var added = await sut.AddDataGatewayInstanceAsync(instance);
            added.Should().NotBeNull();

            var fetched = await sut.GetDataGatewayInstanceAsync("any-tenant", tenantId);
            fetched.Should().NotBeNull();
            fetched.ProjectGuid.Should().Be("guid-1");
        }

        [Fact]
        public async Task UpsertDataGatewayInstanceAsync_NewInstance_Inserts()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            var sut = CreateRepo();
            var ok = await sut.UpsertDataGatewayInstanceAsync(NewTenant(tenantId), "proj-key", "run-1");
            ok.Should().BeTrue();

            // The inserted instance carries TenantId == project.TenantId, and the lookup
            // filters DataGatewayInstance.TenantId against its second argument.
            var fetched = await sut.GetDataGatewayInstanceAsync(tenantId, tenantId);
            fetched.Should().NotBeNull();
            fetched.LastPipelineRunName.Should().Be("run-1");
        }

        [Fact]
        public async Task UpsertDataGatewayInstanceAsync_Existing_UpdatesAndAppendsLog()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            var sut = CreateRepo();
            await sut.UpsertDataGatewayInstanceAsync(NewTenant(tenantId), tenantId, "run-1");
            // second upsert with same tenant/projectKey (projectKey must equal tenantId to match GetDataGatewayInstance filter)
            var ok = await sut.UpsertDataGatewayInstanceAsync(NewTenant(tenantId), tenantId, "run-2");
            ok.Should().BeTrue();

            var fetched = await sut.GetDataGatewayInstanceAsync(tenantId, tenantId);
            fetched.LastPipelineRunName.Should().Be("run-2");
            fetched.DataGatewayInstanceDeploymentLog.Should().HaveCountGreaterThanOrEqualTo(2);
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_Matches_UpdatesStatus()
        {
            var tenantId = Guid.NewGuid().ToString("N");
            var sut = CreateRepo();
            await sut.UpsertDataGatewayInstanceAsync(NewTenant(tenantId), tenantId, "run-x");

            var ok = await sut.UpdatePipelineStatusAsync(tenantId, "run-x", "Succeeded");
            ok.Should().BeTrue();

            var fetched = await sut.GetDataGatewayInstanceAsync(tenantId, tenantId);
            fetched.LastDeploymentStatus.Should().Be("Succeeded");
        }

        [Fact]
        public async Task UpdatePipelineStatusAsync_NoMatch_ReturnsFalse()
        {
            var ok = await CreateRepo().UpdatePipelineStatusAsync(Guid.NewGuid().ToString("N"), "nope", "Succeeded");
            ok.Should().BeFalse();
        }
    }
}
