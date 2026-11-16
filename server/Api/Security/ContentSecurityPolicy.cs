namespace Api.Security;

/// <summary>
/// Builds the SPA's Content-Security-Policy from configuration.
/// <para>
/// Same pattern as blocks-monitor, blocks-iam and blocks-os
/// (<c>server/Api/Security/ContentSecurityPolicy.cs</c>). The origins come from the
/// <c>FrontendRuntime</c> section that fills /runtime-config.js, so the policy follows the
/// environment the host runs in. The first release policy (#211, reverted in 97bca1e) hardcoded
/// <c>dev-*</c> hosts, which would have blocked stg and prod from calling their own IAM.
/// </para>
/// </summary>
public static class ContentSecurityPolicy
{
    /// <summary>
    /// <c>FrontendRuntime</c> keys holding an origin the SPA makes requests to. Anything not
    /// derivable from these (a CDN, a third-party service) goes in <c>Csp:ExtraConnectSrc</c> /
    /// <c>Csp:ExtraImgSrc</c> rather than back into code.
    /// </summary>
    internal static readonly string[] ConnectOriginKeys =
    [
        "BLOCKS_API_BASE_URL",
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_IDP_BASE_URL",
        "BLOCKS_CONSTRUCT_URL",
        "BLOCKS_LOCALIZATION_BASE_URL",
        "BLOCKS_AGENTS_BASE_URL",
        "BLOCKS_DATA_BASE_URL",
        "BLOCKS_UTILITIES_BASE_URL",
        "BLOCKS_LOGIC_BASE_URL",
        "BLOCKS_MONITOR_BASE_URL",
        "BLOCKS_RELEASE_BASE_URL",
        "BLOCKS_STUDIO_BASE_URL",
        "BLOCKS_OS_BASE_URL",
        "BLOCKS_OS_URL",
        "BLOCKS_APP_URL",
    ];

    /// <summary>
    /// Origins the SPA opens a WebSocket to. A CSP source is scheme-sensitive, so
    /// <c>https://host</c> does not permit <c>wss://host</c>. The deployment hub is
    /// same-origin and covered by <c>'self'</c>; the notification hub lives on logic.
    /// </summary>
    internal static readonly string[] WebSocketOriginKeys =
    [
        "BLOCKS_LOGIC_BASE_URL",
    ];

    /// <summary>Where a login POST may be sent: the identity host and the portal.</summary>
    internal static readonly string[] FormActionOriginKeys =
    [
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_IDP_BASE_URL",
        "BLOCKS_OS_BASE_URL",
        "BLOCKS_OS_URL",
    ];

    /// <summary>
    /// Stands in for the style nonce (see <see cref="StyleNonce"/>): in the policy built at
    /// startup and in the built index.html (meta[name=csp-nonce]). Replaced on every response.
    /// </summary>
    public const string StyleNoncePlaceholder = "__CSP_STYLE_NONCE__";

    /// <summary>The policy for one response, with the placeholder swapped for its nonce.</summary>
    public static string WithStyleNonce(string policy, string nonce)
    {
        ArgumentNullException.ThrowIfNull(policy);
        ArgumentException.ThrowIfNullOrEmpty(nonce);
        return policy.Replace(StyleNoncePlaceholder, nonce, StringComparison.Ordinal);
    }

    /// <summary>The SPA shell for one response, carrying the same nonce as its header.</summary>
    public static string RenderIndex(string indexHtmlTemplate, string nonce)
    {
        ArgumentNullException.ThrowIfNull(indexHtmlTemplate);
        ArgumentException.ThrowIfNullOrEmpty(nonce);
        return indexHtmlTemplate.Replace(StyleNoncePlaceholder, nonce, StringComparison.Ordinal);
    }

