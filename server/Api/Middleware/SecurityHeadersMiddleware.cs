namespace Api.Middleware;

/// <summary>
/// Browser security headers (ZAP DAST bar).
/// Env bootstrap via /runtime-config.js; style/script without unsafe-inline (IAM/OS pattern).
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        Apply(context);
        // Re-apply on start so later middleware cannot drop headers before the body flushes.
        context.Response.OnStarting(static state =>
        {
            Apply((HttpContext)state!);
            return Task.CompletedTask;
        }, context);

        await _next(context);
    }

    internal static void Apply(HttpContext context)
    {
        var headers = context.Response.Headers;
        var path = context.Request.Path.Value ?? string.Empty;

        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        if (!headers.ContainsKey("Content-Security-Policy"))
        {
            headers["Content-Security-Policy"] = BuildCsp();
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

    private static string BuildCsp()
    {
        const string connectHosts =
            "https://dev-iam.blocksdevelopers.com " +
            "https://dev-api.blocksdevelopers.com " +
            "https://dev-construct.blocksdevelopers.com " +
            "https://dev-localization.blocksdevelopers.com " +
            "https://dev-agents.blocksdevelopers.com " +
            "https://dev-data.blocksdevelopers.com " +
            "https://dev-utilities.blocksdevelopers.com " +
            "https://dev-logic.blocksdevelopers.com " +
            "wss://dev-logic.blocksdevelopers.com " +
            "https://dev-monitor.blocksdevelopers.com " +
            "https://dev-release.blocksdevelopers.com " +
            "https://dev-studio.blocksdevelopers.com " +
            "https://dev-os.blocksdevelopers.com " +
            "https://blocksdev.blob.core.windows.net " +
            "https://api.rollbar.com " +
            "https://code.selise.biz";

        return
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self'; " +
            "img-src 'self' data: blob: https://blocksdev.blob.core.windows.net https://az-cdn.selise.biz; " +
            "font-src 'self' data:; " +
            "connect-src 'self' " + connectHosts + "; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "object-src 'none'; " +
            "form-action 'self' https://dev-iam.blocksdevelopers.com https://dev-os.blocksdevelopers.com";
    }
}
