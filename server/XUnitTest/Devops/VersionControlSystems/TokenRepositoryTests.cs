using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.TokenStore;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.TestDoubles;

namespace XUnitTest.Devops.VersionControlSystems
{
    /// <summary>
    /// Unit tests for <see cref="TokenRepository"/>. The access token is upserted against the
    /// calling user, so the three outcomes the driver can report (inserted, modified, unchanged)
    /// all have to read as success, while an unacknowledged or failed write must read as failure.
    /// </summary>
    public class TokenRepositoryTests : IDisposable
    {
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<IMongoDatabase> _db = new();
        private readonly Mock<IMongoCollection<RepositoryToken>> _tokens = new();
        private readonly FakeSecretValueStore _store = new();
        private readonly ListLogger<TokenRepository> _logger = new();
        private readonly Mock<IBlocksSecret> _secret = new();
        private readonly TokenRepository _sut;

        public TokenRepositoryTests()
        {
            BlocksContext.IsTestMode = true;
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-b", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-b"));

            _secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");
            _provider.Setup(p => p.GetDatabase("mongodb://localhost", "BlocksRootDb")).Returns(_db.Object);
            _db.Setup(d => d.GetCollection<RepositoryToken>("RepositoryTokens", null)).Returns(_tokens.Object);

            SetupStoredRow(null);
            _sut = GithubTokenStoreTestSupport.CreateRepository(_provider.Object, _secret.Object, _logger, _store);
        }

        /// <summary>What a find by the context user returns: the user's stored row, or none.</summary>
        private void SetupStoredRow(RepositoryToken? row) =>
            _tokens.Setup(c => c.FindAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<FindOptions<RepositoryToken, RepositoryToken>>(),
                       It.IsAny<CancellationToken>()))
                   .ReturnsAsync(() => new ListCursor<RepositoryToken>(row is null ? [] : [row]));

        public void Dispose()
        {
            BlocksContext.SetContext(null);
            BlocksContext.IsTestMode = false;
        }

        private void SetupReplace(ReplaceOneResult result) =>
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .ReturnsAsync(result);

        [Fact]
        public async Task SaveToken_ReportsSuccessWhenTheTokenIsNewlyInserted()
        {
            SetupReplace(new ReplaceOneResult.Acknowledged(0, 0, BsonValue.Create("user-1")));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsSuccessWhenAnExistingTokenIsReplaced()
        {
            SetupReplace(new ReplaceOneResult.Acknowledged(1, 1, null));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsSuccessWhenTheStoredTokenIsAlreadyUpToDate()
        {
            // Re-authorising with the same token modifies nothing, and that is still a success.
            SetupReplace(new ReplaceOneResult.Acknowledged(1, 0, null));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_UpsertsSoAFirstTimeAuthorisationDoesNotNeedAnExistingRow()
        {
            ReplaceOptions options = null;
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .Callback<FilterDefinition<RepositoryToken>, RepositoryToken, ReplaceOptions, CancellationToken>(
                       (_, _, o, _) => options = o)
                   .ReturnsAsync(new ReplaceOneResult.Acknowledged(1, 1, null));

            await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" });

            options.IsUpsert.Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsFailureWhenTheWriteIsNotAcknowledged()
        {
            SetupReplace(ReplaceOneResult.Unacknowledged.Instance);

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeFalse();
        }

        [Fact]
        public async Task SaveToken_ReportsFailureRatherThanThrowingWhenMongoIsUnreachable()
        {
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new TimeoutException("mongo unreachable"));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeFalse();
        }
    
        // ---- Key Vault storage (spec #230) ----

        private const string ExistingId = "github-token-0123456789abcdef0123456789abcdef";

        /// <summary>Captures what MongoDB would have stored, as raw BSON, at the moment of the write.</summary>
        private List<BsonDocument> CaptureReplace(ReplaceOneResult result)
        {
            var written = new List<BsonDocument>();
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .Callback<FilterDefinition<RepositoryToken>, RepositoryToken, ReplaceOptions, CancellationToken>(
                       (_, doc, _, _) => written.Add(doc.ToBsonDocument()))
                   .ReturnsAsync(result);
            return written;
        }

        private void FailReplace() =>
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new TimeoutException("mongo unreachable"));

        private void VerifyNoMongoAccess()
        {
            _tokens.Verify(c => c.ReplaceOneAsync(
                It.IsAny<FilterDefinition<RepositoryToken>>(),
                It.IsAny<RepositoryToken>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
            _tokens.Verify(c => c.FindAsync(
                It.IsAny<FilterDefinition<RepositoryToken>>(),
                It.IsAny<FindOptions<RepositoryToken, RepositoryToken>>(),
                It.IsAny<CancellationToken>()), Times.Never);
            _tokens.Verify(c => c.FindOneAndDeleteAsync(
                It.IsAny<FilterDefinition<RepositoryToken>>(),
                It.IsAny<FindOneAndDeleteOptions<RepositoryToken, RepositoryToken>>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        private void VerifyNoMongoWrite() =>
            _tokens.Verify(c => c.ReplaceOneAsync(
                It.IsAny<FilterDefinition<RepositoryToken>>(),
                It.IsAny<RepositoryToken>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);

        [Fact]
        public async Task SaveTokenFirstConnectWritesVaultUnderNewIdAndPersistsNoAccessToken()
        {
            // H1
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(0, 0, BsonValue.Create("user-1")));
            var token = new RepositoryToken { ItemId = "row-1", BlocksUserId = "user-1", AccessToken = "gho_abc" };

            (await _sut.saveToken(token)).Should().BeTrue();

            token.TokenSecretId.Should().MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Calls.Should().Equal(("set", token.TokenSecretId));
            _store.Values[token.TokenSecretId!].Should().Be("gho_abc");
            written.Should().ContainSingle();
            written[0].Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
            written[0][nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(token.TokenSecretId);
            // The caller keeps the token it saved; only the stored row drops it.
            token.AccessToken.Should().Be("gho_abc");
        }

        [Fact]
        public async Task SaveTokenWritesTheVaultBeforeMongo()
        {
            var vaultWritesSeenByMongo = -1;
            _tokens.Setup(c => c.ReplaceOneAsync(
                       It.IsAny<FilterDefinition<RepositoryToken>>(),
                       It.IsAny<RepositoryToken>(),
                       It.IsAny<ReplaceOptions>(),
                       It.IsAny<CancellationToken>()))
                   .Callback(() => vaultWritesSeenByMongo = _store.CallsTo("set").Count)
                   .ReturnsAsync(new ReplaceOneResult.Acknowledged(1, 1, null));

            await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" });

            vaultWritesSeenByMongo.Should().Be(1);
        }

        [Fact]
        public async Task SaveTokenReconnectReusesTheStoredRowsSecretId()
        {
            // H2
            _store.Values[ExistingId] = "gho_old";
            SetupStoredRow(new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = ExistingId });
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(1, 1, null));
            var token = new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = ExistingId, AccessToken = "gho_new" };

            (await _sut.saveToken(token)).Should().BeTrue();

            token.TokenSecretId.Should().Be(ExistingId);
            _store.CallsTo("set").Should().Equal(ExistingId);
            _store.Values[ExistingId].Should().Be("gho_new");
            written[0][nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(ExistingId);
            written[0].Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
        }

        [Fact]
        public async Task SaveTokenIgnoresASecretIdCarriedByTheCallersObject()
        {
            // The pointer comes from the context user's stored row only: a foreign id on the
            // passed object is never written to, and is replaced on the saved row.
            const string foreignId = "github-token-ffffffffffffffffffffffffffffffff";
            _store.Values[foreignId] = "someone_elses_token";
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(0, 0, BsonValue.Create("user-1")));
            var token = new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = foreignId, AccessToken = "gho_mine" };

            (await _sut.saveToken(token)).Should().BeTrue();

            _store.Values[foreignId].Should().Be("someone_elses_token");
            _store.Calls.Should().NotContain(c => c.SecretId == foreignId);
            token.TokenSecretId.Should().NotBe(foreignId).And.MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            written[0][nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(token.TokenSecretId);
        }

        [Fact]
        public async Task SaveTokenReconnectWithMissingVaultValueCreatesANewSecretId()
        {
            // The stored pointer's value is gone (404, e.g. soft-deleted): Set on that name would be
            // refused until purge, so a new id is created instead.
            SetupStoredRow(new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = ExistingId });
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(1, 1, null));
            var token = new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_new" };

            (await _sut.saveToken(token)).Should().BeTrue();

            _store.CallsTo("set").Should().NotContain(ExistingId);
            token.TokenSecretId.Should().NotBe(ExistingId).And.MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Values[token.TokenSecretId!].Should().Be("gho_new");
            written[0][nameof(RepositoryToken.TokenSecretId)].AsString.Should().Be(token.TokenSecretId);
        }

        [Fact]
        public async Task SaveTokenOnLegacyRowMovesTheTokenToTheVaultAndDropsThePlaintextField()
        {
            // H3
            SetupStoredRow(new RepositoryToken { ItemId = "row-1", BlocksUserId = "user-1", AccessToken = "gho_old" });
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(1, 1, null));
            var legacy = new RepositoryToken { ItemId = "row-1", BlocksUserId = "user-1", AccessToken = "gho_renewed" };

            (await _sut.saveToken(legacy)).Should().BeTrue();

            legacy.TokenSecretId.Should().MatchRegex(GithubTokenStoreTestSupport.SecretIdPattern);
            _store.Values[legacy.TokenSecretId!].Should().Be("gho_renewed");
            written[0].Contains(nameof(RepositoryToken.AccessToken)).Should().BeFalse();
        }

        [Fact]
        public async Task SaveTokenVaultWriteFailureWritesNothingToMongoAndPropagates()
        {
            // C2
            _store.Fail("set");
            var token = new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" };

            var act = () => _sut.saveToken(token);

            await act.Should().ThrowAsync<GithubTokenStoreException>();
            VerifyNoMongoWrite();
            _store.Values.Should().BeEmpty();
            token.TokenSecretId.Should().BeNull();
        }

        [Fact]
        public async Task SaveTokenMongoFailureAfterNewIdSoftDeletesTheNewVaultValue()
        {
            // C4
            FailReplace();
            var token = new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" };

            (await _sut.saveToken(token)).Should().BeFalse();

            var created = _store.CallsTo("set").Single();
            _store.CallsTo("delete").Should().Equal(created);
            _store.Values.Should().BeEmpty();
            _store.SoftDeleted.Should().ContainKey(created);
            token.TokenSecretId.Should().BeNull("the row was never saved with the new pointer");
        }

        [Fact]
        public async Task SaveTokenUnacknowledgedWriteAfterNewIdSoftDeletesTheNewVaultValue()
        {
            // C4, unacknowledged variant.
            CaptureReplace(ReplaceOneResult.Unacknowledged.Instance);

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" }))
                .Should().BeFalse();

            _store.CallsTo("delete").Should().Equal(_store.CallsTo("set"));
        }

        [Fact]
        public async Task SaveTokenMongoFailureWithReusedIdKeepsTheVaultValue()
        {
            // C5
            _store.Values[ExistingId] = "gho_old";
            SetupStoredRow(new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = ExistingId });
            FailReplace();
            var token = new RepositoryToken { BlocksUserId = "user-1", TokenSecretId = ExistingId, AccessToken = "gho_new" };

            (await _sut.saveToken(token)).Should().BeFalse();

            _store.CallsTo("delete").Should().BeEmpty();
            _store.Values.Should().ContainKey(ExistingId);
            token.TokenSecretId.Should().Be(ExistingId);
        }

        [Fact]
        public async Task SaveTokenIsRejectedWhenTheRegisteredStoreIsNotKeyVault()
        {
            // C11
            var sut = GithubTokenStoreTestSupport.CreateRepository(
                _provider.Object, _secret.Object, _logger, _store, acceptAsKeyVault: false);

            var act = () => sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" });

            await act.Should().ThrowAsync<GithubTokenStoreException>();
            _store.Calls.Should().BeEmpty();
            VerifyNoMongoWrite();
            var error = _logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error).Subject;
            error.Message.Should().Contain("KeyVault__KeyVaultUrl").And.Contain("Secrets__ValueStore=KeyVault");
        }

        [Fact]
        public async Task SaveTokenFailsAsUnavailableWhenTheStoreCannotBeConstructed()
        {
            // C15
            var provider = new GithubTokenStoreTestSupport.StoreProvider(
                new InvalidOperationException("Required Azure config value 'KeyVault:KeyVaultUrl' is missing."));
            var sut = GithubTokenStoreTestSupport.CreateRepository(_provider.Object, _secret.Object, _logger, provider);

            var act = () => sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" });

            (await act.Should().ThrowAsync<GithubTokenStoreException>()).Which.Operation.Should().Be("set");
            VerifyNoMongoWrite();
        }

        [Theory]
        [InlineData("argument")]
        [InlineData("canceled")]
        public async Task StoreArgumentOrCancellationFailuresSurfaceAsTokenStoreFailures(string kind)
        {
            // C4/C7/C9 depend on every store failure arriving as GithubTokenStoreException.
            Func<string, Exception> failure = kind == "argument"
                ? id => new ArgumentException("bad secret id " + id)
                : _ => new OperationCanceledException();
            _store.Fail("set", failure);

            var act = () => _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" });

            (await act.Should().ThrowAsync<GithubTokenStoreException>()).Which.Operation.Should().Be("set");
            VerifyNoMongoWrite();
        }

        [Fact]
        public async Task TwoFirstTimeSavesThatBothSeeNoRowEachCreateTheirOwnSecretAsInSpecA4()
        {
            // Models the spec's A4 case with mocked acknowledgements: when neither save sees a stored
            // row, each creates its own id. Real MongoDB behaviour is covered by the integration test.
            var written = CaptureReplace(new ReplaceOneResult.Acknowledged(1, 1, null));

            var firstSaved = await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_first" });
            var secondSaved = await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_second" });

            firstSaved.Should().BeTrue();
            secondSaved.Should().BeTrue();
            var pointers = written.Select(w => w[nameof(RepositoryToken.TokenSecretId)].AsString).ToList();
            pointers.Should().OnlyHaveUniqueItems().And.HaveCount(2);
            _store.Values.Keys.Should().BeEquivalentTo(pointers);
        }

        [Fact]
        public async Task NoUserInContextTouchesNeitherMongoNorTheVault()
        {
            BlocksContext.SetContext(null);

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_abc" })).Should().BeFalse();
            (await _sut.getToken()).Should().BeNull();
            (await _sut.DeleteTokenAsync()).Should().BeFalse();
            (await _sut.getToken(null!)).Should().BeNull();
            (await _sut.DeleteTokenAsync(string.Empty)).Should().BeFalse();

            VerifyNoMongoAccess();
            _store.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveTokenNeverLogsTheTokenValue()
        {
            // C12, including a store exception whose message carries the token.
            _store.Fail("set", _ => new ArgumentException("value gho_secret_value rejected"));
            await _sut.Invoking(r => r.saveToken(new RepositoryToken { BlocksUserId = "user-1", AccessToken = "gho_secret_value" }))
                .Should().ThrowAsync<GithubTokenStoreException>()
                .Where(e => !e.ToString().Contains("gho_secret_value", StringComparison.Ordinal));

            _logger.AllText.Should().NotContain("gho_secret_value");
        }
    }
}
