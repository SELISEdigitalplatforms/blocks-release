using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>
    /// Unit tests for <see cref="RepoRepository"/>. Two behaviours matter beyond the plain reads and
    /// writes: the partial update only touches the fields the request actually carries, and the
    /// custom-domain bulk write skips incomplete rows and reports what it did. Both are pinned here,
    /// together with the failure answers, since a build must not fall over when Mongo does.
    /// </summary>
    public class RepoRepositoryTests : IDisposable
    {
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<IMongoCollection<Repo>> _repos = new();
        private readonly Mock<IMongoDatabase> _tenantDb = new();
        private readonly Mock<IMongoCollection<Repo>> _tenantRepos = new();
        private readonly RepoRepository _sut;

        public RepoRepositoryTests()
        {
            BlocksContext.IsTestMode = true;
            _provider.Setup(p => p.GetCollection<Repo>("Repos")).Returns(_repos.Object);
            _provider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(_tenantDb.Object);
            _tenantDb.Setup(d => d.GetCollection<Repo>("Repos", null)).Returns(_tenantRepos.Object);

            _sut = new RepoRepository(
                _provider.Object,
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string>()).Build(),
                new Mock<ILogger<RepoRepository>>().Object,
                new Mock<IBlocksSecret>().Object);
        }

        public void Dispose()
        {
            BlocksContext.SetContext(null);
            BlocksContext.IsTestMode = false;
        }

        private static void SetTenant(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        private void SetupFind(params Repo[] documents)
        {
            var cursor = new Mock<IAsyncCursor<Repo>>();
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                  .ReturnsAsync(documents.Length > 0)
                  .ReturnsAsync(false);
            cursor.SetupGet(c => c.Current).Returns(documents);

            _repos.Setup(c => c.FindAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<FindOptions<Repo, Repo>>(),
                      It.IsAny<CancellationToken>()))
                  .ReturnsAsync(cursor.Object);
        }

        /// <summary>
        /// The existence probe in SaveRepo goes through AnyAsync, which projects to a BsonDocument
        /// rather than to the entity, so it needs a cursor of its own.
        /// </summary>
        private void SetupExists(bool exists)
        {
            var cursor = new Mock<IAsyncCursor<MongoDB.Bson.BsonDocument>>();
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                  .ReturnsAsync(exists)
                  .ReturnsAsync(false);
            cursor.SetupGet(c => c.Current)
                  .Returns(exists ? new[] { new MongoDB.Bson.BsonDocument() } : []);

            _repos.Setup(c => c.FindAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<FindOptions<Repo, MongoDB.Bson.BsonDocument>>(),
                      It.IsAny<CancellationToken>()))
                  .ReturnsAsync(cursor.Object);
        }

        private void SetupUpdateOne(long matched, long modified) =>
            _repos.Setup(c => c.UpdateOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<UpdateDefinition<Repo>>(),
                      It.IsAny<UpdateOptions>(),
                      It.IsAny<CancellationToken>()))
                  .ReturnsAsync(new UpdateResult.Acknowledged(matched, modified, null));

        [Fact]
        public async Task GetRepo_ReturnsTheMatchingRepository()
        {
            SetupFind(new Repo { ItemId = "repo-1", RepoName = "web" });

            var result = await _sut.GetRepo("repo-1");

            result.Should().NotBeNull();
            result!.RepoName.Should().Be("web");
        }

        [Fact]
        public async Task GetRepo_ReturnsNullForAnUnknownId()
        {
            SetupFind();

            (await _sut.GetRepo("gone")).Should().BeNull();
        }

        [Fact]
        public async Task SaveRepo_InsertsARepositoryThatIsNotAlreadyRegistered()
        {
            SetupExists(false);
            var repo = new Repo { ProjectId = "proj-1", RepoName = "web" };
            _repos.Setup(c => c.InsertOneAsync(repo, null, It.IsAny<CancellationToken>()))
                  .Returns(Task.CompletedTask);

            await _sut.SaveRepo(repo);

            _repos.Verify(c => c.InsertOneAsync(repo, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveRepo_DoesNotInsertADuplicateOfTheSameRepoInTheSameProject()
        {
            SetupExists(true);

            await _sut.SaveRepo(new Repo { ProjectId = "proj-1", RepoName = "web" });

            _repos.Verify(c => c.InsertOneAsync(
                It.IsAny<Repo>(), null, It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UpdateRepo_SetsOnlyTheFieldsTheRequestCarries()
        {
            UpdateDefinition<Repo> applied = null;
            _repos.Setup(c => c.UpdateOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<UpdateDefinition<Repo>>(),
                      It.IsAny<UpdateOptions>(),
                      It.IsAny<CancellationToken>()))
                  .Callback<FilterDefinition<Repo>, UpdateDefinition<Repo>, UpdateOptions, CancellationToken>(
                      (_, u, _, _) => applied = u)
                  .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            var result = await _sut.UpdateRepo(new RepoUpdateRequest
            {
                RepoId = "repo-1",
                DeploymentType = "Auto",
            });

            result.Should().BeTrue();
            var rendered = applied.Render(new RenderArgs<Repo>(
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry.GetSerializer<Repo>(),
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry)).ToString();
            rendered.Should().Contain("DeploymentType");
            // Nothing else was supplied, so nothing else may be overwritten.
            rendered.Should().NotContain("CustomDeploymentUrl");
            rendered.Should().NotContain("DeploySettings");
        }

        [Fact]
        public async Task UpdateRepo_CombinesEveryFieldTheRequestCarries()
        {
            UpdateDefinition<Repo> applied = null;
            _repos.Setup(c => c.UpdateOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<UpdateDefinition<Repo>>(),
                      It.IsAny<UpdateOptions>(),
                      It.IsAny<CancellationToken>()))
                  .Callback<FilterDefinition<Repo>, UpdateDefinition<Repo>, UpdateOptions, CancellationToken>(
                      (_, u, _, _) => applied = u)
                  .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            await _sut.UpdateRepo(new RepoUpdateRequest
            {
                RepoId = "repo-1",
                deploySettings = new DeploySettings(),
                DeploymentType = "Auto",
                CustomDomain = "https://custom.example.com",
                LastDeploymentStatus = "Succeeded",
                LastDeploymentDate = DateTime.UtcNow,
            });

            var rendered = applied.Render(new RenderArgs<Repo>(
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry.GetSerializer<Repo>(),
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry)).ToString();
            rendered.Should().Contain("DeploySettings");
            rendered.Should().Contain("DeploymentType");
            rendered.Should().Contain("CustomDeploymentUrl");
            rendered.Should().Contain("LastDeploymentStatus");
            rendered.Should().Contain("LastDeploymentDate");
        }

        [Fact]
        public async Task UpdateRepo_RefusesARequestThatChangesNothing()
        {
            var result = await _sut.UpdateRepo(new RepoUpdateRequest { RepoId = "repo-1" });

            result.Should().BeFalse();
            _repos.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Repo>>(),
                It.IsAny<UpdateDefinition<Repo>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UpdateRepo_ReturnsFalseRatherThanThrowingWhenMongoIsUnreachable()
        {
            _repos.Setup(c => c.UpdateOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(),
                      It.IsAny<UpdateDefinition<Repo>>(),
                      It.IsAny<UpdateOptions>(),
                      It.IsAny<CancellationToken>()))
                  .ThrowsAsync(new TimeoutException("mongo unreachable"));

            var result = await _sut.UpdateRepo(new RepoUpdateRequest { RepoId = "repo-1", DeploymentType = "Auto" });

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateRepo_ReplacesTheWholeDocumentWhenGivenAnEntity()
        {
            var repo = new Repo { ItemId = "repo-1", RepoName = "web" };
            _repos.Setup(c => c.ReplaceOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(), repo,
                      It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(new ReplaceOneResult.Acknowledged(1, 1, null));

            (await _sut.UpdateRepo(repo)).Should().BeTrue();
        }

        [Fact]
        public async Task UpdateRepo_ReportsFailureWhenTheEntityMatchesNothing()
        {
            var repo = new Repo { ItemId = "gone" };
            _repos.Setup(c => c.ReplaceOneAsync(
                      It.IsAny<FilterDefinition<Repo>>(), repo,
                      It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(new ReplaceOneResult.Acknowledged(0, 0, null));

            (await _sut.UpdateRepo(repo)).Should().BeFalse();
        }

        [Fact]
        public async Task UpdateRepoDomain_WritesOneOperationPerCompleteRow()
        {
            SetTenant("tenant-b");
            IEnumerable<WriteModel<Repo>> sent = null;
            _repos.Setup(c => c.BulkWriteAsync(
                      It.IsAny<IEnumerable<WriteModel<Repo>>>(),
                      It.IsAny<BulkWriteOptions>(),
                      It.IsAny<CancellationToken>()))
                  .Callback<IEnumerable<WriteModel<Repo>>, BulkWriteOptions, CancellationToken>((w, _, _) => sent = w)
                  .ReturnsAsync(new BulkWriteResult<Repo>.Acknowledged(
                      2, 2, 0, 0, 2, new List<WriteModel<Repo>>(), new List<BulkWriteUpsert>()));

            var result = await _sut.UpdateRepoDomain(new RepoDomainUpdateRequest
            {
                repoWithDomains =
                [
                    new RepoWithDomain { RepoId = "repo-1", CustomDeploymentDomain = "https://a.example.com" },
                    new RepoWithDomain { RepoId = "repo-2", CustomDeploymentDomain = "https://b.example.com" },
                ],
            });

            sent.Should().HaveCount(2);
            result.RequestedCount.Should().Be(2);
            result.MatchedCount.Should().Be(2);
            result.ModifiedCount.Should().Be(2);
            result.IsAcknowledged.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateRepoDomain_SkipsRowsMissingARepoOrADomain()
        {
            SetTenant("tenant-b");
            IEnumerable<WriteModel<Repo>> sent = null;
            _repos.Setup(c => c.BulkWriteAsync(
                      It.IsAny<IEnumerable<WriteModel<Repo>>>(),
                      It.IsAny<BulkWriteOptions>(),
                      It.IsAny<CancellationToken>()))
                  .Callback<IEnumerable<WriteModel<Repo>>, BulkWriteOptions, CancellationToken>((w, _, _) => sent = w)
                  .ReturnsAsync(new BulkWriteResult<Repo>.Acknowledged(
                      1, 1, 0, 0, 1, new List<WriteModel<Repo>>(), new List<BulkWriteUpsert>()));

            var result = await _sut.UpdateRepoDomain(new RepoDomainUpdateRequest
            {
                repoWithDomains =
                [
                    new RepoWithDomain { RepoId = "repo-1", CustomDeploymentDomain = "https://a.example.com" },
                    new RepoWithDomain { RepoId = "", CustomDeploymentDomain = "https://b.example.com" },
                    new RepoWithDomain { RepoId = "repo-3", CustomDeploymentDomain = "   " },
                ],
            });

            // An incomplete row is dropped rather than written as a blank domain.
            sent.Should().ContainSingle();
            result.RequestedCount.Should().Be(1);
        }

        [Fact]
        public async Task UpdateRepoDomain_SendsAnUnorderedBulkSoOneBadRowDoesNotStopTheRest()
        {
            SetTenant("tenant-b");
            BulkWriteOptions options = null;
            _repos.Setup(c => c.BulkWriteAsync(
                      It.IsAny<IEnumerable<WriteModel<Repo>>>(),
                      It.IsAny<BulkWriteOptions>(),
                      It.IsAny<CancellationToken>()))
                  .Callback<IEnumerable<WriteModel<Repo>>, BulkWriteOptions, CancellationToken>((_, o, _) => options = o)
                  .ReturnsAsync(new BulkWriteResult<Repo>.Acknowledged(
                      1, 1, 0, 0, 1, new List<WriteModel<Repo>>(), new List<BulkWriteUpsert>()));

            await _sut.UpdateRepoDomain(new RepoDomainUpdateRequest
            {
                repoWithDomains =
                [
                    new RepoWithDomain { RepoId = "repo-1", CustomDeploymentDomain = "https://a.example.com" },
                ],
            });

            options.IsOrdered.Should().BeFalse();
        }
    
        [Fact]
        public async Task SaveRepo_SwallowsAWriteFailureSoRegistrationStillAnswers()
        {
            SetupExists(false);
            var writeError = (WriteError)Activator.CreateInstance(
                typeof(WriteError),
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic,
                null,
                [ServerErrorCategory.DuplicateKey, 11000, "duplicate key", (MongoDB.Bson.BsonDocument)null],
                null);
            _repos.Setup(c => c.InsertOneAsync(It.IsAny<Repo>(), null, It.IsAny<CancellationToken>()))
                  .ThrowsAsync(new MongoWriteException(
                      new MongoDB.Driver.Core.Connections.ConnectionId(
                          new MongoDB.Driver.Core.Servers.ServerId(
                              new MongoDB.Driver.Core.Clusters.ClusterId(1),
                              new System.Net.DnsEndPoint("localhost", 27017))),
                      writeError, null, new Exception("duplicate key")));

            var act = () => _sut.SaveRepo(new Repo { ProjectId = "proj-1", RepoName = "web" });

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UpdateRepo_ForATenantWritesIntoThatTenantsDatabase()
        {
            _tenantRepos.Setup(c => c.UpdateOneAsync(
                            It.IsAny<FilterDefinition<Repo>>(),
                            It.IsAny<UpdateDefinition<Repo>>(),
                            It.IsAny<UpdateOptions>(),
                            It.IsAny<CancellationToken>()))
                        .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            var result = await _sut.UpdateRepo(
                new RepoUpdateRequest { RepoId = "repo-1", DeploymentType = "Auto" }, "tenant-b");

            result.Should().BeTrue();
            _provider.Verify(p => p.GetDatabase("tenant-b"), Times.Once);
        }

        [Fact]
        public async Task UpdateRepo_ForATenantSetsEveryFieldTheRequestCarries()
        {
            UpdateDefinition<Repo> applied = null;
            _tenantRepos.Setup(c => c.UpdateOneAsync(
                            It.IsAny<FilterDefinition<Repo>>(),
                            It.IsAny<UpdateDefinition<Repo>>(),
                            It.IsAny<UpdateOptions>(),
                            It.IsAny<CancellationToken>()))
                        .Callback<FilterDefinition<Repo>, UpdateDefinition<Repo>, UpdateOptions, CancellationToken>(
                            (_, u, _, _) => applied = u)
                        .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            await _sut.UpdateRepo(new RepoUpdateRequest
            {
                RepoId = "repo-1",
                deploySettings = new DeploySettings(),
                DeploymentType = "Auto",
                CustomDomain = "https://custom.example.com",
                LastDeploymentStatus = "Succeeded",
                LastDeploymentDate = DateTime.UtcNow,
            }, "tenant-b");

            var rendered = applied.Render(new RenderArgs<Repo>(
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry.GetSerializer<Repo>(),
                MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry)).ToString();
            rendered.Should().Contain("DeploySettings");
            rendered.Should().Contain("DeploymentType");
            rendered.Should().Contain("CustomDeploymentUrl");
            rendered.Should().Contain("LastDeploymentStatus");
            rendered.Should().Contain("LastDeploymentDate");
        }

        [Fact]
        public async Task UpdateRepo_ForATenantRefusesARequestThatChangesNothing()
        {
            var result = await _sut.UpdateRepo(new RepoUpdateRequest { RepoId = "repo-1" }, "tenant-b");

            result.Should().BeFalse();
            _tenantRepos.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Repo>>(),
                It.IsAny<UpdateDefinition<Repo>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UpdateRepo_ForATenantReportsFailureWhenNothingWasModified()
        {
            _tenantRepos.Setup(c => c.UpdateOneAsync(
                            It.IsAny<FilterDefinition<Repo>>(),
                            It.IsAny<UpdateDefinition<Repo>>(),
                            It.IsAny<UpdateOptions>(),
                            It.IsAny<CancellationToken>()))
                        .ReturnsAsync(new UpdateResult.Acknowledged(1, 0, null));

            var result = await _sut.UpdateRepo(
                new RepoUpdateRequest { RepoId = "repo-1", DeploymentType = "Auto" }, "tenant-b");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateRepo_ForATenantReturnsFalseRatherThanThrowingWhenMongoIsUnreachable()
        {
            _tenantRepos.Setup(c => c.UpdateOneAsync(
                            It.IsAny<FilterDefinition<Repo>>(),
                            It.IsAny<UpdateDefinition<Repo>>(),
                            It.IsAny<UpdateOptions>(),
                            It.IsAny<CancellationToken>()))
                        .ThrowsAsync(new TimeoutException("mongo unreachable"));

            var result = await _sut.UpdateRepo(
                new RepoUpdateRequest { RepoId = "repo-1", DeploymentType = "Auto" }, "tenant-b");

            result.Should().BeFalse();
        }
}
}
