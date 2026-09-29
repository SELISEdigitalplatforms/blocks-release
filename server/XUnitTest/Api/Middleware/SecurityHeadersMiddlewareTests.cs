using System.Threading.Tasks;
using Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace XUnitTest.Api.Middleware;

public class SecurityHeadersMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_SetsRequiredSecurityHeaders()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/";

        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);
        await middleware.InvokeAsync(context);

        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        headers["X-Frame-Options"].ToString().Should().Be("DENY");
        headers["Strict-Transport-Security"].ToString().Should().Contain("max-age=31536000");
        var csp = headers["Content-Security-Policy"].ToString();
        csp.Should().Contain("default-src 'self'");
        csp.Should().Contain("style-src 'self' 'unsafe-inline'");
        csp.Should().Contain("frame-ancestors 'none'");
        headers["Cache-Control"].ToString().Should().Contain("no-store");
    }
}
