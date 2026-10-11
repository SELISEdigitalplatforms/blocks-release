using Api.Security;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace XUnitTest.Api.Security;

/// <summary>
/// The SPA's CSP, ported from blocks-monitor. Two things went wrong with the first release
/// policy (#211, reverted in 97bca1e) and both are pinned here: the host list was hardcoded to
/// <c>dev-*</c> (stg and prod could not reach their own IAM), and <c>style-src 'self'</c> blocked
/// the inline styles Radix, vaul, sonner and cmdk inject at runtime.
/// </summary>
public class ContentSecurityPolicyTests
{
    private static IConfiguration Config(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    // ---------- Origins follow configuration, not the code ----------

    [Fact]
    public void Build_UsesTheConfiguredEnvironmentsHosts()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_DATA_BASE_URL"] = "https://data.example.com",
        }));

        policy.Should().Contain("https://iam.example.com");
        policy.Should().Contain("https://os.example.com");
        policy.Should().Contain("https://data.example.com");
    }

    [Fact]
    public void Build_NamesNoEnvironmentItWasNotConfiguredWith()
    {
        // The regression this class exists for. A hardcoded dev host list meant the policy
        // was right on dev and would have stopped the SPA reaching its own API on stg/prod.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://stg-iam.blocksdevelopers.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://stg-os.blocksdevelopers.com",
        }));

        policy.Should().NotContain("dev-iam.blocksdevelopers.com");
        policy.Should().NotContain("dev-os.blocksdevelopers.com");
    }

    [Fact]
    public void Build_FormActionIsTheIdentityHostAndThePortal()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_DATA_BASE_URL"] = "https://data.example.com",
        }));

        var formAction = Directive(policy, "form-action");
        formAction.Should().Contain("https://iam.example.com");
        formAction.Should().Contain("https://os.example.com");
        formAction.Should().NotContain("https://data.example.com");
    }

    // ---------- WebSockets need their own scheme ----------

    [Fact]
    public void Build_EmitsTheWebSocketFormOfTheLogicHost()
    {
        // A CSP source is scheme-sensitive: https://host does not permit wss://host, which is
        // why the hardcoded policy listed wss://dev-logic separately.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"] = "https://logic.example.com",
        }));

        var connect = Directive(policy, "connect-src");
        connect.Should().Contain("https://logic.example.com");
        connect.Should().Contain("wss://logic.example.com");
    }

    [Theory]
    [InlineData("https://logic.example.com/hub", "wss://logic.example.com")]
    [InlineData("wss://logic.example.com", "wss://logic.example.com")]
    [InlineData("http://logic.example.com", null)]
    [InlineData("not-a-url", null)]
    [InlineData("", null)]
    public void ToWebSocketOrigin_OnlyAllowsEncryptedSockets(string value, string? expected)
    {
        ContentSecurityPolicy.ToWebSocketOrigin(value).Should().Be(expected);
    }

    // The unencrypted socket origin, built from the scheme constant so the test reads the same
    // value the policy would have emitted before plain sockets were dropped.
    private static readonly string PlainSocketOrigin =
        new UriBuilder(Uri.UriSchemeWs, "logic.example.com").Uri.GetLeftPart(UriPartial.Authority);

    [Fact]
    public void ToWebSocketOrigin_RefusesAPlainSocketOrigin()
    {
        ContentSecurityPolicy.ToWebSocketOrigin(PlainSocketOrigin).Should().BeNull();
    }

    [Fact]
    public void Build_GivesAPlainHttpLogicHostNoSocketAllowance()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"] = "http://logic.example.com",
        }));

        Directive(policy, "connect-src").Should().NotContain(PlainSocketOrigin);
    }

    // ---------- Third-party origins the runtime config cannot describe ----------

    [Fact]
    public void Build_AppendsConfiguredExtraOrigins()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraConnectSrc"] = "https://api.rollbar.com https://code.selise.biz",
            ["Csp:ExtraImgSrc"] = "https://cdn.example.com",
        }));

        Directive(policy, "connect-src").Should().Contain("https://api.rollbar.com");
        Directive(policy, "connect-src").Should().Contain("https://code.selise.biz");
        Directive(policy, "img-src").Should().Contain("https://cdn.example.com");
    }

    // ---------- Directives that must not drift ----------

    [Fact]
    public void Build_KeepsInlineStylesAllowedAndInlineScriptsBlocked()
    {
        var policy = ContentSecurityPolicy.Build(Config([]));

        Directive(policy, "style-src").Should().Contain("'unsafe-inline'");
        Directive(policy, "script-src").Should().NotContain("'unsafe-inline'");
        Directive(policy, "script-src").Should().NotContain("'unsafe-eval'");
    }

    [Fact]
    public void Build_KeepsTheFramingAndObjectRestrictions()
    {
        var policy = ContentSecurityPolicy.Build(Config([]));

        policy.Should().Contain("frame-ancestors 'none'");
        policy.Should().Contain("object-src 'none'");
        policy.Should().Contain("base-uri 'self'");
    }

    // ---------- A malformed value cannot inject a directive ----------

    [Theory]
    [InlineData("not-a-url")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://evil.example.com; script-src *")]
    public void ToOrigin_RejectsAnythingThatIsNotAnHttpOrWebSocketOrigin(string value)
    {
        // "https://evil...; script-src *" parses as a URI whose path carries the injection,
        // so the assertion is that only the authority survives -- never the directive.
        var origin = ContentSecurityPolicy.ToOrigin(value);
        (origin == null || !origin.Contains("script-src", StringComparison.Ordinal)).Should().BeTrue();
    }

    [Fact]
    public void ToOrigin_DropsPathQueryAndTrailingSlash()
    {
        ContentSecurityPolicy.ToOrigin("https://iam.example.com/api/?x=1")
            .Should().Be("https://iam.example.com");
    }

    [Fact]
    public void Build_ExtraOriginsCannotInjectADirective()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraConnectSrc"] = "https://ok.example.com; script-src * 'unsafe-eval'",
            ["Csp:ExtraImgSrc"] = "javascript:alert(1), data:text/html,x",
        }));

        Directive(policy, "connect-src").Should().Contain("https://ok.example.com");
        Directive(policy, "script-src").Should().Be(" 'self'");
        policy.Should().NotContain("unsafe-eval");
        policy.Should().NotContain("javascript:");
        policy.Should().NotContain("text/html");
    }

    [Fact]
    public void Build_WithNoConfigurationAllowsOnlySelf()
    {
        var policy = ContentSecurityPolicy.Build(Config([]));

        Directive(policy, "connect-src").Should().Be(" 'self'");
        Directive(policy, "form-action").Should().Be(" 'self'");
    }

    // ---------- Release-specific origins ----------

    [Fact]
    public void Build_IncludesTheReleaseSpecificRuntimeHosts()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IDP_BASE_URL"] = "https://idp.example.com",
            ["FrontendRuntime:BLOCKS_OS_URL"] = "https://portal.example.com",
            ["FrontendRuntime:BLOCKS_APP_URL"] = "https://app.example.com",
            ["FrontendRuntime:BLOCKS_API_BASE_URL"] = "https://release.example.com",
        }));

        var connect = Directive(policy, "connect-src");
        connect.Should().Contain("https://idp.example.com");
        connect.Should().Contain("https://portal.example.com");
        connect.Should().Contain("https://app.example.com");
        connect.Should().Contain("https://release.example.com");

        var formAction = Directive(policy, "form-action");
        formAction.Should().Contain("https://idp.example.com");
        formAction.Should().Contain("https://portal.example.com");
        formAction.Should().NotContain("https://app.example.com");
    }

    [Fact]
    public void Build_AllowsTheConfiguredFontHosts()
    {
        // index.html loads DM Sans from Google Fonts; the stylesheet and the font files come
        // from two different hosts.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraStyleSrc"] = "https://fonts.googleapis.com",
            ["Csp:ExtraFontSrc"] = "https://fonts.gstatic.com",
        }));

        Directive(policy, "style-src").Should().Contain("https://fonts.googleapis.com");
        Directive(policy, "font-src").Should().Contain("https://fonts.gstatic.com");
        Directive(policy, "style-src").Should().Contain("'unsafe-inline'");
    }

    [Fact]
    public void Build_ShippedAppsettingsAllowsGoogleFonts()
    {
        // The test output's appsettings.json is the Worker's, so read the API's from source.
        var appsettings = ApiAppsettingsPath();
        var policy = ContentSecurityPolicy.Build(
            new ConfigurationBuilder().AddJsonFile(appsettings, optional: false).Build());

        Directive(policy, "style-src").Should().Contain("https://fonts.googleapis.com");
        Directive(policy, "font-src").Should().Contain("https://fonts.gstatic.com");
    }

    private static string ApiAppsettingsPath()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "Api", "appsettings.json");
            if (File.Exists(candidate)) return candidate;
        }

        throw new FileNotFoundException("server/Api/appsettings.json not found above the test output.");
    }

    /// <summary>The sources of one directive, without its name or the trailing separator.</summary>
    private static string Directive(string policy, string name)
    {
        var parts = policy.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var directive = parts.Single(p => p.StartsWith(name + " ", StringComparison.Ordinal)
                                          || p.Equals(name, StringComparison.Ordinal));
        return directive[name.Length..];
    }
}
