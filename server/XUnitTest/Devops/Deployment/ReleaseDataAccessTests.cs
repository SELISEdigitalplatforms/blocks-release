using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment;

/// <summary>The resolver wrapper: granted/denied reads, mutation filters, insert gate, missing schema, skip path.</summary>
public class ReleaseDataAccessTests : IDisposable
{
    private readonly Mock<IDataAccessResolver> _resolver = new();
    private readonly Mock<ILogger<ReleaseDataAccess>> _logger = new();
    private readonly ReleaseDataAccess _sut;

    private static readonly FilterDefinition<Repo> UserFilter = Builders<Repo>.Filter.Eq(r => r.ItemId, "r1");

    public ReleaseDataAccessTests()
    {
        BlocksContext.IsTestMode = true;
        SetContext("t1", authenticated: true);
        _sut = new ReleaseDataAccess(_resolver.Object, _logger.Object);
    }

    public void Dispose()
    {
        BlocksContext.SetContext(null);
        BlocksContext.IsTestMode = false;
    }

    private static void SetContext(string tenantId, bool authenticated) =>
        BlocksContext.SetContext(BlocksContext.Create(
            tenantId, new[] { "role" }, "user-1", authenticated, "uri", "org",
            DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
            "phone", "display", "oauth", tenantId));

    private static PolicyEvaluationResult Result(bool granted) =>
        new() { IsAccessGranted = granted };

    private static BsonDocument Render(FilterDefinition<Repo> f) =>
        f.Render(new RenderArgs<Repo>(BsonSerializer.LookupSerializer<Repo>(), BsonSerializer.SerializerRegistry));

    private void VerifyLogged(LogLevel level, string text) =>
        _logger.Verify(l => l.Log(level, It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains(text)), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.AtLeastOnce);

    [Fact]
    public async Task Read_Granted_UsesResolverFilterAndProjection()
    {
        var resolverFilter = new BsonDocument("$and", new BsonArray { new BsonDocument("ItemId", "r1"), new BsonDocument("OrganizationId", "org") });
        var projection = new BsonDocument("ItemId", 1);
        _resolver.Setup(r => r.ResolveReadAsync("Repo", It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Reflect.Read(Result(true), resolverFilter, projection));

        var scope = await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "test");

        scope.Granted.Should().BeTrue();
        Render(scope.Filter).ToJson().Should().Be(resolverFilter.ToJson());
        scope.Projection.Should().NotBeNull();
        _resolver.Verify(r => r.ResolveReadAsync("Repo",
            It.Is<BsonDocument>(d => d.ToJson().Contains("r1")), null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Read_Granted_WithoutProjectionFlag_DropsProjection()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Reflect.Read(Result(true), new BsonDocument("a", 1), new BsonDocument("a", 1)));

        var scope = await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "test", useProjection: false);

        scope.Granted.Should().BeTrue();
        scope.Projection.Should().BeNull();
    }

