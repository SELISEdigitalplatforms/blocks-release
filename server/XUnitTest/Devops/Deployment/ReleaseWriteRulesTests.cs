using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment;

/// <summary>
/// Part B for Release: the wrapper runs a schema's validation rules on writes and its defaults on inserts, only
/// for schemas the Genesis allow-list opens, only with a signed-in user of the same tenant.
/// </summary>
public class ReleaseWriteRulesTests : IDisposable
{
    private readonly Mock<IDataAccessResolver> _resolver = new();
    private readonly ReleaseDataAccess _sut;
    private BsonDocument? _sent;

    public ReleaseWriteRulesTests()
    {
        BlocksContext.IsTestMode = true;
        SetContext(authenticated: true);
        _sut = new ReleaseDataAccess(_resolver.Object, NullLogger<ReleaseDataAccess>.Instance);
    }

    public void Dispose()
    {
        BlocksContext.SetContext(null);
        BlocksContext.IsTestMode = false;
    }

    private static void SetContext(bool authenticated) =>
        BlocksContext.SetContext(BlocksContext.Create(
            "t1", new[] { "role" }, "user-1", authenticated, "uri", "org",
            DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
            "phone", "display", "oauth", "t1"));

    /// <summary>The resolver answers with <paramref name="change"/> applied to the document it was sent.</summary>
    private void Resolves(Action<BsonDocument>? change = null, DataValidationResult? validation = null) =>
        _resolver.Setup(r => r.ResolveWriteAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<bool>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, BsonDocument document, bool _, BsonDocument? _, CancellationToken _) =>
            {
                _sent = document;
                change?.Invoke(document);
                return new ResolvedWrite(document, validation ?? new DataValidationResult(), DefaultsApplied: change is not null);
            });

    private static DataValidationResult Failed(string field, string message)
    {
        var result = new DataValidationResult();
        result.AddError(field, message, "MaxLength");
        return result;
    }

    [Fact]
    public async Task Insert_DefaultsLandInTheCallersOwnInstance()
    {
        Resolves(document => document["Language"] = "en-US");
        var repo = new Repo { ItemId = "r1", RepoName = "web" };

        var returned = await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, repo, isInsert: true, "test");

        returned.Should().BeSameAs(repo);
        repo.Language.Should().Be("en-US");
        repo.RepoName.Should().Be("web");
        _resolver.Verify(r => r.ResolveWriteAsync("Repo", It.IsAny<BsonDocument>(), true, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ABrokenRule_Throws_WithThePropertyAndMessage()
    {
        Resolves(validation: Failed("Branch", "Branch must be main or release/*"));

        var act = () => _sut.PrepareWriteAsync(ReleaseSchemas.Repo, new Repo { ItemId = "r1", Branch = "feature/x" }, isInsert: false, "test");

        (await act.Should().ThrowAsync<DataValidationException>()).Which.Result.Errors.Should().ContainSingle()
            .Which.FieldName.Should().Be("Branch");
    }

    [Theory]
    [InlineData(ReleaseSchemas.Build)]
    [InlineData(ReleaseSchemas.RepositoryWebhook)]
    public async Task SchemasTheAllowListKeepsClosed_NeverReachTheResolver(string schema)
    {
        await _sut.PrepareWriteAsync(schema, new Repo(), isInsert: true, "test");
        await _sut.CheckUpdateAsync(schema, Builders<Repo>.Update.Set(r => r.RepoName, "x"), "test");

        _resolver.Verify(r => r.ResolveWriteAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<bool>(), It.IsAny<BsonDocument?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task WithoutASignedInUser_NoRulesRun()
    {
        SetContext(authenticated: false);

        await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, new Repo(), isInsert: true, "test");

        _resolver.Verify(r => r.ResolveWriteAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<bool>(), It.IsAny<BsonDocument?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task APartialUpdate_SendsOnlyItsSetFields_AsNestedProperties()
    {
        Resolves();
        var update = Builders<Repo>.Update
            .Set("Read.Roles", new BsonArray { "admin" })
            .Set(r => r.RepoName, "Ann")
            .Set("Items.0.Name", "skipped")
            .Inc("RunCount", 1);

        await _sut.CheckUpdateAsync(ReleaseSchemas.Repo, update, "test");

        _sent.Should().BeEquivalentTo(new BsonDocument
        {
            { "Read", new BsonDocument("Roles", new BsonArray { "admin" }) },
            { "RepoName", "Ann" },
        });
        _resolver.Verify(r => r.ResolveWriteAsync("Repo", It.IsAny<BsonDocument>(), false, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AnUpdateWithNothingSet_IsNotChecked()
    {
        await _sut.CheckUpdateAsync(ReleaseSchemas.Repo, Builders<Repo>.Update.Inc("RunCount", 1), "test");

        _resolver.Verify(r => r.ResolveWriteAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<bool>(), It.IsAny<BsonDocument?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AMissingSchema_IsAllowed()
    {
        _resolver.Setup(r => r.ResolveWriteAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<bool>(), null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("no schema"));
        var repo = new Repo { ItemId = "r1" };

        (await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, repo, isInsert: true, "test")).Should().BeSameAs(repo);
    }

    [Fact]
    public async Task ARefusedDomain_StopsTheWholeBatch_BeforeAnythingIsWritten()
    {
        var access = new Mock<IReleaseDataAccess>();
        access.Setup(a => a.EditFilterAsync(ReleaseSchemas.Repo, It.IsAny<FilterDefinition<Repo>>(), It.IsAny<string>(), null))
            .ReturnsAsync(FilterDefinition<Repo>.Empty);
        access.Setup(a => a.CheckUpdateAsync(ReleaseSchemas.Repo, It.IsAny<UpdateDefinition<Repo>>(), It.IsAny<string>(), null))
            .ThrowsAsync(new DataValidationException(Failed("CustomDeploymentUrl", "CustomDeploymentUrl must end with .example.com")));
        // Strict: a BulkWriteAsync on it would throw a MockException instead of the validation error.
        var collection = new Mock<IMongoCollection<Repo>>(MockBehavior.Strict);
        var provider = new Mock<IDbContextProvider>();
        provider.Setup(p => p.GetCollection<Repo>("Repos")).Returns(collection.Object);
        var repository = new RepoRepository(provider.Object, Mock.Of<Microsoft.Extensions.Configuration.IConfiguration>(),
            NullLogger<RepoRepository>.Instance, Mock.Of<IBlocksSecret>(), access.Object);

        var act = () => repository.UpdateRepoDomain(new global::Devops.DomainService.Deployment.Models.Request.RepoDomainUpdateRequest
        {
            repoWithDomains = [new() { RepoId = "r1", CustomDeploymentDomain = "web.other.com" }],
        });

        await act.Should().ThrowAsync<DataValidationException>();
    }
}
