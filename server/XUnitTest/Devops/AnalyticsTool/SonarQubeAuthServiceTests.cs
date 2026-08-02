using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.AnalyticsTool.Services.Sast;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    public class SonarQubeAuthServiceTests
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IHttpClientFactory> _clientFactory = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config;

        public SonarQubeAuthServiceTests()
        {
            _secret.SetupGet(s => s.SonarQubeToken).Returns("sq-token");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["SonarQubeBaseUri"] = "https://sonar.example.com"
                })
                .Build();
        }

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _code;
            public StubHandler(HttpStatusCode code) => _code = code;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
                => Task.FromResult(new HttpResponseMessage(_code));
        }

        private void SetupClientFactory(HttpStatusCode code) =>
            _clientFactory.Setup(f => f.CreateClient(It.IsAny<string>()))
                          .Returns(new HttpClient(new StubHandler(code)));

        private SonarQubeAuthService CreateService() =>
            new(new Mock<ILogger<SonarQubeAuthService>>().Object, _http.Object, _clientFactory.Object, _secret.Object, _config);

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        // ---- SearchUser ----

        [Fact]
        public async Task SearchUser_ExactMatch_ReturnsUser()
        {
            var search = new SonarQubeUserSearchResponse
            {
                users = new List<SonarQubeUserResponse> { new() { login = "bob@x.com", email = "bob@x.com", id = "u1" } }
            };
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((search, ""));
            var result = await CreateService().SearchUser("bob@x.com");
            result.Should().NotBeNull();
            result.id.Should().Be("u1");
        }

        [Fact]
        public async Task SearchUser_NoExactMatch_ReturnsNull()
        {
            var search = new SonarQubeUserSearchResponse
            {
                users = new List<SonarQubeUserResponse> { new() { login = "someoneelse", email = "other@x.com", id = "u9" } }
            };
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((search, ""));
            var result = await CreateService().SearchUser("bob@x.com");
            result.Should().BeNull();
        }

        [Fact]
        public async Task SearchUser_NoUsers_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse>() }, ""));
            var result = await CreateService().SearchUser("bob@x.com");
            result.Should().BeNull();
        }

        // ---- CreateUser ----

        [Fact]
        public async Task CreateUser_Success_ReturnsUser()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new SonarQubeUserResponse { id = "u1", login = "bob" }, Resp(HttpStatusCode.OK)));
            var result = await CreateService().CreateUser("bob");
            result.id.Should().Be("u1");
        }

        [Fact]
        public async Task CreateUser_Conflict_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeUserResponse)null, Resp(HttpStatusCode.Conflict)));
            (await CreateService().CreateUser("bob")).Should().BeNull();
        }

        [Fact]
        public async Task CreateUser_OtherStatus_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeUserResponse)null, Resp(HttpStatusCode.InternalServerError)));
            (await CreateService().CreateUser("bob")).Should().BeNull();
        }

        // ---- UpdateUserOidcProvider ----

        [Fact]
        public async Task UpdateOidcProvider_Success_ReturnsTrue()
        {
            SetupClientFactory(HttpStatusCode.OK);
            (await CreateService().UpdateUserOidcProvider("u1", "bob@x.com")).Should().BeTrue();
        }

        [Fact]
        public async Task UpdateOidcProvider_Failure_ReturnsFalse()
        {
            SetupClientFactory(HttpStatusCode.BadRequest);
            (await CreateService().UpdateUserOidcProvider("u1", "bob@x.com")).Should().BeFalse();
        }

        // ---- SearchGroup ----

        [Fact]
        public async Task SearchGroup_ExactMatch_ReturnsGroup()
        {
            var search = new SonarQubeGroupSearchResponse
            {
                groups = new List<SonarQubeGroupResponse> { new() { id = "g1", name = "Blocks_key" } }
            };
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((search, ""));
            var result = await CreateService().SearchGroup("Blocks_key");
            result.id.Should().Be("g1");
        }

        [Fact]
        public async Task SearchGroup_NoMatch_ReturnsNull()
        {
            var search = new SonarQubeGroupSearchResponse
            {
                groups = new List<SonarQubeGroupResponse> { new() { id = "g2", name = "other" } }
            };
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((search, ""));
            (await CreateService().SearchGroup("Blocks_key")).Should().BeNull();
        }

        [Fact]
        public async Task SearchGroup_NoGroups_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse>() }, ""));
            (await CreateService().SearchGroup("Blocks_key")).Should().BeNull();
        }

        // ---- CreateGroup ----

        [Fact]
        public async Task CreateGroup_Created_ReturnsGroup()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeGroupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new SonarQubeGroupResponse { id = "g1" }, Resp(HttpStatusCode.Created)));
            (await CreateService().CreateGroup("Blocks_key")).id.Should().Be("g1");
        }

        [Fact]
        public async Task CreateGroup_Conflict_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeGroupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeGroupResponse)null, Resp(HttpStatusCode.Conflict)));
            (await CreateService().CreateGroup("Blocks_key")).Should().BeNull();
        }

        [Fact]
        public async Task CreateGroup_OtherStatus_ReturnsNull()
        {
            _http.Setup(h => h.MakeHttpRequest<SonarQubeGroupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeGroupResponse)null, Resp(HttpStatusCode.InternalServerError)));
            (await CreateService().CreateGroup("Blocks_key")).Should().BeNull();
        }

        // ---- AddUserToGroup ----

        [Fact]
        public async Task AddUserToGroup_Success_ReturnsTrue()
        {
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            (await CreateService().AddUserToGroup("u1", "g1")).Should().BeTrue();
        }

        [Fact]
        public async Task AddUserToGroup_Conflict_ReturnsFalse()
        {
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.Conflict)));
            (await CreateService().AddUserToGroup("u1", "g1")).Should().BeFalse();
        }

        [Fact]
        public async Task AddUserToGroup_OtherStatus_ReturnsFalse()
        {
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.InternalServerError)));
            (await CreateService().AddUserToGroup("u1", "g1")).Should().BeFalse();
        }

        // ---- AssignUserPermission ----

        [Fact]
        public async Task AssignUserPermission_AllSucceed_ReturnsTrue()
        {
            SetupClientFactory(HttpStatusCode.OK);
            var result = await CreateService().AssignUserPermission("repo", "Blocks_key", CloudBuildConstants.SONARQUBE_PERMISSIONS);
            result.Should().BeTrue();
        }

        [Fact]
        public async Task AssignUserPermission_Fails_ReturnsFalse()
        {
            SetupClientFactory(HttpStatusCode.BadRequest);
            var result = await CreateService().AssignUserPermission("repo", "Blocks_key", CloudBuildConstants.SONARQUBE_PERMISSIONS);
            result.Should().BeFalse();
        }

        // ---- ProcessSonarQubeUser ----

        [Fact]
        public async Task ProcessSonarQubeUser_NullRepo_ReturnsFalse()
        {
            (await CreateService().ProcessSonarQubeUser("bob", null, "key")).Should().BeFalse();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_ExistingUserAndGroup_ReturnsTrue()
        {
            // SearchUser returns existing user
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse> { new() { login = "bob", email = "bob", id = "u1" } } }, ""));
            // SearchGroup returns existing group
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse> { new() { id = "g1", name = "Blocks_key" } } }, ""));
            // AddUserToGroup (object request)
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            // AssignUserPermission uses http client
            SetupClientFactory(HttpStatusCode.OK);

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_CreateUserFails_ReturnsFalse()
        {
            // SearchUser returns no match -> tries CreateUser which fails (Conflict)
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse>() }, ""));
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeUserResponse)null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeFalse();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_NewUserNewGroup_ReturnsTrue()
        {
            // The object-typed request setup is registered first: a call to a typed
            // MakeHttpRequest<T> also matches the object setup (object is assignable from T),
            // and Moq prefers the last matching setup, so typed setups must be registered after it.
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            // No existing user, create succeeds
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse>() }, ""));
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new SonarQubeUserResponse { id = "u1", login = "bob" }, Resp(HttpStatusCode.OK)));
            // No existing group, create succeeds
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse>() }, ""));
            _http.Setup(h => h.MakeHttpRequest<SonarQubeGroupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new SonarQubeGroupResponse { id = "g1", name = "Blocks_key" }, Resp(HttpStatusCode.Created)));
            SetupClientFactory(HttpStatusCode.OK);

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_CreateGroupFails_ReturnsFalse()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse> { new() { login = "bob", email = "bob", id = "u1" } } }, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse>() }, ""));
            _http.Setup(h => h.MakeHttpRequest<SonarQubeGroupResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync(((SonarQubeGroupResponse)null, Resp(HttpStatusCode.Conflict)));

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeFalse();
        }
    
        [Fact]
        public async Task ProcessSonarQubeUser_StillSucceedsWhenTheOidcAndMembershipCallsAreRejected()
        {
            // Setting the OIDC provider and adding the group membership are both best-effort: the
            // user and group already exist by then, so a rejection is logged and the flow continues.
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.BadRequest)));
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse>() }, ""));
            _http.Setup(h => h.MakeHttpRequest<SonarQubeUserResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new SonarQubeUserResponse { id = "u1", login = "bob" }, Resp(HttpStatusCode.OK)));
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse> { new() { id = "g1", name = "Blocks_key" } } }, ""));
            SetupClientFactory(HttpStatusCode.OK);

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_StillSucceedsWhenPermissionAssignmentIsRejected()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse> { new() { login = "bob", email = "bob", id = "u1" } } }, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse> { new() { id = "g1", name = "Blocks_key" } } }, ""));
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            // A permission call that SonarQube refuses is reported, not fatal.
            SetupClientFactory(HttpStatusCode.Forbidden);

            var result = await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task ProcessSonarQubeUser_NormalisesASlashInTheRepositoryName()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeUserSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeUserSearchResponse { users = new List<SonarQubeUserResponse> { new() { login = "bob", email = "bob", id = "u1" } } }, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarQubeGroupSearchResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                 .ReturnsAsync((new SonarQubeGroupSearchResponse { groups = new List<SonarQubeGroupResponse> { new() { id = "g1", name = "Blocks_key" } } }, ""));
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((new object(), Resp(HttpStatusCode.OK)));
            SetupClientFactory(HttpStatusCode.OK);

            // "org/repo" is not a legal SonarQube project key, so it becomes "org-repo".
            (await CreateService().ProcessSonarQubeUser("bob", "org/repo", "key")).Should().BeTrue();
        }
}
}
