using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers
{
    public class RepoSecretControllerTests
    {
        private const string RepoId = "repo-1";
        private const string SecretId = "secret-1";
        private const string ManagePermission = "blocks-release::repo-secret::manage";

        private readonly Mock<IRepoSecretService> _service = new();

        private RepoSecretController CreateController() =>
            new(_service.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
            };

        private static BaseApiResponse Body(IActionResult result) =>
            ((OkObjectResult)result).Value.Should().BeOfType<BaseApiResponse>().Subject;

        // ---- Envelopes ----

        [Fact]
        public async Task Save_ReturnsTheSaveResultInTheStandardEnvelope()
        {
            var expected = new RepoSecretSaveResponse { RepoId = RepoId, SecretId = SecretId, KeyCount = 2, Created = true };
            _service.Setup(s => s.SaveAsync(It.IsAny<RepoSecretSaveRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(expected);

            var body = Body(await CreateController().Save(
                new RepoSecretSaveRequest { RepoId = RepoId, Secrets = JsonSerializer.Deserialize<JsonElement>("""{"A":"b"}""") },
                CancellationToken.None));

            body.IsSuccess.Should().BeTrue();
            body.StatusCode.Should().Be(HttpStatusCode.OK);
            body.Data.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Get_ReturnsTheMetadataInTheStandardEnvelope()
        {
            var expected = new RepoSecretMetaResponse { RepoId = RepoId, HasSecrets = false };
            _service.Setup(s => s.GetMetaAsync(RepoId, It.IsAny<CancellationToken>())).ReturnsAsync(expected);

            Body(await CreateController().Get(RepoId, CancellationToken.None)).Data.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Value_ReturnsTheSecretsAndForbidsCaching()
        {
            var expected = new RepoSecretValueResponse
            {
                RepoId = RepoId,
                SecretId = SecretId,
                Secrets = new Dictionary<string, string> { ["A"] = "b" }
            };
            _service.Setup(s => s.GetValueAsync(RepoId, It.IsAny<CancellationToken>())).ReturnsAsync(expected);

            var controller = CreateController();
            var body = Body(await controller.Value(RepoId, CancellationToken.None));

            body.Data.Should().BeSameAs(expected);

            // The body carries plaintext, so it must not be cacheable anywhere between here and
            // the browser.
            controller.Response.Headers.CacheControl.ToString().Should().Be("no-store, no-cache, must-revalidate");
            controller.Response.Headers.Pragma.ToString().Should().Be("no-cache");
        }

        [Fact]
        public async Task Audit_PassesTheRepositoryIdAndFilterThrough()
        {
            var filter = new SecretAuditFilter { PageNumber = 2, PageSize = 5 };
            var expected = new SecretAuditListResult { TotalCount = 7 };
            _service.Setup(s => s.GetAuditLogsAsync(RepoId, filter, It.IsAny<CancellationToken>())).ReturnsAsync(expected);

            Body(await CreateController().Audit(RepoId, filter, CancellationToken.None)).Data.Should().BeSameAs(expected);
        }

        // ---- Lifecycle actions delegate and report success ----

        [Fact]
        public async Task Lock_DelegatesAndReportsSuccess()
        {
            var body = Body(await CreateController().Lock(new RepoSecretIdRequest { RepoId = RepoId }, CancellationToken.None));

            body.IsSuccess.Should().BeTrue();
            _service.Verify(s => s.LockAsync(RepoId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Unlock_DelegatesAndReportsSuccess()
        {
            Body(await CreateController().Unlock(new RepoSecretIdRequest { RepoId = RepoId }, CancellationToken.None))
                .IsSuccess.Should().BeTrue();

            _service.Verify(s => s.UnlockAsync(RepoId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Delete_DelegatesAndReportsSuccess()
        {
            Body(await CreateController().Delete(RepoId, CancellationToken.None)).IsSuccess.Should().BeTrue();

            _service.Verify(s => s.DeleteAsync(RepoId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Restore_DelegatesAndReportsSuccess()
        {
            Body(await CreateController().Restore(new RepoSecretIdRequest { RepoId = RepoId }, CancellationToken.None))
                .IsSuccess.Should().BeTrue();

            _service.Verify(s => s.RestoreAsync(RepoId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(nameof(RepoSecretController.Lock))]
        [InlineData(nameof(RepoSecretController.Unlock))]
        [InlineData(nameof(RepoSecretController.Restore))]
        public async Task LifecycleActions_NullBody_Throw(string actionName)
        {
            var controller = CreateController();

            Func<Task> act = actionName switch
            {
                nameof(RepoSecretController.Lock) => () => controller.Lock(null, CancellationToken.None),
                nameof(RepoSecretController.Unlock) => () => controller.Unlock(null, CancellationToken.None),
                _ => () => controller.Restore(null, CancellationToken.None)
            };

            await act.Should().ThrowAsync<ArgumentNullException>();
        }

        // ---- Permissions ----

        /// <summary>
        /// Every action requires an authenticated caller and none opts out. Asserted by reflection
        /// so a new action cannot be added unauthenticated.
        /// </summary>
        /// <remarks>
        /// The finer-grained <c>ProtectedEndPoint("blocks-release::repo-secret::manage")</c> gate is
        /// currently commented out on the controller because the permission is not yet provisioned
        /// in the IDP; enabling it would 403 every real caller. When it is re-enabled the resource
        /// string is still checked below, so a typo cannot slip in with it.
        /// </remarks>
        [Fact]
        public void EveryAction_RequiresAnAuthenticatedCaller()
        {
            var actions = typeof(RepoSecretController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName)
                .ToList();

            actions.Should().HaveCount(8);

            foreach (var action in actions)
            {
                action.GetCustomAttributes<AuthorizeAttribute>(inherit: true)
                    .Should().NotBeEmpty($"{action.Name} must require an authenticated caller");
                action.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true)
                    .Should().BeEmpty($"{action.Name} must not opt out of authentication");

                var permission = action.GetCustomAttribute<ProtectedEndPointAttribute>();
                if (permission is not null)
                {
                    permission.ResourceName.Should()
                        .Be(ManagePermission, $"{action.Name} must use the manage permission");
                }
            }

            typeof(RepoSecretController).GetCustomAttributes<AllowAnonymousAttribute>(inherit: true)
                .Should().BeEmpty("the controller must not open every action to anonymous callers");
        }
    }
}
