using Blocks.Genesis.Entities.Release;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using XUnitTest.TestDoubles;

namespace XUnitTest.Devops.VersionControlSystems
{
    /// <summary>
    /// A GitHub stand-in behind <see cref="IHttpHelperServices.SendWithTimeoutAsync"/>: answers each call from a
    /// route table keyed "METHOD /path" (queued answers, the last one repeats) and records every call, so tests can
    /// assert the exact calls made and their number (spec §5 budgets).
    /// </summary>
    internal sealed class FakeGithub
    {
        public const string Api = "https://api.github.com";
        private readonly List<(string Key, Queue<HttpCallResult> Answers)> _routes = new();

        public List<(HttpMethod Method, string Path, object Payload, string Token, TimeSpan Timeout)> Calls { get; } = new();

        public FakeGithub(Mock<IHttpHelperServices> http)
        {
            http.Setup(h => h.SendWithTimeoutAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
                .ReturnsAsync((string _, string url, HttpMethod method, object payload, Dictionary<string, string> _, string token, TimeSpan timeout) =>
                {
                    var path = url[Api.Length..];
                    Calls.Add((method, path, payload, token, timeout));
                    var key = $"{method.Method} {path}";
                    var route = _routes.FirstOrDefault(r => r.Key == key);
                    if (route.Answers is null)
                        throw new InvalidOperationException($"No answer for {key}");
                    return route.Answers.Count > 1 ? route.Answers.Dequeue() : route.Answers.Peek();
                });
        }

        public FakeGithub On(string key, HttpStatusCode status, object body = null)
        {
            var json = body switch
            {
                null => string.Empty,
                string text => text,
                _ => JsonSerializer.Serialize(body),
            };
            return On(key, new HttpCallResult(status, json));
        }

        public FakeGithub On(string key, HttpCallResult answer)
        {
            var existing = _routes.FirstOrDefault(r => r.Key == key);
            if (existing.Answers is null)
                _routes.Add((key, new Queue<HttpCallResult>(new[] { answer })));
            else
                existing.Answers.Enqueue(answer);
            return this;
        }

        public FakeGithub NoAnswer(string key) => On(key, HttpCallResult.NoAnswer());

        public int WebhookCalls => Calls.Count(c => c.Path.Contains("/hooks", StringComparison.Ordinal));
        public int RepositoryReads => Calls.Count(c => !c.Path.Contains("/hooks", StringComparison.Ordinal));
    }

    public class GithubWebhookServiceTests : IDisposable
    {
        private const string HookUrl = "https://hook/tenant-9";

        private readonly ListLogger<GithubWebhookService> _logger = new();
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ITokenRepository> _tokenRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config;
        private readonly FakeGithub _github;

