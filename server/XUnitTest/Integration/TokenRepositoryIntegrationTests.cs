using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class TokenRepositoryIntegrationTests : IDisposable
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IBlocksSecret> _secret = new();

        public TokenRepositoryIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
        }

        public void Dispose() => BlocksContext.ClearContext();

        private TokenRepository CreateRepo() =>
            new(_fixture.DbContextProvider, new Mock<ILogger<TokenRepository>>().Object, _secret.Object);

        private static void SetUser(string userId) =>
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));

        private static RepositoryToken NewToken(string userId) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            BlocksUserId = userId,
            AccessToken = "tok-" + userId,
            Source = "Github",
            UserName = "octo"
        };

        [Fact]
        public async Task SaveToken_ThenGetToken_RoundTrips()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            (await sut.saveToken(NewToken(userId))).Should().BeTrue();

            var fetched = await sut.getToken();
            fetched.Should().NotBeNull();
            fetched.AccessToken.Should().Be("tok-" + userId);
        }

        [Fact]
        public async Task SaveToken_Upsert_UpdatesExisting()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            var original = NewToken(userId);
            await sut.saveToken(original);

            var updated = NewToken(userId);
            updated.ItemId = original.ItemId;
            updated.AccessToken = "updated-token";
            (await sut.saveToken(updated)).Should().BeTrue();

            (await sut.getToken()).AccessToken.Should().Be("updated-token");
        }

        [Fact]
        public async Task GetToken_NotFound_ReturnsNull()
        {
            SetUser(Guid.NewGuid().ToString("N"));
            (await CreateRepo().getToken()).Should().BeNull();
        }

        [Fact]
        public async Task GetTokenByUserId_ReturnsAccessToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.getToken(userId)).Should().Be("tok-" + userId);
        }

        [Fact]
        public async Task GetTokenByUserId_NotFound_ReturnsNull()
        {
            (await CreateRepo().getToken(Guid.NewGuid().ToString("N"))).Should().BeNull();
        }

        [Fact]
        public async Task GetTokens_ReturnsAll()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.getTokens()).Should().Contain(t => t.BlocksUserId == userId);
        }

        [Fact]
        public async Task UpdateUsernameAsync_SetsOrganizations()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            var token = NewToken(userId);
            await sut.saveToken(token);

            var orgs = new List<UserOrganizations> { new() { OrgUserName = "acme" } };
            await sut.UpdateUsernameAsync(token.ItemId, orgs);

            var fetched = await sut.getToken();
            fetched.Organizations.Should().ContainSingle(o => o.OrgUserName == "acme");
        }

        [Fact]
        public async Task DeleteTokenAsync_ByContext_RemovesToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.DeleteTokenAsync()).Should().BeTrue();
            (await sut.getToken()).Should().BeNull();
        }

        [Fact]
        public async Task DeleteTokenAsync_ByUserId_RemovesToken()
        {
            var userId = Guid.NewGuid().ToString("N");
            SetUser(userId);
            var sut = CreateRepo();
            await sut.saveToken(NewToken(userId));

            (await sut.DeleteTokenAsync(userId)).Should().BeTrue();
        }

        [Fact]
        public async Task DeleteTokenAsync_NothingToDelete_ReturnsFalse()
        {
            (await CreateRepo().DeleteTokenAsync(Guid.NewGuid().ToString("N"))).Should().BeFalse();
        }

        [Fact]
        public async Task GetUserByIdAsync_ReturnsUser()
        {
            var itemId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<User>("Users").InsertOneAsync(new User { ItemId = itemId, UserName = "bob" });

            var fetched = await CreateRepo().GetUserByIdAsync(itemId);
            fetched.Should().NotBeNull();
            fetched.UserName.Should().Be("bob");
        }
    }
}