    [Fact]
    public async Task Read_Denied_ReturnsNotGranted()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Reflect.Read(Result(false), null, null));

        (await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "test")).Granted.Should().BeFalse();
    }

    [Fact]
    public async Task Edit_UsesResolverFilter_AndDeniedReturnsNull()
    {
        var resolverFilter = new BsonDocument("ItemId", "scoped");
        _resolver.Setup(r => r.ResolveMutationFilterAsync("Repo", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), resolverFilter));

        var filter = await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "test");
        Render(filter!).ToJson().Should().Be(resolverFilter.ToJson());

        _resolver.Setup(r => r.ResolveMutationFilterAsync("Repo", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(false), null));
        (await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "test")).Should().BeNull();
    }

    [Fact]
    public async Task Delete_UsesResolveDelete_AndDeniedReturnsNull()
    {
        var resolverFilter = new BsonDocument("ItemId", "scoped");
        _resolver.Setup(r => r.ResolveDeleteAsync("Repo", It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), resolverFilter));
        Render((await _sut.DeleteFilterAsync(ReleaseSchemas.Repo, UserFilter, "test"))!).ToJson().Should().Be(resolverFilter.ToJson());

        _resolver.Setup(r => r.ResolveDeleteAsync("Repo", It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(false), null));
        (await _sut.DeleteFilterAsync(ReleaseSchemas.Repo, UserFilter, "test")).Should().BeNull();
    }

    [Fact]
    public async Task Insert_IsAGateOnly()
    {
        _resolver.Setup(r => r.ResolveInsertAsync("Build", It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedInput(Result(true), new Dictionary<string, object?>(), []));
        (await _sut.InsertAllowedAsync(ReleaseSchemas.Build, "test")).Should().BeTrue();

        _resolver.Setup(r => r.ResolveInsertAsync("Build", It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedInput(Result(false), null, []));
        (await _sut.InsertAllowedAsync(ReleaseSchemas.Build, "test")).Should().BeFalse();
    }

    [Fact]
    public async Task MissingSchema_AllowsWithOriginalFilter_AndWarns()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Schema 'Repo' was not found"));
        _resolver.Setup(r => r.ResolveMutationFilterAsync(It.IsAny<string>(), It.IsAny<PolicyOperation>(), It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());
        _resolver.Setup(r => r.ResolveInsertAsync(It.IsAny<string>(), It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        var scope = await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "test");
        scope.Granted.Should().BeTrue();
        scope.Filter.Should().BeSameAs(UserFilter);
        scope.Projection.Should().BeNull();
        (await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "test")).Should().BeSameAs(UserFilter);
        (await _sut.InsertAllowedAsync(ReleaseSchemas.Repo, "test")).Should().BeTrue();
        VerifyLogged(LogLevel.Warning, "Repo");
    }

    [Theory]
    [InlineData(false, null)]   // no authenticated user
    [InlineData(true, "other")] // another tenant's DB
    public async Task SkipPath_DoesNotCallResolver_AndLogsOnce(bool authenticated, string? targetTenant)
    {
        SetContext("t1", authenticated);

        var scope = await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "site", targetTenant);
        await _sut.ReadAsync(ReleaseSchemas.Repo, UserFilter, "site", targetTenant);
        (await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "site2", targetTenant)).Should().BeSameAs(UserFilter);
        (await _sut.DeleteFilterAsync(ReleaseSchemas.Repo, UserFilter, "site3", targetTenant)).Should().BeSameAs(UserFilter);
        (await _sut.InsertAllowedAsync(ReleaseSchemas.Repo, "site4", targetTenant)).Should().BeTrue();

        scope.Granted.Should().BeTrue();
        scope.Filter.Should().BeSameAs(UserFilter);
        _resolver.VerifyNoOtherCalls();
        // "site" was hit twice but logged once.
        _logger.Verify(l => l.Log(LogLevel.Information, It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("site:") ), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    [Fact]
    public async Task NoContextAtAll_SkipsResolver()
    {
        BlocksContext.SetContext(null);
        (await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "test")).Should().BeSameAs(UserFilter);
        _resolver.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SameTenantTarget_UsesResolver()
    {
        _resolver.Setup(r => r.ResolveMutationFilterAsync(It.IsAny<string>(), PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), new BsonDocument("x", 1)));
        await _sut.EditFilterAsync(ReleaseSchemas.Repo, UserFilter, "test", "T1");
        _resolver.Verify(r => r.ResolveMutationFilterAsync("Repo", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}

/// <summary>ResolvedRead has an internal constructor (Genesis builds it); tests create it by reflection.</summary>
internal static class Reflect
{
    public static ResolvedRead Read(PolicyEvaluationResult evaluation, BsonDocument? filter, BsonDocument? projection) =>
        (ResolvedRead)Activator.CreateInstance(typeof(ResolvedRead),
            BindingFlags.NonPublic | BindingFlags.Instance, null,
            new object?[] { evaluation, filter, projection, null }, null)!;
}
