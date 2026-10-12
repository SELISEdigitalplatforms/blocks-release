using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using k8s;
using k8s.Autorest;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using Moq;
using Newtonsoft.Json;
using Xunit;
using XUnitTest.TestDoubles;

namespace XUnitTest.Integration
{
    /// <summary>
    /// The two token readers outside <see cref="AuthService"/> that matter most - the CLI git-push
    /// credential and the webhook-triggered build - over the real <see cref="TokenRepository"/> on
    /// local MongoDB, with a test double for the Key Vault value store.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class GithubTokenConsumersIntegrationTests : IDisposable
    {
        private static readonly string[] Roles = ["role"];
        private static readonly string[] Permissions = ["perm"];

        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<ICloudBuildSecret> _cloudBuildSecret = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<IKubernetes> _k8s = new();
        private readonly Mock<ICustomObjectsOperations> _customObjects = new();
        private readonly FakeSecretValueStore _store = new();
        private readonly ListLogger<TokenRepository> _logger = new();
        private readonly string _userId = Guid.NewGuid().ToString("N");
        private readonly IConfiguration _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ImageReference"] = "registry.example.com/" })
            .Build();
        private object? _submittedPipelineRun;

        public GithubTokenConsumersIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            _k8s.SetupGet(k => k.CustomObjects).Returns(_customObjects.Object);
        }

        private readonly HttpResponseMessage _ok = new(HttpStatusCode.OK);
        private readonly HttpOperationResponse<object> _created = new()
        {
            Body = new Dictionary<string, object> { ["metadata"] = "created" },
            Request = new HttpRequestMessage(),
            Response = new HttpResponseMessage()
        };

        public void Dispose()
        {
            BlocksContext.ClearContext();
            _ok.Dispose();
            _created.Dispose();
        }

        private TokenRepository Repository() =>
            GithubTokenStoreTestSupport.CreateRepository(_fixture.DbContextProvider, _blocksSecret.Object, _logger, _store);

        private void SetUser() =>
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-1", Roles, _userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", Permissions, "octo",
                "phone", "display", "oauth", "tenant-1"));

        private string SeedVaultRow(string? token)
        {
            var secretId = "github-token-" + Guid.NewGuid().ToString("N");
            if (token is not null)
            {
                _store.Values[secretId] = token;
            }

            _fixture.Collection<BsonDocument>("RepositoryTokens").InsertOne(new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), _userId },
                { nameof(RepositoryToken.TokenSecretId), secretId },
                { nameof(RepositoryToken.AccessToken), "bogus-plaintext" },
                { nameof(RepositoryToken.UserName), "octo-login" }
            });
            return secretId;
        }

        private Repo NewRepo() => new()
        {
            ItemId = "repo-1",
            ProjectId = "tenant-1",
            ProjectName = "My Project",
            RepoName = "my-repo",
            RepoUrl = "https://github.com/org/repo.git",
            Branch = "main",
            DefaultDeploymentUrl = "app.example.com",
            CreatedBy = _userId
        };

        private PipelineRunService PipelineRunService() =>
            new(_k8s.Object, Repository(), _configuration, _cloudBuildSecret.Object);

        private void SetupPipelineRunCreate() =>
            _customObjects
                .Setup(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                    It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                    It.IsAny<CancellationToken>()))
                .Callback((object submitted, string _, string _, string _, string _, string _,
                           string _, string _, bool? _,
                           IReadOnlyDictionary<string, IReadOnlyList<string>> _, CancellationToken _) =>
                    _submittedPipelineRun = submitted)
                .ReturnsAsync(_created);

        private void VerifyNoPipelineRunCreated() =>
            _customObjects.Verify(c => c.CreateNamespacedCustomObjectWithHttpMessagesAsync(
                It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(),
                It.IsAny<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                It.IsAny<CancellationToken>()), Times.Never);

        // ---- CLI git-push credential (GithubService) ----

        [Fact]
        public async Task PushCredentialForVaultRowReturnsTheVaultTokenAndLogin()
        {
            // H16
            SetUser();
            SeedVaultRow("gho_vault_token");
            _http.Setup(h => h.MakeHttpRequest<object>(It.IsAny<string>(), It.IsAny<string>(), HttpMethod.Get, null,
                        It.Is<Dictionary<string, string>>(d => d["Authorization"] == "Bearer gho_vault_token"), null))
                 .ReturnsAsync(((object)null!, _ok));
            var service = new GithubService(Repository(), _http.Object, _configuration, _cloudBuildSecret.Object);

            var credential = await service.GetPushCredential();

            credential.Should().NotBeNull();
            credential!.Token.Should().Be("gho_vault_token");
            credential.Login.Should().Be("octo-login");
        }

        // ---- Webhook-triggered build (PipelineRunService) ----

        [Fact]
        public async Task WebhookBuildForVaultRowCreatesPipelineRunWithTheVaultToken()
        {
            // H8: no signed-in user; the repository owner's token comes from the vault.
            BlocksContext.ClearContext();
            SeedVaultRow("gho_vault_token");
            SetupPipelineRunCreate();

            var (name, image, _, error) = await PipelineRunService().CreateNamespaceAsync(NewRepo());

            error.Should().BeNull();
            name.Should().NotBeNullOrEmpty();
            image.Should().NotBeNullOrEmpty();
            var submitted = JsonConvert.SerializeObject(_submittedPipelineRun);
            submitted.Should().Contain("gho_vault_token");
            submitted.Should().NotContain("bogus-plaintext");
        }

        [Fact]
        public async Task WebhookBuildForVaultRowWithMissingValueAsksToAuthorizeAgain()
        {
            // C8 (build path)
            BlocksContext.ClearContext();
            SeedVaultRow(token: null);

            var (name, _, _, error) = await PipelineRunService().CreateNamespaceAsync(NewRepo());

            name.Should().BeNull();
            error.Should().Be("Access token not found. Please authorize again.");
            VerifyNoPipelineRunCreated();
        }

        [Theory]
        [InlineData(503)]
        [InlineData(429)]
        public async Task WebhookBuildVaultFailureCreatesNoPipelineRunAndReportsUnavailable(int status)
        {
            // C9, C10
            BlocksContext.ClearContext();
            SeedVaultRow("gho_vault_token");
            _store.Fail("get", status);

            var (name, image, ns, error) = await PipelineRunService().CreateNamespaceAsync(NewRepo());

            name.Should().BeNull();
            image.Should().BeNull();
            ns.Should().BeNull();
            error.Should().Be("This operation is not possible right now. Please try again later.");
            VerifyNoPipelineRunCreated();
        }
    }
}
