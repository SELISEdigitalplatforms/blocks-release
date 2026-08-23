using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class RepoSecretServiceTests : IDisposable
    {
        private const string RepoId = "repo-item-1";
        private const string SecretId = "secret-item-1";
        private const string TenantId = "tenant-1";

        private readonly Mock<IRepoRepository> _repos = new();
        private readonly Mock<ISecretService> _secrets = new(MockBehavior.Strict);

        public RepoSecretServiceTests()
        {
            BlocksContext.SetContext(BlocksContext.Create(
                TenantId, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "user",
                "phone", "display", "oauth", TenantId));
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
            GC.SuppressFinalize(this);
        }

        private RepoSecretService CreateService() =>
            new(_repos.Object, _secrets.Object, new Mock<ILogger<RepoSecretService>>().Object);

        private void HaveRepo(string secretStoreItemId = null) =>
            _repos.Setup(r => r.GetRepo(RepoId, It.IsAny<string>())).ReturnsAsync(new Repo
            {
                ItemId = RepoId,
                RepoName = "acme/api",
                SecretStoreItemId = secretStoreItemId
            });

        /// <summary>
        /// Round-trips through the serializer so the element owns its own buffer - a JsonDocument's
        /// RootElement would be invalid once the document was disposed.
        /// </summary>
        private static JsonElement Json(string json) => JsonSerializer.Deserialize<JsonElement>(json);

        private static RepoSecretSaveRequest SaveRequest(string secretsJson, string repoId = RepoId) =>
            new() { RepoId = repoId, Secrets = Json(secretsJson) };

        // ---- tenant scoping ----

        /// <summary>
        /// Every read resolves the repository through the context tenant, the same one the
        /// SecretStoreItemId stamp and the secret itself are keyed on.
        /// </summary>
        /// <remarks>
        /// The parameterless GetRepo overload resolves the database from the request instead, and
        /// under impersonation that is a different tenant than the token carries. Reading the
        /// repository from one database while stamping it in another makes the pointer read back
        /// as absent: saves retry the create path and fail NAME_TAKEN against the secret the
        /// repository already owns, and the metadata call reports no secrets for a live one.
        /// </remarks>
        [Fact]
        public async Task Reads_ResolveTheRepositoryThroughTheContextTenant()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.GetAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new SecretResult { SecretId = SecretId, Name = $"repo-{RepoId}", Status = SecretStatuses.Active });

            await CreateService().GetMetaAsync(RepoId);

            _repos.Verify(r => r.GetRepo(RepoId, TenantId), Times.Once);
            _repos.Verify(r => r.GetRepo(It.IsAny<string>()), Times.Never);
        }

        // ---- H1: create path ----

        [Fact]
        public async Task Save_NoExistingSecret_CreatesAndStampsTheRepository()
        {
            HaveRepo();
            SetSecretRequest captured = null;

            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<SetSecretRequest, CancellationToken>((r, _) => captured = r)
                    .ReturnsAsync(SecretId);
            _repos.Setup(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId)).ReturnsAsync(true);

            var result = await CreateService().SaveAsync(SaveRequest("""{"DB_PASSWORD":"p@ss","API_KEY":"abc"}"""));

            result.Created.Should().BeTrue();
            result.SecretId.Should().Be(SecretId);
            result.KeyCount.Should().Be(2);
            result.RepoId.Should().Be(RepoId);

            captured.Name.Should().Be($"repo-{RepoId}");
            captured.Type.Should().Be(SecretTypes.Service);
            captured.Description.Should().Be("acme/api");
            captured.Value.Should().Be("""{"DB_PASSWORD":"p@ss","API_KEY":"abc"}""");

            _repos.Verify(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId), Times.Once);
        }

        // ---- H2: replace path ----

        [Fact]
        public async Task Save_ExistingSecret_RotatesAndNeverCreatesASecondSecret()
        {
            HaveRepo(SecretId);
            RotateSecretRequest captured = null;

            _secrets.Setup(s => s.RotateAsync(SecretId, It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<string, RotateSecretRequest, CancellationToken>((_, r, _) => captured = r)
                    .Returns(Task.CompletedTask);

            var result = await CreateService().SaveAsync(SaveRequest("""{"DB_PASSWORD":"new"}"""));

            result.Created.Should().BeFalse();
            result.SecretId.Should().Be(SecretId);
            result.KeyCount.Should().Be(1);
            captured.Value.Should().Be("""{"DB_PASSWORD":"new"}""");

            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _repos.Verify(r => r.UpdateRepoSecretStoreItemId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // ---- H3: value read ----

        [Fact]
        public async Task GetValue_DeserializesTheStoredSetBackToAMap()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.GetValueAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ReturnsAsync("""{"DB_PASSWORD":"p@ss","EMPTY":""}""");

            var result = await CreateService().GetValueAsync(RepoId);

            result.SecretId.Should().Be(SecretId);
            result.Secrets.Should().BeEquivalentTo(new Dictionary<string, string>
            {
                ["DB_PASSWORD"] = "p@ss",
                ["EMPTY"] = string.Empty
            });
        }

        // ---- H4: first-run metadata ----

        [Fact]
        public async Task GetMeta_RepositoryWithoutASecret_ReportsHasSecretsFalseAndTouchesNoSecretService()
        {
            HaveRepo();

            var result = await CreateService().GetMetaAsync(RepoId);

            result.HasSecrets.Should().BeFalse();
            result.SecretId.Should().BeNull();
            result.RepoId.Should().Be(RepoId);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetMeta_RepositoryWithASecret_ProjectsTheMetadata()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.GetAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new SecretResult
                    {
                        SecretId = SecretId,
                        Name = $"repo-{RepoId}",
                        Status = SecretStatuses.Active,
                        RotationCount = 3
                    });

            var result = await CreateService().GetMetaAsync(RepoId);

            result.HasSecrets.Should().BeTrue();
            result.Status.Should().Be(SecretStatuses.Active);
            result.RotationCount.Should().Be(3);
        }

        /// <summary>A stale pointer degrades to "no secrets" rather than failing the whole screen.</summary>
        [Fact]
        public async Task GetMeta_PointerToAMissingSecret_ReportsHasSecretsFalse()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.GetAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ReturnsAsync((SecretResult)null);

            (await CreateService().GetMetaAsync(RepoId)).HasSecrets.Should().BeFalse();
        }

        // ---- H5 / H6: lifecycle ----

        [Fact]
        public async Task Lifecycle_ResolvesTheSecretIdFromTheRepository()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.LockAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _secrets.Setup(s => s.UnlockAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _secrets.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _secrets.Setup(s => s.RestoreAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();
            await service.LockAsync(RepoId);
            await service.UnlockAsync(RepoId);
            await service.DeleteAsync(RepoId);
            await service.RestoreAsync(RepoId);

            _secrets.Verify(s => s.LockAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.UnlockAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RestoreAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
        }

        /// <summary>H6 - the pointer must survive a delete so a restore can still reach the secret.</summary>
        [Fact]
        public async Task Delete_LeavesTheRepositoryPointerInPlace()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            await CreateService().DeleteAsync(RepoId);

            _repos.Verify(
                r => r.UpdateRepoSecretStoreItemId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        // ---- H7 / C4: the caller never chooses the secret id ----

        [Fact]
        public async Task GetAuditLogs_OverwritesAnyCallerSuppliedSecretId()
        {
            HaveRepo(SecretId);
            SecretAuditFilter captured = null;

            _secrets.Setup(s => s.GetAuditLogsAsync(It.IsAny<SecretAuditFilter>(), It.IsAny<CancellationToken>()))
                    .Callback<SecretAuditFilter, CancellationToken>((f, _) => captured = f)
                    .ReturnsAsync(new SecretAuditListResult());

            await CreateService().GetAuditLogsAsync(RepoId, new SecretAuditFilter { SecretId = "someone-elses-secret" });

            captured.SecretId.Should().Be(SecretId);
        }

        [Fact]
        public async Task GetAuditLogs_NullFilter_StillScopesToTheRepositorysSecret()
        {
            HaveRepo(SecretId);
            SecretAuditFilter captured = null;

            _secrets.Setup(s => s.GetAuditLogsAsync(It.IsAny<SecretAuditFilter>(), It.IsAny<CancellationToken>()))
                    .Callback<SecretAuditFilter, CancellationToken>((f, _) => captured = f)
                    .ReturnsAsync(new SecretAuditListResult());

            await CreateService().GetAuditLogsAsync(RepoId, null);

            captured.SecretId.Should().Be(SecretId);
        }

        // ---- C1: payload validation ----

        [Theory]
        [InlineData("""{"db-password":"x"}""", "SECRET_KEY_INVALID")]          // hyphen
        [InlineData("""{"1DB":"x"}""", "SECRET_KEY_INVALID")]                  // leading digit
        [InlineData("""{"":"x"}""", "SECRET_KEY_INVALID")]                     // empty key
        [InlineData("""{"DB":1}""", "SECRET_VALUE_TYPE")]                      // numeric value
        [InlineData("""{"DB":{"host":"x"}}""", "SECRET_VALUE_TYPE")]           // nested object
        [InlineData("""{"DB":["x"]}""", "SECRET_VALUE_TYPE")]                  // array value
        [InlineData("""{"DB":null}""", "SECRET_VALUE_TYPE")]                   // null value
        [InlineData("{}", "SECRETS_REQUIRED")]                                 // empty set
        [InlineData("[]", "SECRETS_REQUIRED")]                                 // not an object
        [InlineData("null", "SECRETS_REQUIRED")]                               // explicit null
        [InlineData("""{"DB":"x","DB":"y"}""", "SECRET_KEY_INVALID")]          // duplicate key
        public async Task Save_InvalidPayload_IsRejectedBeforeAnySecretServiceCall(string secretsJson, string expectedReason)
        {
            HaveRepo();

            var act = () => CreateService().SaveAsync(SaveRequest(secretsJson));

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be(expectedReason);

            // Strict mock: any ISecretService call at all would already have failed the test, but
            // assert it explicitly so the intent survives a change of mock behaviour.
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_MissingSecretsProperty_IsRejected()
        {
            HaveRepo();

            var act = () => CreateService().SaveAsync(new RepoSecretSaveRequest { RepoId = RepoId });

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("SECRETS_REQUIRED");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task Save_MissingRepoId_IsRejected(string repoId)
        {
            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}""", repoId));

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("REPO_ID_REQUIRED");
        }

        [Fact]
        public async Task Save_KeyLongerThan128Characters_IsRejected()
        {
            HaveRepo();
            var key = new string('A', 129);

            var act = () => CreateService().SaveAsync(SaveRequest($$"""{"{{key}}":"x"}"""));

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("SECRET_KEY_INVALID");
        }

        // ---- C2: size boundary ----

        [Fact]
        public async Task Save_PayloadOverTheVaultLimit_IsRejectedBeforeTheVaultIsContacted()
        {
            HaveRepo();

            // {"K":"<value>"} - 10 characters of envelope around the value.
            var value = new string('x', SecretDefaults.MaxValueLengthBytes);

            var act = () => CreateService().SaveAsync(SaveRequest($$"""{"K":"{{value}}"}"""));

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("SECRET_SET_TOO_LARGE");

            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_PayloadExactlyAtTheLimit_IsAccepted()
        {
            HaveRepo();

            var envelope = Encoding.UTF8.GetByteCount("""{"K":""}""");
            var value = new string('x', SecretDefaults.MaxValueLengthBytes - envelope);

            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SecretId);
            _repos.Setup(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId)).ReturnsAsync(true);

            var result = await CreateService().SaveAsync(SaveRequest($$"""{"K":"{{value}}"}"""));

            result.Created.Should().BeTrue();
        }

        // ---- C3: compensation ----

        [Fact]
        public async Task Save_RepositoryStampFails_DeletesTheOrphanedSecretAndSurfacesTheError()
        {
            HaveRepo();
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SecretId);
            _repos.Setup(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId)).ReturnsAsync(false);
            _secrets.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}"""));

            await act.Should().ThrowAsync<InvalidOperationException>();
            _secrets.Verify(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Save_RepositoryStampThrows_StillCompensates()
        {
            HaveRepo();
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SecretId);
            _repos.Setup(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId))
                  .ThrowsAsync(new TimeoutException("mongo down"));
            _secrets.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}"""));

            await act.Should().ThrowAsync<TimeoutException>();
            _secrets.Verify(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()), Times.Once);
        }

        /// <summary>Both halves failing must still surface the original cause, not the cleanup's.</summary>
        [Fact]
        public async Task Save_CompensationAlsoFails_SurfacesTheOriginalFailure()
        {
            HaveRepo();
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SecretId);
            _repos.Setup(r => r.UpdateRepoSecretStoreItemId(RepoId, SecretId, TenantId))
                  .ThrowsAsync(new TimeoutException("mongo down"));
            _secrets.Setup(s => s.DeleteAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("vault down", "Delete", SecretId));

            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}"""));

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task Save_VaultWriteFails_LeavesTheRepositoryUntouched()
        {
            HaveRepo();
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("vault down", "Set", SecretId));

            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}"""));

            await act.Should().ThrowAsync<SecretVaultException>();
            _repos.Verify(
                r => r.UpdateRepoSecretStoreItemId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        // ---- C5 / C6: not-found parity ----

        [Fact]
        public async Task AnyOperation_UnknownOrArchivedRepository_IsNotFound()
        {
            _repos.Setup(r => r.GetRepo(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync((Repo)null);
            var service = CreateService();

            await service.Invoking(s => s.GetMetaAsync(RepoId)).Should().ThrowAsync<SecretNotFoundException>();
            await service.Invoking(s => s.GetValueAsync(RepoId)).Should().ThrowAsync<SecretNotFoundException>();
            await service.Invoking(s => s.LockAsync(RepoId)).Should().ThrowAsync<SecretNotFoundException>();
            await service.Invoking(s => s.DeleteAsync(RepoId)).Should().ThrowAsync<SecretNotFoundException>();
            await service.Invoking(s => s.SaveAsync(SaveRequest("""{"DB":"x"}"""))).Should().ThrowAsync<SecretNotFoundException>();
        }

        [Fact]
        public async Task ValueAndLifecycle_RepositoryWithoutASecret_ReportNoSecretForRepo()
        {
            HaveRepo();
            var service = CreateService();

            foreach (var act in new Func<Task>[]
                     {
                         () => service.GetValueAsync(RepoId),
                         () => service.LockAsync(RepoId),
                         () => service.UnlockAsync(RepoId),
                         () => service.DeleteAsync(RepoId),
                         () => service.RestoreAsync(RepoId),
                         () => service.GetAuditLogsAsync(RepoId, new SecretAuditFilter())
                     })
            {
                (await act.Should().ThrowAsync<SecretNotFoundException>())
                    .Which.ReasonCode.Should().Be("NO_SECRET_FOR_REPO");
            }
        }

        // ---- Context ----

        [Fact]
        public async Task Save_ContextWithoutATenant_IsRefusedBeforeTheRepositoryIsStamped()
        {
            BlocksContext.SetContext(BlocksContext.Create(
                null, new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "user",
                "phone", "display", "oauth", null));

            HaveRepo();
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SecretId);

            var act = () => CreateService().SaveAsync(SaveRequest("""{"DB":"x"}"""));

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
            _repos.Verify(
                r => r.UpdateRepoSecretStoreItemId(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        // ---- Stored payload defence ----

        [Fact]
        public async Task GetValue_StoredValueIsNotAJsonObject_SurfacesAReadableFailure()
        {
            HaveRepo(SecretId);
            _secrets.Setup(s => s.GetValueAsync(SecretId, It.IsAny<CancellationToken>()))
                    .ReturnsAsync("not json at all");

            var act = () => CreateService().GetValueAsync(RepoId);

            (await act.Should().ThrowAsync<SecretValidationException>())
                .Which.ReasonCode.Should().Be("SECRET_SET_UNREADABLE");
        }
    }
}
