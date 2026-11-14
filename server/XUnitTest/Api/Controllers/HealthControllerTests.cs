using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Moq;
using Xunit;

namespace XUnitTest.Api.Controllers;

public class HealthControllerTests
{
    private const string ManageHealthPermission = "blocks-release::monitor::manage-health";

    private readonly Mock<IHeartbeatConfigurationService> _service = new();

    [Fact]
    public async Task UpdateHealth_ReturnsTheServiceResponse()
    {
        var request = new UpdateHealthRequest { ItemId = "hb-1", IsActive = false };
        var expected = new BaseApiResponse { IsSuccess = true };
        _service.Setup(s => s.UpdateAsync(request)).ReturnsAsync(expected);

        var result = await new HealthController(_service.Object).UpdateHealth(request);

        result.Should().BeSameAs(expected);
    }

    [Fact]
    public async Task DeleteHealth_ReturnsTheServiceResponse()
    {
        var expected = new BaseApiResponse { IsSuccess = true };
        _service.Setup(s => s.DeleteAsync("hb-1")).ReturnsAsync(expected);

        var result = await new HealthController(_service.Object).DeleteHealth("hb-1");

        result.Should().BeSameAs(expected);
    }

    /// <summary>The client still calls /api/Health/UpdateHealth and /api/Health/DeleteHealth.</summary>
    [Theory]
    [InlineData(nameof(HealthController.UpdateHealth), typeof(HttpPostAttribute), "UpdateHealth")]
    [InlineData(nameof(HealthController.DeleteHealth), typeof(HttpDeleteAttribute), "DeleteHealth")]
    public void Actions_KeepTheRoutesTheClientCalls(string action, System.Type verb, string template)
    {
        typeof(HealthController).GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("[controller]");

        var method = typeof(HealthController).GetMethod(action)!;
        var route = (HttpMethodAttribute)method.GetCustomAttribute(verb)!;
        route.Template.Should().Be(template);
    }

    [Fact]
    public void EveryAction_RequiresTheManageHealthPermission()
    {
        var actions = typeof(HealthController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName)
            .ToList();

        actions.Should().HaveCount(2);
        foreach (var action in actions)
        {
            action.GetCustomAttribute<ProtectedEndPointAttribute>()!.ResourceName
                .Should().Be(ManageHealthPermission, $"{action.Name} must use the manage-health permission");
            action.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true).Should().BeEmpty();
        }
    }
}
