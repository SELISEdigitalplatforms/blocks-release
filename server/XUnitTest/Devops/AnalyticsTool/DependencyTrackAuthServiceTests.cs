using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.AnalyticsTool.Services.Sca;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    public class DependencyTrackAuthServiceTests : IDisposable
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly Mock<IDbContextProvider> _dbProvider = new();
        private readonly IConfiguration _config;

        public DependencyTrackAuthServiceTests()
        {
            _secret.SetupGet(s => s.DependencyTrackApiKey).Returns("api-key");
            _secret.SetupGet(s => s.DependencyTrackDefaultTeamId).Returns("team-default");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["DependencyTrackBaseUrl"] = "https://dt.example.com",
                    ["ScaToolsApiBaseUri"] = "https://sca.example.com"
                })
                .Build();
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-dt", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-dt"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private DependencyTrackAuthService CreateService()
        {
            var repoService = new DependencyTrackRepositoryService(
                _dbProvider.Object, new Mock<ILogger<DependencyTrackRepositoryService>>().Object);
            return new DependencyTrackAuthService(
                new Mock<ILogger<DependencyTrackAuthService>>().Object,
                _http.Object, _config, repoService, _secret.Object);
        }

        private static HttpResponseMessage Resp(HttpStatusCode code, string body = null) =>
            new(code) { Content = new StringContent(body ?? string.Empty) };

        private void SetupObjectRequest(HttpResponseMessage resp) =>
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), resp));

        // ---- CreateDependencyTrackOidcUser ----

        [Fact]
        public async Task CreateOidcUser_Created_ReturnsTrue()
        {
            SetupObjectRequest(Resp(HttpStatusCode.Created));
            (await CreateService().CreateDependencyTrackOidcUser("bob")).Should().BeTrue();
        }

        [Fact]
        public async Task CreateOidcUser_Conflict_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.Conflict));
            (await CreateService().CreateDependencyTrackOidcUser("bob")).Should().BeFalse();
        }

        [Fact]
        public async Task CreateOidcUser_BadRequest_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.BadRequest, "invalid"));
            (await CreateService().CreateDependencyTrackOidcUser("bob")).Should().BeFalse();
        }

        [Fact]
        public async Task CreateOidcUser_OtherStatus_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.InternalServerError));
            (await CreateService().CreateDependencyTrackOidcUser("bob")).Should().BeFalse();
        }

        // ---- AddDependencyTrackOidcTeam ----

        [Fact]
        public async Task AddOidcTeam_Success_ReturnsTrue()
        {
            SetupObjectRequest(Resp(HttpStatusCode.OK));
            (await CreateService().AddDependencyTrackOidcTeam("bob", "uuid")).Should().BeTrue();
        }

        [Fact]
        public async Task AddOidcTeam_NotModified_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.NotModified));
            (await CreateService().AddDependencyTrackOidcTeam("bob", "uuid")).Should().BeFalse();
        }

        // ---- CreateDependencyTrackOidcTeam ----

        [Fact]
        public async Task CreateOidcTeam_Created_ReturnsResult()
        {
            var team = new DependencyTrackTeamCreateResponse { uuid = "u1", name = "t1" };
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((team, Resp(HttpStatusCode.Created)));
            var result = await CreateService().CreateDependencyTrackOidcTeam("t1");
            result.Should().NotBeNull();
            result.uuid.Should().Be("u1");
        }

        [Fact]
        public async Task CreateOidcTeam_Conflict_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((DependencyTrackTeamCreateResponse)null, Resp(HttpStatusCode.Conflict)));
            (await CreateService().CreateDependencyTrackOidcTeam("t1")).Should().BeNull();
        }

        [Fact]
        public async Task CreateOidcTeam_OtherStatus_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((DependencyTrackTeamCreateResponse)null, Resp(HttpStatusCode.InternalServerError)));
            (await CreateService().CreateDependencyTrackOidcTeam("t1")).Should().BeNull();
        }

        // ---- MapDependencyTrackTeamToProject ----

        [Fact]
        public async Task MapTeamToProject_Success_ReturnsTrue()
        {
            SetupObjectRequest(Resp(HttpStatusCode.OK));
            (await CreateService().MapDependencyTrackTeamToProject("t", "p")).Should().BeTrue();
        }

        [Fact]
        public async Task MapTeamToProject_Conflict_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.Conflict));
            (await CreateService().MapDependencyTrackTeamToProject("t", "p")).Should().BeFalse();
        }

        [Fact]
        public async Task MapTeamToProject_BadRequest_ReturnsFalse()
        {
            SetupObjectRequest(Resp(HttpStatusCode.BadRequest));
            (await CreateService().MapDependencyTrackTeamToProject("t", "p")).Should().BeFalse();
        }

        // ---- EnsureDependencyTrackProjectExists (repository read fails -> null, creates new) ----

        [Fact]
        public async Task EnsureProjectExists_NoExisting_CreatesTeamAndReturnsProject()
        {
            // GetDependencyTrackProject throws internally (no db) and returns null,
            // so a new project is built and a team is created via HTTP.
            var team = new DependencyTrackTeamCreateResponse { uuid = "tu", name = "tn" };
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((team, Resp(HttpStatusCode.Created)));

            var result = await CreateService().EnsureDependencyTrackProjectExists("proj");

            result.Should().NotBeNull();
            result.ProjectTeamUuid.Should().Be("tu");
            result.ProjectName.Should().Be("proj");
        }

        [Fact]
        public async Task EnsureProjectExists_TeamCreateFails_ReturnsProjectWithoutTeam()
        {
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((DependencyTrackTeamCreateResponse)null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateService().EnsureDependencyTrackProjectExists("proj");

            result.Should().NotBeNull();
            result.ProjectTeamUuid.Should().BeNull();
        }

        // ---- ProcessDependencyTrackOidcUser (project has no team -> returns true) ----

        [Fact]
        public async Task ProcessOidcUser_ProjectWithoutTeam_ReturnsFalse()
        {
            // user create + team membership on object endpoint
            SetupObjectRequest(Resp(HttpStatusCode.Created));
            // team creation fails so EnsureProject returns a non-null project with null team uuid.
            // A non-null project makes ProcessDependencyTrackOidcUser return false.
            _http.Setup(h => h.MakeHttpRequest<DependencyTrackTeamCreateResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((DependencyTrackTeamCreateResponse)null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateService().ProcessDependencyTrackOidcUser("bob", "proj");

            result.Should().BeFalse();
        }
    }
}
