using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Blocks.Genesis.Entities.Release;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    /// <summary>
    /// Unit tests for the key-value cut of <see cref="DependencyTrackRepositoryService"/>
    /// (blocks-release SPEC1 H1-H5, H10, C1-C3).
    /// </summary>
    public class DependencyTrackRepositoryServiceTests : IDisposable
    {
        private const string Tenant = "tenant-kv";
        private const string Key = "dependency-track-project:" + Tenant;

        private readonly Mock<IKeyValueStore> _kv = new();
        private readonly Mock<IDbContextProvider> _dbProvider = new();
        private readonly Mock<IMongoDatabase> _db = new();
        private readonly Mock<IMongoCollection<DependencyTrackProjects>> _oldCollection = new();
        private readonly Mock<ILogger<DependencyTrackRepositoryService>> _logger = new();

        public DependencyTrackRepositoryServiceTests()
        {
            _dbProvider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(_db.Object);
            _db.Setup(d => d.GetCollection<DependencyTrackProjects>("DependencyTrackProjects", null))
               .Returns(_oldCollection.Object);
            SetOldDoc(null);
            SetTenant(Tenant);
        }

        public void Dispose() => BlocksContext.ClearContext();

        private static void SetTenant(string tenantId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", tenantId));

        private DependencyTrackRepositoryService CreateSut() => new(_dbProvider.Object, _kv.Object, _logger.Object);

        private void SetOldDoc(DependencyTrackProjects doc) =>
            _oldCollection.Setup(c => c.FindAsync(
                              It.IsAny<FilterDefinition<DependencyTrackProjects>>(),
                              It.IsAny<FindOptions<DependencyTrackProjects, DependencyTrackProjects>>(),
                              It.IsAny<CancellationToken>()))
                          .ReturnsAsync(() => new ListCursor<DependencyTrackProjects>(doc is null ? [] : [doc]));

        private void VerifyOldCollectionNeverRead() =>
            _oldCollection.Verify(c => c.FindAsync(
                It.IsAny<FilterDefinition<DependencyTrackProjects>>(),
                It.IsAny<FindOptions<DependencyTrackProjects, DependencyTrackProjects>>(),
                It.IsAny<CancellationToken>()), Times.Never);

        private static DependencyTrackProjects Doc(string name, string team = "team-1") => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            ProjectId = Tenant,
            ProjectName = name,
            ProjectTeamName = "team-name",
            ProjectTeamUuid = team,
            RepoProjects = new List<RepoProject> { new() { RepoId = "r1", ProjectUuid = "p1" } }
        };

        // ---- Get ----

        [Fact]
        public async Task Get_KvHit_ReturnsKvValue_AndDoesNotReadOldCollection() // H1
        {
            var kvDoc = Doc("from-kv");
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default)).ReturnsAsync(kvDoc);
            SetOldDoc(Doc("from-old"));

            var result = await CreateSut().GetDependencyTrackProject("ignored");

            result.Should().BeSameAs(kvDoc);
            VerifyOldCollectionNeverRead();
        }

        [Fact]
        public async Task Get_KvMiss_FallsBackToOldCollection() // H2
        {
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default)).ReturnsAsync((DependencyTrackProjects)null);
            var oldDoc = Doc("from-old");
            SetOldDoc(oldDoc);

            var result = await CreateSut().GetDependencyTrackProject("ignored");

            result.Should().BeSameAs(oldDoc);
        }

        [Fact]
        public async Task Get_KvMissAndNoOldDoc_ReturnsNull() // C1
        {
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default)).ReturnsAsync((DependencyTrackProjects)null);

            (await CreateSut().GetDependencyTrackProject("ignored")).Should().BeNull();
        }

        [Fact]
        public async Task Get_NoTenantInContext_ReturnsNull_AndDoesNotThrow_AndNeverCallsKv() // C2
        {
            BlocksContext.ClearContext();

            var act = async () => await CreateSut().GetDependencyTrackProject("ignored");

            (await act.Should().NotThrowAsync()).Subject.Should().BeNull();
            _kv.Verify(k => k.GetAsync<DependencyTrackProjects>(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData("")]
        [InlineData(null)]
        public async Task Get_EmptyTenantId_ReturnsNull_AndNeverCallsKv(string tenantId) // C2
        {
            SetTenant(tenantId);

            var act = async () => await CreateSut().GetDependencyTrackProject("ignored");

            (await act.Should().NotThrowAsync()).Subject.Should().BeNull();
            _kv.Verify(k => k.GetAsync<DependencyTrackProjects>(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Get_KvThrows_Rethrows_AndDoesNotReadOldCollection() // C3, H10
        {
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default))
               .ThrowsAsync(new TimeoutException("kv down"));

            var act = async () => await CreateSut().GetDependencyTrackProject("ignored");

            await act.Should().ThrowAsync<TimeoutException>().WithMessage("kv down");
            VerifyOldCollectionNeverRead();
        }

        // ---- Save ----

        [Fact]
        public async Task Save_UpsertsOnlyTheKvRow_AndTouchesNoOldCollection() // H3, H4
        {
            var doc = Doc("p");

            (await CreateSut().SaveDependencyTrackProject(doc)).Should().BeTrue();

            _kv.Verify(k => k.SetAsync(Key, doc, true, default), Times.Once);
            _kv.VerifyNoOtherCalls();
            _dbProvider.Verify(p => p.GetDatabase(It.IsAny<string>()), Times.Never);
            _oldCollection.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_KvWriteFails_LogsAndReturnsFalse() // C3
        {
            _kv.Setup(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new InvalidOperationException("write failed"));

            (await CreateSut().SaveDependencyTrackProject(Doc("p"))).Should().BeFalse();
        }

        [Fact]
        public async Task Save_NoTenantInContext_ReturnsFalse_AndDoesNotThrow() // C2
        {
            BlocksContext.ClearContext();

            (await CreateSut().SaveDependencyTrackProject(Doc("p"))).Should().BeFalse();
            _kv.Verify(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---- Caller: EnsureDependencyTrackProjectExists ----

        private (DependencyTrackAuthService Auth, Mock<IHttpHelperServices> Http) CreateAuth()
        {
            var http = new Mock<IHttpHelperServices>();
            var secret = new Mock<ICloudBuildSecret>();
            secret.SetupGet(s => s.DependencyTrackApiKey).Returns("api-key");
            secret.SetupGet(s => s.DependencyTrackDefaultTeamId).Returns("team-default");
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["DependencyTrackBaseUrl"] = "https://dt.example.com" })
                .Build();
            var auth = new DependencyTrackAuthService(
                new Mock<ILogger<DependencyTrackAuthService>>().Object, http.Object, config, CreateSut(), secret.Object);
            return (auth, http);
        }

        [Fact]
        public async Task Ensure_TeamInKv_CreatesNoTeam_AndDoesNotSave() // H6
        {
            var kvDoc = Doc("p", team: "team-kv");
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default)).ReturnsAsync(kvDoc);
            var (auth, http) = CreateAuth();

            var result = await auth.EnsureDependencyTrackProjectExists("p");

            result.Should().BeSameAs(kvDoc);
            http.VerifyNoOtherCalls();
            _kv.Verify(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Ensure_KvThrows_Throws_CreatesNoTeam_AndDoesNotSave() // H10, C3
        {
            _kv.Setup(k => k.GetAsync<DependencyTrackProjects>(Key, true, default))
               .ThrowsAsync(new TimeoutException("kv down"));
            var (auth, http) = CreateAuth();

            var act = async () => await auth.EnsureDependencyTrackProjectExists("p");

            await act.Should().ThrowAsync<TimeoutException>();
            http.VerifyNoOtherCalls();
            _kv.Verify(k => k.SetAsync(It.IsAny<string>(), It.IsAny<DependencyTrackProjects>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
