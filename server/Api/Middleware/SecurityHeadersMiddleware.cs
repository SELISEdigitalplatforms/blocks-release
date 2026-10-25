namespace Api.Middleware;

/// <summary>
/// Browser security headers (ZAP DAST bar). Env bootstrap via /runtime-config.js
/// so CSP can keep script-src 'self' without unsafe-inline. The policy itself is built from
/// configuration once at startup -- see <see cref="Api.Security.ContentSecurityPolicy"/>.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    // Built once from configuration at startup -- the policy does not vary per request.
    private readonly string _contentSecurityPolicy;

    /// <summary>Creates the middleware with the policy built at startup.</summary>
    public SecurityHeadersMiddleware(RequestDelegate next, string contentSecurityPolicy)
    {
        _next = next;
        _contentSecurityPolicy = contentSecurityPolicy;
    }

    /// <summary>Sets the headers now and again when the response starts.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        Apply(context, _contentSecurityPolicy);
        context.Response.OnStarting(() =>
        {
            Apply(context, _contentSecurityPolicy);
            return Task.CompletedTask;
        });

        await _next(context).ConfigureAwait(false);
    }

    /// <summary>Writes the browser security headers; a header already set by the endpoint wins.</summary>
    public static void Apply(HttpContext context, string contentSecurityPolicy)
    {
        ArgumentNullException.ThrowIfNull(context);

        var headers = context.Response.Headers;
        var path = context.Request.Path.Value ?? string.Empty;

        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        if (!headers.ContainsKey("Content-Security-Policy"))
        {
            headers["Content-Security-Policy"] = contentSecurityPolicy;
        }

        if (!headers.ContainsKey("Cache-Control"))
        {
            ApplyCacheControl(headers, path);
        }
    }

    private static void ApplyCacheControl(IHeaderDictionary headers, string path)
    {
        if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase)
            || path == "/"
            || path.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("runtime-config.js", StringComparison.OrdinalIgnoreCase)
            || !Path.HasExtension(path))
        {
            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            headers["Pragma"] = "no-cache";
        }
        else if (path.StartsWith("/assets/", StringComparison.OrdinalIgnoreCase))
        {
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
    }
}
