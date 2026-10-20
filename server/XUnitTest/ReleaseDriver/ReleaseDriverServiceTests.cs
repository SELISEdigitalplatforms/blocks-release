using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentAssertions;
using Moq;
using ReleaseDriver;
using Xunit;
using DomainResponse = Devops.DomainService.Shared.Entities.BaseApiResponse;

namespace XUnitTest.Driver
{
    /// <summary>
    /// H13: the driver hands blocks-os exactly the body blocks-release's own AuthController
    /// returns, so the token-store messages and error keys reach blocks-os unchanged.
    /// </summary>
    public class ReleaseDriverServiceTests
    {
        private readonly Mock<IAuthService> _auth = new();

        private ReleaseDriverService CreateDriver() =>
            new(_auth.Object, Mock.Of<IRepoRepository>(), Mock.Of<IVersionControlService>(),
                Mock.Of<IBuildService>(), null!);

        public static TheoryData<string, string> TokenStoreBodies() => new()
        {
            { "Could not validate your GitHub connection. Please try again later.", "TokenStore" },
            { "This operation is not possible right now. Please try again later.", "TokenStore" },
            { "Your GitHub authorization is no longer valid. Please re-authenticate.", "Authorization" },
        };

        private static DomainResponse Body(string message, string key) => new()
        {
            IsSuccess = false,
            StatusCode = HttpStatusCode.BadRequest,
            Message = message,
            Errors = new Dictionary<string, string> { [key] = message }
        };

        private static void ShouldMatch(BaseApiResponse actual, DomainResponse expected)
        {
            actual.IsSuccess.Should().Be(expected.IsSuccess);
            actual.StatusCode.Should().Be(expected.StatusCode);
            actual.Message.Should().Be(expected.Message);
            actual.Errors.Should().BeEquivalentTo(expected.Errors);
        }

        [Theory]
        [MemberData(nameof(TokenStoreBodies))]
        public async Task IsAuthorizeAsyncPassesTheBodyThroughUnchanged(string message, string errorKey)
        {
            var body = Body(message, errorKey);
            _auth.Setup(a => a.isAuthorized()).ReturnsAsync(body);

            ShouldMatch(await CreateDriver().IsAuthorizeAsync(), body);
        }

        [Fact]
        public async Task GetAccessTokenAsyncPassesTheBodyThroughUnchanged()
        {
            var body = Body("This operation is not possible right now. Please try again later.", "TokenStore");
            _auth.Setup(a => a.GetAccessToken("code")).ReturnsAsync(body);

            ShouldMatch(await CreateDriver().GetAccessTokenAsync("code"), body);
        }

        [Fact]
        public async Task RemoveAuthorizationAsyncPassesTheBodyThroughUnchanged()
        {
            var body = Body("Authorization removal failed.", "Authorization");
            _auth.Setup(a => a.RevokeOauthAccess()).ReturnsAsync(body);

            ShouldMatch(await CreateDriver().RemoveAuthorizationAsync(), body);
        }

        [Fact]
        public async Task SuccessBodiesPassThroughUnchanged()
        {
            var ok = new DomainResponse { IsSuccess = true, StatusCode = HttpStatusCode.OK };
            _auth.Setup(a => a.isAuthorized()).ReturnsAsync(ok);
            _auth.Setup(a => a.GetAccessToken("code")).ReturnsAsync(ok);
            _auth.Setup(a => a.RevokeOauthAccess()).ReturnsAsync(ok);
            var driver = CreateDriver();

            ShouldMatch(await driver.IsAuthorizeAsync(), ok);
            ShouldMatch(await driver.GetAccessTokenAsync("code"), ok);
            ShouldMatch(await driver.RemoveAuthorizationAsync(), ok);
        }
    }
}
