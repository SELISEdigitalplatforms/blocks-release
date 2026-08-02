using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

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
        private readonly TokenRepository _sut;

        public TokenRepositoryTests()
        {
            BlocksContext.IsTestMode = true;
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-b", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-b"));

            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");
            _provider.Setup(p => p.GetDatabase("mongodb://localhost", "BlocksRootDb")).Returns(_db.Object);
            _db.Setup(d => d.GetCollection<RepositoryToken>("RepositoryTokens", null)).Returns(_tokens.Object);

            _sut = new TokenRepository(
                _provider.Object, new Mock<ILogger<TokenRepository>>().Object, secret.Object);
        }

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

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" })).Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsSuccessWhenAnExistingTokenIsReplaced()
        {
            SetupReplace(new ReplaceOneResult.Acknowledged(1, 1, null));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" })).Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsSuccessWhenTheStoredTokenIsAlreadyUpToDate()
        {
            // Re-authorising with the same token modifies nothing, and that is still a success.
            SetupReplace(new ReplaceOneResult.Acknowledged(1, 0, null));

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" })).Should().BeTrue();
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

            await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" });

            options.IsUpsert.Should().BeTrue();
        }

        [Fact]
        public async Task SaveToken_ReportsFailureWhenTheWriteIsNotAcknowledged()
        {
            SetupReplace(ReplaceOneResult.Unacknowledged.Instance);

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" })).Should().BeFalse();
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

            (await _sut.saveToken(new RepositoryToken { BlocksUserId = "user-1" })).Should().BeFalse();
        }
    }
}
