using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.RepositoryServices;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using FluentValidation.Results;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestDoubles;
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
    public async Task Insert_AddsTheRequesterToReadUpdateAndDeleteUserIds_KeepingIdsAlreadyThere()
    {
        Resolves();
        var record = new Repo { ItemId = "r1", RepoName = "web" };
        record.Read = new OperationAccess { UserIds = ["user-9"], Roles = ["admin"] };
        record.Update = new OperationAccess { UserIds = ["user-1"] };

        await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, record, isInsert: true, "test");

        record.Read!.UserIds.Should().Equal("user-9", "user-1");
        record.Read.Roles.Should().Equal("admin");
        record.Update!.UserIds.Should().Equal("user-1");   // once
        record.Delete!.UserIds.Should().Equal("user-1");
        record.Create.Should().BeNull();
    }

    [Fact]
    public async Task Insert_OnASchemaWithoutRules_StillAddsTheRequester()
    {
        var record = new Repo { ItemId = "r1", RepoName = "web" };

        await _sut.PrepareWriteAsync(ReleaseSchemas.Build, record, isInsert: true, "test");

        record.Read!.UserIds.Should().Equal("user-1");
    }

    [Fact]
    public async Task AReplace_OrAnInsertWithoutASignedInUser_AddsNoRequester()
    {
        Resolves();
        var replaced = new Repo { ItemId = "r1", RepoName = "web" };
        await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, replaced, isInsert: false, "test");
        replaced.Read.Should().BeNull();

        SetContext(authenticated: false);
        var anonymous = new Repo { ItemId = "r1", RepoName = "web" };
        await _sut.PrepareWriteAsync(ReleaseSchemas.Repo, anonymous, isInsert: true, "test");
        anonymous.Read.Should().BeNull();
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

    private static RepoRepository RepositoryOver(IMongoCollection<Repo> collection, IReleaseDataAccess access)
    {
        var provider = new Mock<IDbContextProvider>();
        provider.Setup(p => p.GetCollection<Repo>("Repos")).Returns(collection);
        return new RepoRepository(provider.Object, Mock.Of<Microsoft.Extensions.Configuration.IConfiguration>(),
            NullLogger<RepoRepository>.Instance, Mock.Of<IBlocksSecret>(), access);
    }

    [Fact]
    public async Task AWholeRepoReplace_DeniedByTheEditFilter_WritesNothing()
    {
        var access = new Mock<IReleaseDataAccess>(MockBehavior.Strict);
        access.Setup(a => a.EditFilterAsync(ReleaseSchemas.Repo, It.IsAny<FilterDefinition<Repo>>(), "RepoRepository.UpdateRepoWhole", null))
            .ReturnsAsync((FilterDefinition<Repo>?)null);
        // Strict: rules on a denied write, or a ReplaceOneAsync, would throw a MockException instead of returning false.
        var collection = new Mock<IMongoCollection<Repo>>(MockBehavior.Strict);

        var updated = await RepositoryOver(collection.Object, access.Object).UpdateRepo(new Repo { ItemId = "r1" });

        updated.Should().BeFalse();
    }

    [Fact]
    public async Task AWholeRepoReplace_IsScopedByThePolicyFilter_AndRunsTheRules()
    {
        var policy = Builders<Repo>.Filter.Eq(r => r.ItemId, "r1") & Builders<Repo>.Filter.Eq(r => r.ProjectId, "t1");
        var access = new Mock<IReleaseDataAccess>();
        access.Setup(a => a.EditFilterAsync(ReleaseSchemas.Repo, It.IsAny<FilterDefinition<Repo>>(), It.IsAny<string>(), null))
            .ReturnsAsync(policy);
        var repo = new Repo { ItemId = "r1" };
        var collection = new Mock<IMongoCollection<Repo>>();
        // The replace keeps values hidden from the caller, then runs the rules.
        access.Setup(a => a.PrepareReplaceAsync(ReleaseSchemas.Repo, repo, collection.Object, policy, It.IsAny<string>(), null)).ReturnsAsync(repo);
        collection.Setup(c => c.ReplaceOneAsync(policy, repo, It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReplaceOneResult.Acknowledged(1, 1, null));

        var updated = await RepositoryOver(collection.Object, access.Object).UpdateRepo(repo);

        updated.Should().BeTrue();
        access.Verify(a => a.PrepareReplaceAsync(ReleaseSchemas.Repo, repo, collection.Object, policy, It.IsAny<string>(), null), Times.Once);
    }

    [Fact]
    public async Task ARefusedRepo_StopsTheBuild_BeforeTheNamespaceOrWebhook_AndReturnsTheMessage()
    {
        var factory = new DeploymentServiceFactory();
        factory.RepoRepo.Setup(r => r.CheckRepoAsync(It.IsAny<Repo>(), "t1"))
            .ThrowsAsync(new DataValidationException(Failed("Branch", "Branch must be main or release/*")));

        var response = await factory.BuildService().Build(new BuildRequest(), new Repo { ItemId = "r1", ProjectId = "t1", Branch = "feature/x" });

        response.IsSuccess.Should().BeFalse();
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Message.Should().Contain("Branch must be main or release/*");
        response.Errors.Should().ContainKey("Branch").WhoseValue.Should().Be("Branch must be main or release/*");
        // CreateNamespaceAsync reads the owner's token before anything else; no read means no PipelineRun.
        factory.TokenRepo.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
        factory.Webhook.Verify(w => w.CreateWebhook(It.IsAny<Repo>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        factory.RepoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ARefusedDomain_ReturnsItsMessagePerField()
    {
        var factory = new DeploymentServiceFactory();
        factory.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
        factory.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
            .ReturnsAsync([]);
        factory.RepoRepo.Setup(r => r.CheckRepoDomainsAsync(It.IsAny<RepoDomainUpdateRequest>()))
            .ThrowsAsync(new DataValidationException(Failed("CustomDeploymentUrl", "CustomDeploymentUrl must end with .example.com")));

        var response = await factory.BuildService().UpdateRepoDomain(new RepoDomainUpdateRequest
        {
            repoWithDomains = [new() { RepoId = "r1", CustomDeploymentDomain = "web.other.com" }],
        });

        response.IsSuccess.Should().BeFalse();
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Errors.Should().ContainKey("CustomDeploymentUrl").WhoseValue.Should().Be("CustomDeploymentUrl must end with .example.com");
        factory.RepoRepo.Verify(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()), Times.Never);
    }

    [Fact]
    public async Task ARefusedWebhookSave_ReachesTheCaller_NotAQuietFalse()
    {
        var token = new Mock<ITokenRepository>();
        token.Setup(t => t.getToken()).ReturnsAsync(new RepositoryToken { AccessToken = "token" });
        using var created = new HttpResponseMessage(HttpStatusCode.Created);
        var http = new Mock<IHttpHelperServices>();
        http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(
                It.IsAny<string>(), It.IsAny<string>(), HttpMethod.Post, It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
            .ReturnsAsync((new GithubWebhookSuccessResponse { id = 7, active = true }, null, created));
        var repos = new Mock<IRepoRepository>();
        repos.Setup(r => r.UpdateRepo(It.IsAny<Repo>()))
            .ThrowsAsync(new DataValidationException(Failed("Branch", "Branch must be main or release/*")));
        var service = new GithubWebhookService(NullLogger<GithubWebhookService>.Instance,
            Mock.Of<Microsoft.Extensions.Configuration.IConfiguration>(), http.Object, token.Object, repos.Object, Mock.Of<ICloudBuildSecret>());

        var act = () => service.UpdateWebhookStatus(new Repo { ItemId = "r1", RepoName = "org/web" }, activationStatus: true);

        await act.Should().ThrowAsync<DataValidationException>();
    }

    [Fact]
    public async Task WithoutRules_AWholeRepoReplace_StillWrites()
    {
        var repo = new Repo { ItemId = "r1" };
        var collection = new Mock<IMongoCollection<Repo>>();
        collection.Setup(c => c.ReplaceOneAsync(It.IsAny<FilterDefinition<Repo>>(), repo, It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReplaceOneResult.Acknowledged(1, 1, null));

        (await RepositoryOver(collection.Object, new PassThroughReleaseDataAccess()).UpdateRepo(repo)).Should().BeTrue();
    }
}
