using Api.Middleware;
using Api.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

namespace XUnitTest.Api.Middleware;

public class SecurityHeadersMiddlewareTests
{
    private static readonly string Csp = ContentSecurityPolicy.BuildPolicy([], [], []);

    [Fact]
    public void Apply_sets_browser_security_headers()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/";

        SecurityHeadersMiddleware.Apply(context, Csp);

        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        headers["X-Frame-Options"].ToString().Should().Be("DENY");
        headers["Strict-Transport-Security"].ToString().Should().Contain("max-age=31536000");
        headers["Content-Security-Policy"].ToString().Should().Be(Csp);
        headers["Cache-Control"].ToString().Should().Contain("no-store");
    }

    [Fact]
    public void Apply_sets_immutable_cache_for_assets()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/assets/index.js";

        SecurityHeadersMiddleware.Apply(context, Csp);

        context.Response.Headers["Cache-Control"].ToString()
            .Should().Contain("immutable");
    }
}
