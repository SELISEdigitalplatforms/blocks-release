using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.RepositoryServices;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;
using XUnitTest.Devops.Deployment;

namespace XUnitTest.Routing;

public sealed class DeploymentTeardownPlacementTests : IDisposable
{
    private readonly TenantPlacementFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    [Fact]
    public async Task DisabledEnvironments_AreArchivedInTheirStoredDatabases_WithoutAmbientContext()
    {
        BlocksContext.ClearContext();
        var dev = Project("dev", _fixture.Dev, _fixture.Secret.DevDatabaseConnectionString);
        var other = Project("other", _fixture.Other, _fixture.Secret.OtherDatabaseConnectionString);
        await _fixture.Main.GetCollection<Tenant>("Tenants").InsertManyAsync([dev, other]);
        await _fixture.Dev.GetCollection<Repo>("Repos").InsertOneAsync(Repository(dev.TenantId));
        await _fixture.Other.GetCollection<Repo>("Repos").InsertOneAsync(Repository(other.TenantId));

        var configuration = new ConfigurationBuilder().Build();
        var repos = new RepoRepository(_fixture.Provider, configuration,
            NullLogger<RepoRepository>.Instance, _fixture.Secret);
        var tenants = new TenantLookupRepository(NullLogger<TenantLookupRepository>.Instance,
            _fixture.Provider, _fixture.Secret);
        var service = new DeploymentTeardownService(NullLogger<DeploymentTeardownService>.Instance,
            tenants, repos, new DeploymentServiceFactory().BuildService(), new Mock<ISecretService>().Object);

        var summary = await service.TearDownAsync(new ProjectDeleteQueue { TenantGroupId = "group-1" });

        Assert.False(summary.HasFailures);
        Assert.Equal(2, summary.ProjectsVisited);
        Assert.Equal(2, summary.ReposArchived);
        Assert.True((await _fixture.Dev.GetCollection<Repo>("Repos")
            .Find(r => r.ItemId == "same").FirstAsync()).IsArchived);
        Assert.True((await _fixture.Other.GetCollection<Repo>("Repos")
            .Find(r => r.ItemId == "same").FirstAsync()).IsArchived);
        Assert.Equal(0, await _fixture.Main.GetCollection<Repo>("Repos").CountDocumentsAsync(r => true));
    }

    private static Tenant Project(string tenantId, IMongoDatabase database, string connection) => new()
    {
        ItemId = tenantId,
        TenantId = tenantId,
        TenantGroupId = "group-1",
        DBName = database.DatabaseNamespace.DatabaseName,
        DbConnectionString = connection,
        IsDisabled = true,
        JwtTokenParameters = null!
    };

    private static Repo Repository(string tenantId) => new()
    {
        ItemId = "same",
        ProjectId = tenantId,
        RepoName = "shared/repo",
        SourceRepoId = "shared-resource"
    };
}
