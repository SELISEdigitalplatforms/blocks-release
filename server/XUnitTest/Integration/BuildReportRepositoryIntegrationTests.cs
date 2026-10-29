using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Release;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestDoubles;
using Xunit;

namespace XUnitTest.Integration
{
    /// <summary>
    /// #255 against a real mongod: the conditional, single-field report writes (C3, C13, H8), the terminal transition
    /// outside capture (C6/C7 storage), and the build reads that leave the reports out (H15, C19).
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class BuildReportRepositoryIntegrationTests
    {
        private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

        private readonly MongoIntegrationFixture _fixture;
        private readonly IConfiguration _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string> { ["RootTenantId"] = "root" }).Build();

        public BuildReportRepositoryIntegrationTests(MongoIntegrationFixture fixture) => _fixture = fixture;

        private BuildRepository Builds(IReleaseDataAccess access = null) =>
            new(_fixture.DbContextProvider, new Mock<ILogger<BuildRepository>>().Object, _config, new Mock<IBlocksSecret>().Object,
                access ?? new PassThroughReleaseDataAccess());

        private RepoRepository Repos(IReleaseDataAccess access = null) =>
            new(_fixture.DbContextProvider, _config, new Mock<ILogger<RepoRepository>>().Object, new Mock<IBlocksSecret>().Object,
                access ?? new PassThroughReleaseDataAccess());

        private IMongoCollection<Build> Collection => _fixture.Collection<Build>("Builds");
        private IMongoCollection<BsonDocument> Raw => _fixture.Collection<BsonDocument>("Builds");