        public GithubWebhookServiceTests()
        {
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string> { ["GithubWebhookUrl"] = "https://hook/" })
                .Build();
            _secret.SetupGet(s => s.GithubWebhookSecret).Returns("whsecret");
            _github = new FakeGithub(_http);
            _repoRepo.Setup(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>())).ReturnsAsync(true);
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>())).ReturnsAsync(true);
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-9", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-9"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private GithubWebhookService CreateService() =>
            new(_logger, _config, _http.Object, _tokenRepo.Object, _repoRepo.Object, _secret.Object);

        private static Repo Repo(GithubWebhook hook = null) => new()
        {
            ItemId = "repo-1",
            RepoName = "org/repo",
            RepoUrl = "https://github.com/org/repo",
            DeploymentType = RepoDeploymentType.Auto,
            GithubWebhook = hook,
        };

        private static HttpResponseMessage Resp(HttpStatusCode code) => new(code);

        private void SetupToken() =>
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync(new RepositoryToken { AccessToken = "tok" });

        private void SetupUserToken(string userId = "user-7") =>
            _tokenRepo.Setup(t => t.getToken(userId)).ReturnsAsync("tok-" + userId);

        private Task<WebhookOutcome> TurnOn(Repo repo, string userId = "user-7") =>
            CreateService().SetActiveAsync(repo, true, "tenant-9", userId);

        private Task<WebhookOutcome> TurnOff(Repo repo, string userId = "user-7") =>
            CreateService().SetActiveAsync(repo, false, "tenant-9", userId);

        private static object Hook(long id, string url, bool active = false) =>
            new { id, active, config = new { url, content_type = "json", insecure_ssl = "0" } };

        private static object Permissions(bool admin) => new { permissions = new { admin, push = true, pull = true } };

        // ---- CreateWebhook (GET /github/CreateWebhook) ----

        [Fact]
        public async Task CreateWebhook_NullRepo_ReturnsNull()
        {
            var result = await CreateService().CreateWebhook(null);
            result.Should().BeNull();
        }

        [Fact]
        public async Task CreateWebhook_NoToken_ReturnsNull()
        {
            _tokenRepo.Setup(t => t.getToken()).ReturnsAsync((RepositoryToken)null);
            var result = await CreateService().CreateWebhook(Repo());
            result.Should().BeNull();
        }

        [Fact]
        public async Task CreateWebhook_Created_ReturnsMappedWebhook()
        {
            SetupToken();
            var success = new GithubWebhookSuccessResponse { id = 42, name = "web", active = true };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((success, null, Resp(HttpStatusCode.Created)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().NotBeNull();
            result.Id.Should().Be(42);
        }

        [Fact]
        public async Task CreateWebhook_Created_MapsGithubSnakeCaseConfig()
        {
            SetupToken();
            var success = new GithubWebhookSuccessResponse
            {
                id = 42,
                config = new GithubWebhookConfig { url = "https://hook/tenant-9", content_type = "json", insecure_ssl = "0" }
            };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((success, null, Resp(HttpStatusCode.Created)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Config.Url.Should().Be("https://hook/tenant-9");
            result.Config.ContentType.Should().Be("json");
            result.Config.InsecureSsl.Should().Be("0");
        }

        [Fact]
        public async Task CreateWebhook_NonCreated_ReturnsNull()
        {
            SetupToken();
            var error = new GithubWebhookErrorResponse { errors = new List<GithubWebhookError> { new() { message = "boom" } } };
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, error, Resp(HttpStatusCode.UnprocessableEntity)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().BeNull();
        }

        // C10: GitHub's 404 body has no "errors" array; that used to throw inside the error handling.
        [Fact]
        public async Task CreateWebhook_ErrorBodyWithoutErrorsArray_ReturnsNullAndLogsGithubsMessage()
        {
            SetupToken();
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ReturnsAsync((null, new GithubWebhookErrorResponse { message = "Not Found" }, Resp(HttpStatusCode.NotFound)));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().BeNull();
            _logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error && e.Message.Contains("404") && e.Message.Contains("Not Found"));
        }

        [Fact]
        public async Task CreateWebhook_ManualDeployment_SetsInactive()
        {
            SetupToken();
            var repo = Repo();
            repo.DeploymentType = RepoDeploymentType.Manual;
            GithubWebhookRequest sent = null;
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .Callback<string, string, HttpMethod, object, Dictionary<string, string>, string>((_, _, _, request, _, _) => sent = (GithubWebhookRequest)request)
                 .ReturnsAsync((new GithubWebhookSuccessResponse { id = 7 }, null, Resp(HttpStatusCode.Created)));

            var result = await CreateService().CreateWebhook(repo);

            result.Id.Should().Be(7);
            sent.Active.Should().BeFalse();
            sent.Config.Url.Should().Be("https://hook/tenant-9");
        }

        [Fact]
        public async Task CreateWebhook_Exception_ReturnsNull()
        {
            SetupToken();
            _http.Setup(h => h.MakeHttpRequest<GithubWebhookSuccessResponse, GithubWebhookErrorResponse>(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(), It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()))
                 .ThrowsAsync(new InvalidOperationException("boom"));

            var result = await CreateService().CreateWebhook(Repo());

            result.Should().BeNull();
        }

        // ---- SetActiveAsync(true): §6.3 steps 1-6 ----

        [Fact]
        public async Task TurnOn_WithoutAToken_FailsNotConnectedWithoutAnyGithubCall()
        {
            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeFalse();
            outcome.Code.Should().Be(WebhookCodes.NotConnected);
            _github.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task TurnOn_WithoutAUser_FailsNotConnectedWithoutReadingAnyToken()
        {
            var outcome = await TurnOn(Repo(), userId: null);

            outcome.Code.Should().Be(WebhookCodes.NotConnected);
            _tokenRepo.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
            _tokenRepo.Verify(t => t.getToken(), Times.Never);
            _github.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task TurnOn_StoredHook_PatchesItWithTheActingUsersTokenAndStoresActive()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.OK, Hook(7, HookUrl, active: true));
            var repo = Repo(new GithubWebhook { Id = 7, Active = false });

            var outcome = await TurnOn(repo);

            outcome.Ok.Should().BeTrue();
            outcome.Hook.Active.Should().BeTrue();
            _github.Calls.Should().ContainSingle();
            _github.Calls[0].Token.Should().Be("tok-user-7");
            _github.Calls[0].Payload.Should().BeEquivalentTo(new { active = true });
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive("repo-1", true), Times.Once);
            _tokenRepo.Verify(t => t.getToken(), Times.Never, "no token but the acting user's is used");
        }

        [Fact]
        public async Task TurnOn_EveryCall_IsBoundedByTheTenSecondTimeout()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.OK, Hook(7, HookUrl, active: true));

            await TurnOn(Repo(new GithubWebhook { Id = 7 }));

            GithubWebhookService.GithubCallTimeout.Should().Be(TimeSpan.FromSeconds(10));
            _github.Calls.Should().OnlyContain(c => c.Timeout == TimeSpan.FromSeconds(10));
        }

        [Fact]
        public async Task TurnOn_NoStoredHook_CreatesAnActivePushHookForThisTenantAndStoresIt()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.Created, Hook(42, HookUrl, active: true));
            Repo saved = null;
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), "tenant-9")).Callback<Repo, string>((r, _) => saved = r).ReturnsAsync(true);

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeTrue();
            var request = _github.Calls.Single().Payload.Should().BeOfType<GithubWebhookRequest>().Subject;
            request.Active.Should().BeTrue();
            request.Events.Should().Equal("push");
            request.Config.Url.Should().Be(HookUrl);
            request.Config.Secret.Should().Be("whsecret");
            saved.GithubWebhook.Id.Should().Be(42);
            saved.GithubWebhook.Active.Should().BeTrue();
            saved.GithubWebhook.Config.ContentType.Should().Be("json");
        }

        // H9: a stored hook that is gone on GitHub, and none of ours on the repository: create one.
        [Fact]
        public async Task TurnOn_StoredHookMissingAndNoneOfOursListed_CreatesANewHook()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound, new { message = "Not Found" })
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.OK, new[] { Hook(12, "https://other.example/hook", active: true) })
                   .On("POST /repos/org/repo/hooks", HttpStatusCode.Created, Hook(43, HookUrl, active: true));
            var repo = Repo(new GithubWebhook { Id = 7, Active = true });

            var outcome = await TurnOn(repo);

            outcome.Ok.Should().BeTrue();
            repo.GithubWebhook.Id.Should().Be(43);
            _github.Calls.Select(c => c.Method).Should().Equal(HttpMethod.Patch, HttpMethod.Get, HttpMethod.Post);
            _github.RepositoryReads.Should().Be(0, "the stored hook's 404 is not explained by a repository read");
            _repoRepo.Verify(r => r.UpdateRepo(repo, "tenant-9"), Times.Once);
        }

        [Fact]
        public async Task TurnOn_StoredHookMissingButOursListed_AdoptsIt()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound, new { message = "Not Found" })
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.OK, new[] { Hook(11, HookUrl) })
                   .On("PATCH /repos/org/repo/hooks/11", HttpStatusCode.OK, Hook(11, HookUrl, active: true));
            var repo = Repo(new GithubWebhook { Id = 7 });

            var outcome = await TurnOn(repo);

            outcome.Ok.Should().BeTrue();
            repo.GithubWebhook.Id.Should().Be(11);
            repo.GithubWebhook.Active.Should().BeTrue();
            _github.WebhookCalls.Should().Be(3);
        }

        // H10, C13, example 7: an existing unstored hook is adopted by its exact URL; other hooks are left alone.
        [Fact]
        public async Task TurnOn_HookAlreadyExists_AdoptsOnlyTheHookWithThisTenantsExactUrl()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.UnprocessableEntity,
                        new { message = "Validation Failed", errors = new[] { new { resource = "Hook", code = "custom", message = "Hook already exists on this repository" } } })
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.OK, new[]
                   {
                       Hook(10, HookUrl + "0"),
                       Hook(11, HookUrl),
                       Hook(12, "https://other.example/hook", active: true),
                   })
                   .On("PATCH /repos/org/repo/hooks/11", HttpStatusCode.OK, Hook(11, HookUrl, active: true));
            Repo saved = null;
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), "tenant-9")).Callback<Repo, string>((r, _) => saved = r).ReturnsAsync(true);

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeTrue();
            saved.GithubWebhook.Id.Should().Be(11);
            saved.GithubWebhook.Active.Should().BeTrue();
            _github.WebhookCalls.Should().Be(3);
            _github.Calls.Where(c => c.Method == HttpMethod.Patch).Select(c => c.Path).Should().Equal("/repos/org/repo/hooks/11");
            _github.Calls.Should().NotContain(c => c.Method == HttpMethod.Delete);
        }

        [Fact]
        public async Task TurnOn_HookAlreadyExistsButNoneIsOurs_FailsWithGithubsMessage()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.UnprocessableEntity,
                        new { message = "Validation Failed", errors = new[] { new { message = "Hook already exists on this repository" } } })
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.OK, new[] { Hook(12, "https://other.example/hook") });

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeFalse();
            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("Hook already exists on this repository");
            _github.Calls.Should().HaveCount(2);
            _repoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
        }

        // C5, C10, example 2: a 404 without an "errors" array, explained by the repository read.
        [Fact]
        public async Task TurnOn_RefusedForANonAdmin_IsAPermissionFailure_AndLogsOneLineWithRepoAndStatus()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.NotFound, new { message = "Not Found", documentation_url = "https://docs.github.com" })
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: false));

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeFalse();
            outcome.Code.Should().Be(WebhookCodes.Permission);
            _github.WebhookCalls.Should().Be(1);
            _github.RepositoryReads.Should().Be(1);
            _logger.Entries.Should().ContainSingle(e => e.Message.Contains("org/repo") && e.Message.Contains("404"));
            _repoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
        }

        [Theory]
        [InlineData(HttpStatusCode.NotFound)]
        [InlineData(HttpStatusCode.Forbidden)]
        public async Task TurnOn_RefusedAndTheRepositoryIsNotVisible_IsRepoNotVisible(HttpStatusCode refusal)
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", refusal, new { message = "x" })
                   .On("GET /repos/org/repo", HttpStatusCode.NotFound, new { message = "Not Found" });

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.RepoNotVisible);
        }

        [Fact]
        public async Task TurnOn_RefusedForAnAdmin_FailsWithGithubsMessageAsDetail()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.Forbidden,
                        new { message = "Resource protected by organization SAML enforcement." })
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: true));

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("Resource protected by organization SAML enforcement.");
        }

        [Fact]
        public async Task TurnOn_RefusedAndTheRepositoryReadIsUnauthorized_IsTokenInvalid()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo", HttpStatusCode.Unauthorized);

            (await TurnOn(Repo())).Code.Should().Be(WebhookCodes.TokenInvalid);
        }

        [Fact]
        public async Task TurnOn_RefusedAndTheRepositoryReadTimesOut_IsUnreachable()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.NotFound)
                   .NoAnswer("GET /repos/org/repo");

            (await TurnOn(Repo())).Code.Should().Be(WebhookCodes.Unreachable);
        }

        [Fact]
        public async Task TurnOn_RefusedAndTheRepositoryReadFailsOtherwise_FailsWithTheRefusalsMessage()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.Forbidden, new { message = "Forbidden here" })
                   .On("GET /repos/org/repo", HttpStatusCode.InternalServerError);

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("Forbidden here");
        }

        [Fact]
        public async Task TurnOn_Unauthorized_IsTokenInvalidWithoutARepositoryRead()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.Unauthorized, new { message = "Bad credentials" });

            var outcome = await TurnOn(Repo(new GithubWebhook { Id = 7 }));

            outcome.Code.Should().Be(WebhookCodes.TokenInvalid);
            _github.Calls.Should().ContainSingle();
        }

        // C6, example 6: a timeout is a failure and changes nothing stored.
        [Fact]
        public async Task TurnOn_Timeout_IsUnreachableAndStoresNothing()
        {
            SetupUserToken();
            _github.NoAnswer("PATCH /repos/org/repo/hooks/9");
            var repo = Repo(new GithubWebhook { Id = 9, Active = false });

            var outcome = await TurnOn(repo);

            outcome.Code.Should().Be(WebhookCodes.Unreachable);
            repo.GithubWebhook.Active.Should().BeFalse();
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
            _repoRepo.Verify(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task TurnOn_OtherStatus_FailsWithGithubsFirstErrorMessage()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.UnprocessableEntity,
                new { message = "Validation Failed", errors = new[] { new { message = "Config url is not supported" } } });

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("Config url is not supported");
        }

        [Theory]
        [InlineData("")]
        [InlineData("<html>Bad gateway</html>")]
        [InlineData("{\"errors\":[\"a plain string\"]}")]
        public async Task TurnOn_UnreadableErrorBody_FailsWithTheStatusInsteadOfThrowing(string body)
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", new HttpCallResult(HttpStatusCode.BadGateway, body));

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("HTTP 502");
        }

        // H11: no refusal is based on permissions.admin; a non-admin with "Manage webhooks" just succeeds.
        [Fact]
        public async Task TurnOn_SucceedsWithoutEverReadingPermissionsFirst()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.Created, Hook(5, HookUrl, active: true));

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeTrue();
            _github.RepositoryReads.Should().Be(0);
        }

        // C11, P4: the worst turn-on path is 3 webhook calls and 1 repository read.
        [Fact]
        public async Task TurnOn_WorstCase_StaysWithinThreeWebhookCallsAndOneRead()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.OK, Array.Empty<object>())
                   .On("POST /repos/org/repo/hooks", HttpStatusCode.Forbidden, new { message = "nope" })
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: false));

            var outcome = await TurnOn(Repo(new GithubWebhook { Id = 7 }));

            outcome.Code.Should().Be(WebhookCodes.Permission);
            _github.WebhookCalls.Should().Be(3);
            _github.RepositoryReads.Should().Be(1);
        }

        [Fact]
        public async Task TurnOn_ListRefused_IsExplainedByTheRepositoryRead()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo/hooks?per_page=100", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: false));

            var outcome = await TurnOn(Repo(new GithubWebhook { Id = 7 }));

            outcome.Code.Should().Be(WebhookCodes.Permission);
        }

        [Fact]
        public async Task TurnOn_UnexpectedFailure_IsAFailedChangeWithoutAnExceptionMessage()
        {
            SetupUserToken();
            _http.Setup(h => h.SendWithTimeoutAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<HttpMethod>(),
                    It.IsAny<object>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
                .ThrowsAsync(new InvalidOperationException("internal detail"));

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("Unexpected error");
        }

        // C16: the token and the webhook secret never reach a log line.
        [Fact]
        public async Task TurnOn_NeverLogsTheTokenOrTheSecret()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.UnprocessableEntity, new { message = "whsecret tok-user-7" });

            await TurnOn(Repo());

            _logger.AllText.Should().NotContain("tok-user-7").And.NotContain("whsecret");
        }

        // ---- SetActiveAsync(false) ----

        [Fact]
        public async Task TurnOff_NoStoredHook_SucceedsWithoutAnyCallOrTokenRead()
        {
            var outcome = await TurnOff(Repo());

            outcome.Ok.Should().BeTrue();
            _github.Calls.Should().BeEmpty();
            _tokenRepo.Verify(t => t.getToken(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task TurnOff_WithoutAToken_FailsNotConnected()
        {
            var outcome = await TurnOff(Repo(new GithubWebhook { Id = 7, Active = true }));

            outcome.Code.Should().Be(WebhookCodes.NotConnected);
            _github.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task TurnOff_PatchOk_StoresInactive()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.OK, Hook(7, HookUrl));
            var repo = Repo(new GithubWebhook { Id = 7, Active = true });

            var outcome = await TurnOff(repo);

            outcome.Ok.Should().BeTrue();
            _github.Calls.Single().Payload.Should().BeEquivalentTo(new { active = false });
            repo.GithubWebhook.Active.Should().BeFalse();
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive("repo-1", false), Times.Once);
        }

        // Example 3: refused for a non-admin; the hook stays active, stored and on GitHub.
        [Fact]
        public async Task TurnOff_RefusedForANonAdmin_KeepsTheHookActive()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: false));
            var repo = Repo(new GithubWebhook { Id = 7, Active = true });

            var outcome = await TurnOff(repo);

            outcome.Code.Should().Be(WebhookCodes.Permission);
            repo.GithubWebhook.Active.Should().BeTrue();
            _github.Calls.Should().HaveCount(2);
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive(It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
        }

        [Fact]
        public async Task TurnOff_NotFoundForAnAdmin_MeansTheHookIsGone_AndStoresInactive()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.NotFound)
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: true));

            var outcome = await TurnOff(Repo(new GithubWebhook { Id = 7, Active = true }));

            outcome.Ok.Should().BeTrue();
            _repoRepo.Verify(r => r.UpdateRepoGithubWebhookActive("repo-1", false), Times.Once);
        }

        [Fact]
        public async Task TurnOff_ForbiddenForAnAdmin_IsAFailureWithGithubsMessage()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.Forbidden, new { message = "SAML" })
                   .On("GET /repos/org/repo", HttpStatusCode.OK, Permissions(admin: true));

            var outcome = await TurnOff(Repo(new GithubWebhook { Id = 7, Active = true }));

            outcome.Code.Should().Be(WebhookCodes.Failed);
            outcome.Detail.Should().Be("SAML");
        }

        [Fact]
        public async Task TurnOff_UnauthorizedOrTimeoutOrOther_AreFailuresWithoutARead()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/1", HttpStatusCode.Unauthorized)
                   .NoAnswer("PATCH /repos/org/repo/hooks/2")
                   .On("PATCH /repos/org/repo/hooks/3", HttpStatusCode.InternalServerError, new { message = "oops" });

            (await TurnOff(Repo(new GithubWebhook { Id = 1, Active = true }))).Code.Should().Be(WebhookCodes.TokenInvalid);
            (await TurnOff(Repo(new GithubWebhook { Id = 2, Active = true }))).Code.Should().Be(WebhookCodes.Unreachable);
            var other = await TurnOff(Repo(new GithubWebhook { Id = 3, Active = true }));
            other.Code.Should().Be(WebhookCodes.Failed);
            other.Detail.Should().Be("oops");
            _github.RepositoryReads.Should().Be(0);
        }

        [Fact]
        public async Task SetActive_ASavedHookThatIsNotStored_StillSucceedsAndIsLogged()
        {
            SetupUserToken();
            _github.On("PATCH /repos/org/repo/hooks/7", HttpStatusCode.OK, Hook(7, HookUrl));
            _repoRepo.Setup(r => r.UpdateRepoGithubWebhookActive("repo-1", false)).ReturnsAsync(false);

            var outcome = await TurnOff(Repo(new GithubWebhook { Id = 7, Active = true }));

            outcome.Ok.Should().BeTrue();
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Warning && e.Message.Contains("could not be saved"));
        }

        [Fact]
        public async Task TurnOn_CreatedHookThatIsNotStored_StillSucceedsAndIsLogged()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", HttpStatusCode.Created, Hook(42, HookUrl, active: true));
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<Repo>(), It.IsAny<string>())).ReturnsAsync(false);

            var outcome = await TurnOn(Repo());

            outcome.Ok.Should().BeTrue();
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Warning && e.Message.Contains("could not be saved"));
        }

        [Fact]
        public async Task TurnOn_CreatedWithAnUnreadableBody_IsAFailure()
        {
            SetupUserToken();
            _github.On("POST /repos/org/repo/hooks", new HttpCallResult(HttpStatusCode.Created, string.Empty));

            var outcome = await TurnOn(Repo());

            outcome.Code.Should().Be(WebhookCodes.Failed);
        }
    }
}