    /// <summary>The policy for the environment this host is configured for.</summary>
    public static string Build(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var runtime = configuration.GetSection("FrontendRuntime");
        var csp = configuration.GetSection("Csp");

        return BuildPolicy(
            connectSrc: Origins(runtime, ConnectOriginKeys)
                .Concat(Origins(runtime, WebSocketOriginKeys).Select(ToWebSocketOrigin))
                .Concat(Split(csp["ExtraConnectSrc"])),
            imgSrc: Split(csp["ExtraImgSrc"]),
            formAction: Origins(runtime, FormActionOriginKeys).Concat(Split(csp["ExtraFormAction"])));
    }

    /// <summary>The policy itself, separated from configuration so it can be asserted directly.</summary>
    public static string BuildPolicy(
        IEnumerable<string?> connectSrc,
        IEnumerable<string?> imgSrc,
        IEnumerable<string?> formAction)
    {
        var connect = Normalize(connectSrc);
        var img = Normalize(imgSrc);
        var form = Normalize(formAction);

        return string.Join(
            " ",
            "default-src 'self';",
            "script-src 'self';",

            // Styles. <style> elements need the style nonce (StyleNonce). genesis-os (login page,
            // logo loader), Radix Dialog/Select/ScrollArea, vaul, sonner and cmdk create them at
            // runtime; /csp-nonce.js stamps the nonce on every <style> made through
            // document.createElement, and the server writes the same nonce into index.html (see
            // WithStyleNonce / RenderIndex). Plain style-src 'self' without the nonce broke
            // dialogs, dropdowns and toasts, which is why #211 was reverted and 'unsafe-inline'
            // was there before. Same approach as blocks-iam (66f9b48d) and blocks-os#643.
            //
            // Style attributes stay allowed through style-src-attr only: components set them,
            // an attribute cannot carry a nonce, and an attribute cannot load a script.
            // script-src stays strict, which is the directive that matters for injection.
            $"style-src 'self' 'nonce-{StyleNoncePlaceholder}';",
            "style-src-attr 'unsafe-inline';",

            $"img-src 'self' data: blob:{Suffix(img)};",
            "font-src 'self' data:;",
            $"connect-src 'self'{Suffix(connect)};",
            "frame-ancestors 'none';",
            "base-uri 'self';",
            "object-src 'none';",
            $"form-action 'self'{Suffix(form)}");
    }

    /// <summary>Reduce configured values to distinct, sorted origins.</summary>
    private static List<string> Normalize(IEnumerable<string?> values) =>
        values
            .Select(ToOrigin)
            .Where(origin => origin is not null)
            .Select(origin => origin!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(origin => origin, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static IEnumerable<string?> Origins(IConfiguration section, IEnumerable<string> keys) =>
        keys.Select(key => section[key]);

    /// <summary>
    /// A CSP source is an origin, so any path, query or trailing slash is dropped. A value that
    /// is not an absolute http(s)/ws(s) URL is ignored rather than emitted verbatim, so a
    /// malformed secret cannot inject a directive.
    /// </summary>
    public static string? ToOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return null;

        if (uri.Scheme != Uri.UriSchemeHttp
            && uri.Scheme != Uri.UriSchemeHttps
            && uri.Scheme != Uri.UriSchemeWs
            && uri.Scheme != Uri.UriSchemeWss) return null;

        return uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>
    /// The wss origin a browser uses to open a socket to an https host, or null. Plain http and
    /// ws hosts get no socket allowance: an unencrypted socket would carry the session token and
    /// notification payloads in clear text.
    /// </summary>
    public static string? ToWebSocketOrigin(string? value)
    {
        var origin = ToOrigin(value);
        if (origin is null) return null;

        if (origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return "wss://" + origin["https://".Length..];
        if (origin.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
            return origin;
        return null;
    }

    /// <summary>Space- or comma-separated list, for origins no runtime key describes.</summary>
    public static IEnumerable<string?> Split(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split([' ', ',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string Suffix(List<string> origins) =>
        origins.Count == 0 ? string.Empty : " " + string.Join(" ", origins);
}