        private static Build NewBuild(bool withReports = true, string repoId = null, string userId = null) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            RepoId = repoId ?? Guid.NewGuid().ToString("N"),
            RepoName = "org/repo",
            Branch = "dev",
            PipelineRunName = "run-" + Guid.NewGuid().ToString("N"),
            Status = "RUNNING",
            EventName = "Build",
            CreatedBy = "user-1",
            BlocksUserId = userId ?? "user-1",
            ProjectId = "tenant-1",
            ImageName = "registry/img:1",
            DependencyTrackProjectId = "dt-old",
            CreatedDate = new DateTime(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc),
            LastUpdatedDate = new DateTime(2026, 10, 28, 10, 1, 0, DateTimeKind.Utc),
            Events = new List<BuildEventResponse> { new() { BuildId = "x", EventType = "Log", Message = "cloning" } },
            SastReport = withReports ? new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 0 } : null,
            ScaReport = withReports ? new ScaReport { Status = AnalysisReportStatus.Pending, Attempts = 0 } : null,
        };

        private async Task<Build> Insert(Build build)
        {
            await Collection.InsertOneAsync(build);
            return build;
        }

        private Task<BsonDocument> RawDoc(Build build) =>
            Raw.Find(Builders<BsonDocument>.Filter.Eq("_id", build.ItemId)).FirstOrDefaultAsync();

        private Task<Build> Stored(Build build) => Collection.Find(b => b.ItemId == build.ItemId).FirstOrDefaultAsync();

        private static SastReport ReadySast(int attempts = 1) => new()
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = attempts,
            CapturedAt = new DateTime(2026, 10, 28, 10, 9, 0, DateTimeKind.Utc),
            ProjectKey = "org-repo",
            Branch = "dev",
            Metrics = new Dictionary<string, string> { ["new_violations"] = "367" },
        };

        private static ScaReport ReadySca(int attempts = 1) => new()
        {
            Status = AnalysisReportStatus.Ready,
            Attempts = attempts,
            ProjectUuid = "p-uuid",
            Findings = new List<ScaFinding> { new() { VulnId = "CVE-1", Severity = "HIGH", Aliases = new(), Cwes = new() } },
        };

        /// <summary>Every element of the stored document except <paramref name="field"/>.</summary>
        private static BsonDocument Without(BsonDocument doc, string field)
        {
            var copy = doc.DeepClone().AsBsonDocument;
            copy.Remove(field);
            return copy;
        }

        // ---- TrySave* (C3) ----

        [Fact]
        public async Task TrySaveSastReport_PendingWithTheExpectedAttempts_SetsOnlyTheReport()
        {
            var build = await Insert(NewBuild());
            var before = await RawDoc(build);

            var ok = await Builds().TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1");

            ok.Should().BeTrue();
            var after = await RawDoc(build);
            Without(after, "SastReport").Should().Equal(Without(before, "SastReport"), "no other field is written (no whole-document replace)");
            var stored = await Stored(build);
            stored.SastReport.Status.Should().Be(AnalysisReportStatus.Ready);
            stored.SastReport.Attempts.Should().Be(1);
            stored.SastReport.Metrics["new_violations"].Should().Be("367");
            stored.ScaReport.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        [Fact]
        public async Task TrySaveScaReport_PendingWithTheExpectedAttempts_SetsOnlyTheReport()
        {
            var build = NewBuild();
            build.ScaReport.Attempts = 2;
            await Insert(build);
            var before = await RawDoc(build);

            var ok = await Builds().TrySaveScaReport(build.ItemId, 2, ReadySca(3), "tenant-1");

            ok.Should().BeTrue();
            Without(await RawDoc(build), "ScaReport").Should().Equal(Without(before, "ScaReport"));
            var stored = await Stored(build);
            stored.ScaReport.Status.Should().Be(AnalysisReportStatus.Ready);
            stored.ScaReport.Attempts.Should().Be(3);
            stored.ScaReport.Findings.Should().ContainSingle().Which.VulnId.Should().Be("CVE-1");
        }

        [Fact]
        public async Task C3_TrySave_WrongAttempts_ChangesNothing()
        {
            var build = await Insert(NewBuild());
            var before = await RawDoc(build);

            (await Builds().TrySaveSastReport(build.ItemId, 1, ReadySast(2), "tenant-1")).Should().BeFalse();
            (await Builds().TrySaveScaReport(build.ItemId, 3, ReadySca(4), "tenant-1")).Should().BeFalse();

            (await RawDoc(build)).Should().Equal(before);
        }

        [Theory]
        [InlineData(AnalysisReportStatus.Ready)]
        [InlineData(AnalysisReportStatus.NotRun)]
        [InlineData(AnalysisReportStatus.Failed)]
        public async Task C3_TrySave_ReportNoLongerPending_ChangesNothing(string status)
        {
            var build = NewBuild();
            build.SastReport = new SastReport { Status = status, Attempts = 1, Message = "kept" };
            build.ScaReport = new ScaReport { Status = status, Attempts = 1, Message = "kept" };
            await Insert(build);
            var before = await RawDoc(build);

            (await Builds().TrySaveSastReport(build.ItemId, 1, ReadySast(2), "tenant-1")).Should().BeFalse();
            (await Builds().TrySaveScaReport(build.ItemId, 1, ReadySca(2), "tenant-1")).Should().BeFalse();

            (await RawDoc(build)).Should().Equal(before);
        }

        [Fact]
        public async Task C3_TrySave_BuildWithoutReportFields_ChangesNothing()
        {
            var build = await Insert(NewBuild(withReports: false));
            var before = await RawDoc(build);

            (await Builds().TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1")).Should().BeFalse();
            (await Builds().TrySaveScaReport(build.ItemId, 0, ReadySca(), "tenant-1")).Should().BeFalse();

            var after = await RawDoc(build);
            after.Should().Equal(before);
            after.Names.Should().NotContain(BuildRepository.ReportFields);
        }

        [Fact]
        public async Task C3_TrySave_DuplicateDelivery_SecondWriteMatchesNothing()
        {
            var build = await Insert(NewBuild());
            var sut = Builds();

            (await sut.TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1")).Should().BeTrue();
            var afterFirst = await RawDoc(build);
            (await sut.TrySaveSastReport(build.ItemId, 0, new SastReport { Status = AnalysisReportStatus.Pending, Attempts = 1 }, "tenant-1")).Should().BeFalse();

            (await RawDoc(build)).Should().Equal(afterFirst);
        }

        [Fact]
        public async Task C3_TrySave_UnknownBuild_IsFalse()
        {
            (await Builds().TrySaveSastReport(Guid.NewGuid().ToString("N"), 0, ReadySast(), "tenant-1")).Should().BeFalse();
        }

        [Fact]
        public async Task C3_TrySave_DeniedByTheDataAccessPolicy_WritesNothing()
        {
            var build = await Insert(NewBuild());
            var before = await RawDoc(build);
            var denied = new Mock<IReleaseDataAccess>();
            denied.Setup(a => a.EditFilterAsync(It.IsAny<string>(), It.IsAny<FilterDefinition<Build>>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((FilterDefinition<Build>)null);

            (await Builds(denied.Object).TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1")).Should().BeFalse();
            (await Builds(denied.Object).TryEndPendingReport(build.PipelineRunName, AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "m", "tenant-1")).Should().BeNull();

            (await RawDoc(build)).Should().Equal(before);
        }

        // ---- C13 / H8 ----

        [Fact]
        public async Task C13_ConcurrentCaptureAndPipelineWrites_AllSurvive()
        {
            var sut = Builds();
            for (var i = 0; i < 25; i++)
            {
                var build = await Insert(NewBuild());
                var events = new List<BuildEventResponse> { new() { BuildId = build.ItemId, EventType = "EventFinished", Message = "deployed " + i } };

                var results = await Task.WhenAll(
                    sut.TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1"),
                    sut.TrySaveScaReport(build.ItemId, 0, ReadySca(), "tenant-1"),
                    Task.Run(async () => { await sut.UpdateBuildEvents(build.PipelineRunName, events, "Deploy", "SUCCEEDED", "tenant-1"); return true; }),
                    Task.Run(async () => { await sut.UpdateBuildDependencyTrackProjectId(build.ItemId, "dt-new", "tenant-1"); return true; }));

                results.Should().OnlyContain(r => r);
                var stored = await Stored(build);
                stored.SastReport.Status.Should().Be(AnalysisReportStatus.Ready);
                stored.ScaReport.Status.Should().Be(AnalysisReportStatus.Ready);
                stored.Events.Should().ContainSingle().Which.Message.Should().Be("deployed " + i);
                stored.Status.Should().Be("SUCCEEDED");
                stored.EventName.Should().Be("Deploy");
                stored.DependencyTrackProjectId.Should().Be("dt-new");
            }
        }

        [Fact]
        public async Task C13_StatusUpdateAfterACapture_KeepsTheReport()
        {
            var build = await Insert(NewBuild());
            var sut = Builds();

            await sut.TrySaveSastReport(build.ItemId, 0, ReadySast(), "tenant-1");
            await sut.UpdateBuildStatus(build.PipelineRunName, "SUCCEEDED", "tenant-1");

            var stored = await Stored(build);
            stored.Status.Should().Be("SUCCEEDED");
            stored.SastReport.Status.Should().Be(AnalysisReportStatus.Ready);
            stored.SastReport.Metrics["new_violations"].Should().Be("367");
        }

        [Fact]
        public async Task H8_ALaterBuildsCapture_LeavesTheEarlierBuildUnchanged()
        {
            var sut = Builds();
            var earlier = await Insert(NewBuild());
            var later = NewBuild();
            later.RepoId = earlier.RepoId;
            await Insert(later);
            await sut.TrySaveSastReport(earlier.ItemId, 0, ReadySast(), "tenant-1");
            var earlierBefore = await RawDoc(earlier);

            var zero = ReadySast();
            zero.Metrics = new Dictionary<string, string> { ["new_violations"] = "0" };
            (await sut.TrySaveSastReport(later.ItemId, 0, zero, "tenant-1")).Should().BeTrue();

            (await RawDoc(earlier)).Should().Equal(earlierBefore);
            (await Stored(earlier)).SastReport.Metrics["new_violations"].Should().Be("367");
            (await Stored(later)).SastReport.Metrics["new_violations"].Should().Be("0");
        }

        // ---- TryEndPendingReport ----

        [Theory]
        [InlineData(AnalysisReportKind.Sast)]
        [InlineData(AnalysisReportKind.Sca)]
        public async Task TryEndPendingReport_Pending_SetsStatusAndMessageAndReturnsTheProjectedBuild(AnalysisReportKind kind)
        {
            var build = NewBuild();
            build.SastReport.Attempts = 2;
            build.ScaReport.Attempts = 1;
            await Insert(build);
            var before = await RawDoc(build);
            var field = kind == AnalysisReportKind.Sast ? "SastReport" : "ScaReport";

            var ended = await Builds().TryEndPendingReport(build.PipelineRunName, kind, AnalysisReportStatus.NotRun, "The build was cancelled.", "tenant-1");

            ended.Should().NotBeNull();
            ended.ItemId.Should().Be(build.ItemId);
            ended.CreatedBy.Should().Be("user-1");
            ended.RepoId.Should().Be(build.RepoId);
            ended.ProjectId.Should().Be("tenant-1");
            ended.RepoName.Should().BeNull("only what the notification needs comes back");
            ended.SastReport.Should().BeNull();
            ended.ScaReport.Should().BeNull();
            ended.Events.Should().BeNullOrEmpty();

            var after = await RawDoc(build);
            Without(after, field).Should().Equal(Without(before, field));
            var stored = await Stored(build);
            if (kind == AnalysisReportKind.Sast)
            {
                stored.SastReport.Status.Should().Be(AnalysisReportStatus.NotRun);
                stored.SastReport.Message.Should().Be("The build was cancelled.");
                stored.SastReport.Attempts.Should().Be(2, "only the status and message change");
            }
            else
            {
                stored.ScaReport.Status.Should().Be(AnalysisReportStatus.NotRun);
                stored.ScaReport.Message.Should().Be("The build was cancelled.");
                stored.ScaReport.Attempts.Should().Be(1);
            }
        }

        [Fact]
        public async Task TryEndPendingReport_ReadyOrMissingReport_IsLeftAloneAndReturnsNull()
        {
            var ready = NewBuild();
            ready.SastReport = ReadySast();
            await Insert(ready);
            var legacy = await Insert(NewBuild(withReports: false));
            var readyBefore = await RawDoc(ready);
            var legacyBefore = await RawDoc(legacy);

            (await Builds().TryEndPendingReport(ready.PipelineRunName, AnalysisReportKind.Sast, AnalysisReportStatus.Failed, "x", "tenant-1")).Should().BeNull();
            (await Builds().TryEndPendingReport(legacy.PipelineRunName, AnalysisReportKind.Sca, AnalysisReportStatus.Failed, "x", "tenant-1")).Should().BeNull();

            (await RawDoc(ready)).Should().Equal(readyBefore);
            (await RawDoc(legacy)).Should().Equal(legacyBefore);
        }

        [Fact]
        public async Task TryEndPendingReport_SecondCall_ReturnsNullSoOnlyOneNotification()
        {
            var build = await Insert(NewBuild());
            var sut = Builds();

            (await sut.TryEndPendingReport(build.PipelineRunName, AnalysisReportKind.Sca, AnalysisReportStatus.Failed, "The pipeline did not finish within 30 minutes.", "tenant-1")).Should().NotBeNull();
            (await sut.TryEndPendingReport(build.PipelineRunName, AnalysisReportKind.Sca, AnalysisReportStatus.NotRun, "The build was cancelled.", "tenant-1")).Should().BeNull();

            (await Stored(build)).ScaReport.Message.Should().Be("The pipeline did not finish within 30 minutes.");
        }

        [Fact]
        public async Task TryEndPendingReport_ProjectPlacement_EndsTheReportInThatDatabase()
        {
            var build = await Insert(NewBuild());
            var project = new Tenant
            {
                TenantId = "tenant-1", TenantGroupId = "g", Name = "proj", Environment = "dev",
                DbConnectionString = MongoIntegrationFixture.ConnectionString, DBName = _fixture.DatabaseName,
                JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
            };

            var ended = await Builds().TryEndPendingReport(build.PipelineRunName, AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "The build was cancelled.", project);

            ended.Should().NotBeNull();
            ended.ItemId.Should().Be(build.ItemId);
            ended.CreatedBy.Should().Be("user-1");
            var stored = await Stored(build);
            stored.SastReport.Status.Should().Be(AnalysisReportStatus.NotRun);
            stored.ScaReport.Status.Should().Be(AnalysisReportStatus.Pending);
        }

        [Fact]
        public async Task TryEndPendingReport_ProjectWithoutPlacement_Throws()
        {
            var project = new Tenant { TenantId = "tenant-1", TenantGroupId = "g", DbConnectionString = null!, JwtTokenParameters = null! };

            var act = () => Builds().TryEndPendingReport("run-x", AnalysisReportKind.Sast, AnalysisReportStatus.NotRun, "m", project);

            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        // ---- H15 / C19: build reads ----

        private static string Json(Build build) => JsonSerializer.Serialize(build, Web);

        private static string JsonWithoutReports(Build build)
        {
            build.SastReport = null;
            build.ScaReport = null;
            return JsonSerializer.Serialize(build, Web);
        }

        [Fact]
        public async Task H15_GetBuildForView_LeavesTheStoredReportsOut()
        {
            var build = NewBuild();
            build.SastReport = ReadySast();
            build.ScaReport = ReadySca();
            await Insert(build);

            var view = await Builds().GetBuildForView(build.ItemId);

            view.Should().NotBeNull();
            view.SastReport.Should().BeNull();
            view.ScaReport.Should().BeNull();
            view.RepoName.Should().Be("org/repo");
            view.Events.Should().ContainSingle();
            var json = Json(view);
            json.Should().Contain("\"sastReport\":null").And.Contain("\"scaReport\":null", "Q3 A: the keys stay null as dev serves them");
            json.Should().NotContain("new_violations").And.NotContain("CVE-1");
            json.Should().Be(JsonWithoutReports(await Stored(build)));
        }

        [Fact]
        public async Task C19_GetBuildForView_PreReleaseBuild_IsByteIdenticalToTheUnprojectedRead()
        {
            var build = await Insert(NewBuild(withReports: false));

            var view = await Builds().GetBuildForView(build.ItemId);
            var direct = await Stored(build);

            Json(view).Should().Be(Json(direct));
            System.Text.Encoding.UTF8.GetByteCount(Json(view)).Should().Be(System.Text.Encoding.UTF8.GetByteCount(Json(direct)));
        }

        [Fact]
        public async Task H15_C19_GetRepoBuildList_LeavesTheReportsOutAndKeepsPreReleaseBuildsIdentical()
        {
            var repoId = Guid.NewGuid().ToString("N");
            var withReports = NewBuild(repoId: repoId);
            withReports.SastReport = ReadySast();
            withReports.ScaReport = ReadySca();
            withReports.CreatedDate = withReports.CreatedDate.AddMinutes(5);
            await Insert(withReports);
            var legacy = await Insert(NewBuild(withReports: false, repoId: repoId));

            var list = await Repos().GetRepoBuildList(repoId, null, 1, 30);

            list.Should().HaveCount(2);
            list.Should().OnlyContain(b => b.SastReport == null && b.ScaReport == null);
            Json(list.Single(b => b.ItemId == legacy.ItemId)).Should().Be(Json(await Stored(legacy)));
            Json(list.Single(b => b.ItemId == withReports.ItemId)).Should().Be(JsonWithoutReports(await Stored(withReports)));
        }

        [Fact]
        public async Task H15_C19_GetReposWithBuildsAsync_LeavesTheReportsOutAndKeepsPreReleaseBuildsIdentical()
        {
            var userId = Guid.NewGuid().ToString("N");
            var projectId = Guid.NewGuid().ToString("N");
            var repo = new Repo
            {
                ItemId = Guid.NewGuid().ToString("N"), ProjectId = projectId, BlocksUserId = userId,
                RepoName = "org/" + Guid.NewGuid().ToString("N"), Branch = "dev", DeploymentType = "Manual",
            };
            await Repos().SaveRepo(repo);
            var withReports = NewBuild(repoId: repo.ItemId, userId: userId);
            withReports.SastReport = ReadySast();
            withReports.ScaReport = ReadySca();
            await Insert(withReports);
            var legacy = await Insert(NewBuild(withReports: false, repoId: repo.ItemId, userId: userId));

            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));
            try
            {
                var result = await Repos().GetReposWithBuildsAsync(projectId);

                var builds = result.Should().ContainSingle(r => r.ItemId == repo.ItemId).Subject.Builds;
                builds.Should().HaveCount(2);
                builds.Should().OnlyContain(b => b.SastReport == null && b.ScaReport == null);
                Json(builds.Single(b => b.ItemId == legacy.ItemId)).Should().Be(Json(await Stored(legacy)));
                Json(builds.Single(b => b.ItemId == withReports.ItemId)).Should().Be(JsonWithoutReports(await Stored(withReports)));
            }
            finally
            {
                BlocksContext.ClearContext();
            }
        }

        [Fact]
        public async Task H15_ResolverExclusionProjection_IsKeptAndTheReportsAreAlsoLeftOut()
        {
            var build = NewBuild();
            build.SastReport = ReadySast();
            await Insert(build);
            var access = new ProjectingReleaseDataAccess(new BsonDocument("ImageName", 0));

            var view = await Builds(access).GetBuildForView(build.ItemId);

            view.ImageName.Should().BeNull("the resolver's own exclusion still applies");
            view.RepoName.Should().Be("org/repo");
            view.SastReport.Should().BeNull();
        }

        [Fact]
        public async Task H15_ResolverInclusionProjection_ListingAReport_StillLeavesTheReportOut()
        {
            var build = NewBuild();
            build.SastReport = ReadySast();
            build.ScaReport = ReadySca();
            await Insert(build);
            var access = new ProjectingReleaseDataAccess(new BsonDocument
            {
                { "RepoName", 1 }, { "Branch", true }, { "SastReport.Status", 1 }, { "ScaReport", 1 },
            });

            var view = await Builds(access).GetBuildForView(build.ItemId);

            view.Should().NotBeNull("MongoDB must not be sent a mixed inclusion/exclusion projection");
            view.RepoName.Should().Be("org/repo");
            view.Branch.Should().Be("dev");
            view.ImageName.Should().BeNull("an inclusion projection leaves out what it does not list");
            view.SastReport.Should().BeNull();
            view.ScaReport.Should().BeNull();
        }

        [Fact]
        public void ReportFields_AreTheStoredElementNames()
        {
            BuildRepository.ReportFields.Should().Equal("SastReport", "ScaReport");
        }

        /// <summary>Like <see cref="PassThroughReleaseDataAccess"/>, but reads come back with a resolver projection.</summary>
        private sealed class ProjectingReleaseDataAccess : IReleaseDataAccess
        {
            private readonly BsonDocument _projection;
            private readonly PassThroughReleaseDataAccess _inner = new();

            public ProjectingReleaseDataAccess(BsonDocument projection) => _projection = projection;

            public Task<ReadScope<T>> ReadAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string tenantId = null, bool useProjection = true) =>
                Task.FromResult(new ReadScope<T>(true, filter, new BsonDocumentProjectionDefinition<T>(_projection)));

            public Task<FilterDefinition<T>> EditFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string tenantId = null) =>
                _inner.EditFilterAsync(schema, filter, callSite, tenantId);

            public Task<FilterDefinition<T>> DeleteFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string tenantId = null) =>
                _inner.DeleteFilterAsync(schema, filter, callSite, tenantId);

            public Task<bool> InsertAllowedAsync(string schema, string callSite, string tenantId = null) => _inner.InsertAllowedAsync(schema, callSite, tenantId);

            public Task<T> PrepareWriteAsync<T>(string schema, T entity, bool isInsert, string callSite, string tenantId = null) =>
                _inner.PrepareWriteAsync(schema, entity, isInsert, callSite, tenantId);

            public Task<T> PrepareUpsertAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string tenantId = null) =>
                _inner.PrepareUpsertAsync(schema, entity, collection, filter, callSite, tenantId);

            public Task<T> PrepareReplaceAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string tenantId = null) =>
                _inner.PrepareReplaceAsync(schema, entity, collection, filter, callSite, tenantId);

            public Task CheckUpdateAsync<T>(string schema, UpdateDefinition<T> update, string callSite, string tenantId = null) =>
                _inner.CheckUpdateAsync(schema, update, callSite, tenantId);
        }
    }
}
