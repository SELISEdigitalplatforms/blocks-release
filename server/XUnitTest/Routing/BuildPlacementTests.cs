using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.RepositoryServices;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Routing;

public class BuildPlacementTests : IDisposable
{
    private readonly TenantPlacementFixture _fixture = new();
    private static IConfiguration Configuration => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["RootTenantId"] = "root" }).Build();
    private BuildRepository Repository => new(_fixture.Provider, NullLogger<BuildRepository>.Instance, Configuration, _fixture.Secret);
    public void Dispose() => _fixture.Dispose();

    [Fact]
    public void Construction_DoesNotResolveAnAmbientTenant()
    {
        BlocksContext.ClearContext();
        var provider = new Mock<IDbContextProvider>(MockBehavior.Strict);
        _ = new BuildRepository(provider.Object, NullLogger<BuildRepository>.Instance, Configuration, _fixture.Secret);
        provider.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HostingProviders_ComeFromRoot_WithoutAnAmbientContext()
    {
        BlocksContext.ClearContext();
        await _fixture.Main.GetCollection<HostingProvider>("HostingProviders")
            .InsertOneAsync(new HostingProvider { Name = "root-provider", Status = "active" });
        await _fixture.Dev.GetCollection<HostingProvider>("HostingProviders")
            .InsertOneAsync(new HostingProvider { Name = "tenant-provider", Status = "active" });
        var providers = await Repository.GetHostingProviders();
        Assert.Equal("root-provider", Assert.Single(providers).Name);
    }

    [Fact]
    public async Task ExplicitWorkerTargets_IsolateBuildsCallbacksAndWebhooks_WithIdenticalIds()
    {
        BlocksContext.ClearContext();
        var repository = Repository;
        await Task.WhenAll(new[] { "dev", "other" }.Select(async tenant =>
        {
            await repository.SaveBuild(new Build { ItemId = "same", RepoId = "repo", PipelineRunName = "pipeline", Status = "created" }, tenant);
            await repository.UpdateBuildStatus("pipeline", tenant, tenant);
            await repository.SaveWebhook(new RepositoryWebhook { ItemId = "same" }, tenant);
        }));
        foreach (var tenant in new[] { "dev", "other" })
        {
            Assert.Equal(tenant, (await repository.GetBuild("same", tenant))!.Status);
            Assert.Equal(tenant, (await repository.GetBuildByPipelineRunName("pipeline", tenant))!.Status);
            Assert.Single((await repository.GetBuilds("repo", tenant))!);
            Assert.Equal(1, await _fixture.Provider.GetDatabase(tenant).GetCollection<RepositoryWebhook>("RepositoryWebhooks").CountDocumentsAsync(w => true));
            Assert.Equal(0, await _fixture.Provider.GetDatabase(tenant).GetCollection<Build>("Builds").CountDocumentsAsync(b => b.Status != tenant));
        }
        Assert.Equal(0, await _fixture.Main.GetCollection<Build>("Builds").CountDocumentsAsync(b => true));
        Assert.Equal(0, await _fixture.Main.GetCollection<RepositoryWebhook>("RepositoryWebhooks").CountDocumentsAsync(w => true));
    }
}
