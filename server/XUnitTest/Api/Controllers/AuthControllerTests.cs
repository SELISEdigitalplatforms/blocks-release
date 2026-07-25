using System.Net;
using System.Threading.Tasks;
using Api.Controllers;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers
{
    public class AuthControllerTests
    {
        private readonly Mock<IAuthService> _authService = new();
        private AuthController CreateController() => new(_authService.Object);

        [Fact]
        public async Task IsAuthorized_ReturnsOk()
        {
            _authService.Setup(a => a.isAuthorized()).ReturnsAsync(new BaseApiResponse { IsSuccess = true });
            var result = await CreateController().IsAuthorized();
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task AccessToken_EmptyCode_ReturnsBadRequest()
        {
            var result = await CreateController().AccessToken("  ");
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task AccessToken_Success_ReturnsOk()
        {
            _authService.Setup(a => a.GetAccessToken("code")).ReturnsAsync(new BaseApiResponse { IsSuccess = true });
            var result = await CreateController().AccessToken("code");
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task AccessToken_Failure_ReturnsBadRequest()
        {
            _authService.Setup(a => a.GetAccessToken("code")).ReturnsAsync(new BaseApiResponse { IsSuccess = false });
            var result = await CreateController().AccessToken("code");
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task RemoveAuthorization_ReturnsOk()
        {
            _authService.Setup(a => a.RevokeOauthAccess()).ReturnsAsync(new BaseApiResponse { IsSuccess = true });
            var result = await CreateController().RemoveAuthorization();
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteAuthorization_Ok_ReturnsOk()
        {
            _authService.Setup(a => a.DeleteToken()).ReturnsAsync(new BaseApiResponse { StatusCode = HttpStatusCode.OK });
            var result = await CreateController().DeleteAuthorization();
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteAuthorization_NonOk_ReturnsBadRequest()
        {
            _authService.Setup(a => a.DeleteToken()).ReturnsAsync(new BaseApiResponse { StatusCode = HttpStatusCode.BadRequest });
            var result = await CreateController().DeleteAuthorization();
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TestPing_ReturnsOk()
        {
            var result = await CreateController().TestPing();
            result.Should().BeOfType<OkObjectResult>();
        }
    }
}
