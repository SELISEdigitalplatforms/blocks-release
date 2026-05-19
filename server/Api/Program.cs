using BlocksTemplate.Api;
using BlocksTemplate.Api.Hubs;
using Blocks.Genesis;
using Cloud.DomainService.Utilities;
using Devops.DomainService;
using Devops.DomainService.Deployment.Interfaces;
using DomainService.Utilities;
using DomainService.Shared;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Cloud.LmtService.Utilities;
using CloudConfiguration.DomainService.Shared.Utilities;
using Microsoft.IdentityModel.Tokens;
using Cloud.LmtService.Models.Trace;

var serviceName = "blocks-os-api";
var vaultType = ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, vaultType);
var cloudBuildSecret = await CloudBuildSecret.ProcessBlocksSecret(vaultType);
var builder = WebApplication.CreateBuilder(args);

ApplicationConfigurations.ConfigureServices(builder.Services, IdpConstants.GetMessageConfiguration(secret.MessageConnectionString));

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024; // 15 MB
});

var services = builder.Services;

services.AddHealthChecks();

// serviceName ("blocks-os-api") is used for log/metric/trace collections, but the
// IDP issues tokens whose service_access claim grants the canonical service name
// "blocks-os". Genesis 10's HasServiceAccess check requires an exact match, so the
// service-access resource name is set explicitly to "blocks-os" to accept those tokens.
ApplicationConfigurations.ConfigureApi(services, serviceName, serviceAccessResourceName: "blocks-os");

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath);

services.AddEndpointsApiExplorer();
services.AddBlocksSwagger(new BlocksSwaggerOptions
{
    Title = "Blocks Deployment API",
    Version = "v1",
    EnableBearerAuth = true
});

services.AddSignalR().AddJsonProtocol(options =>
{
    options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

services.RegisterAllServices();
services.AddApplicationServices();
services.RegisterApplicationServices(cloudBuildSecret);
services.AddCloudDomainServices();
services.AddCloudLmtServices();
services.AddCloudConfigurationServices();

// Replace the Null implementation registered by the domain service with the
// real SignalR-backed hub service so notifications actually reach connected clients.
services.AddSingleton<IDeploymentHubService, DeploymentHubService>();

var app = builder.Build();

app.MapHub<DeploymentLogHub>("/deploymentHub");
app.UseDefaultFiles();
app.UseStaticFiles();



var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");
if (File.Exists(indexHtml))
{
    app.MapFallbackToFile("/index.html");
    // x-blocks-key cookie
    // check if domain match
    // get google captch key BLOCKS_GOOGLE_SITE_KEY
    // Base Url
    // Construct URL


}

// Genesis 10's SecurityHeadersMiddleware stamps a hardcoded
// "Content-Security-Policy: default-src 'self'; frame-ancestors 'none'" with no
// connect-src, which blocks the SPA's cross-origin calls to the IDP and other
// Blocks services. Override only that header (Genesis's other security headers
// are left intact) with a config-derived connect-src allowlist. OnStarting runs
// just before headers flush, so it deterministically wins over Genesis's
// directly-set value regardless of middleware ordering.
var contentSecurityPolicy = BuildContentSecurityPolicy(builder.Configuration);
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["Content-Security-Policy"] = contentSecurityPolicy;
        return Task.CompletedTask;
    });
    await next();
});

ApplicationConfigurations.ConfigureMiddleware(app);

await app.RunAsync();

static VaultType ResolveVaultType()
{
    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
    {
        return parsedVaultType;
    }

    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
        ? VaultType.OnPrem
        : VaultType.Azure;
}

static string BuildContentSecurityPolicy(IConfiguration configuration)
{
    static string? ResolveEnvOrConfig(IConfiguration config, string key) =>
        Environment.GetEnvironmentVariable(key) ?? config[$"FrontendRuntime:{key}"];

    string[] urlKeys =
    [
        "BLOCKS_IDP_BASE_URL",
        "BLOCKS_API_BASE_URL",
        "BLOCKS_CONSTRUCT_URL",
        "BLOCKS_LOGIC_APP_URL",
        "BLOCKS_APP_URL"
    ];

    var origins = new List<string>();

    void AddOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return;

        var origin = uri.IsDefaultPort
            ? $"{uri.Scheme}://{uri.Host}"
            : $"{uri.Scheme}://{uri.Host}:{uri.Port}";
        if (!origins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        {
            origins.Add(origin);
        }
    }

    foreach (var key in urlKeys)
    {
        AddOrigin(ResolveEnvOrConfig(configuration, key));
    }

    // Fallback baseline: the connect-src allowlist is only useful if the
    // FrontendRuntime config (or matching env vars) is actually loaded. When the
    // running environment name does not match an appsettings.{env}.json that
    // carries the FrontendRuntime section, origins would otherwise be empty and
    // the browser would block the cross-origin call to the IDP. These mirror the
    // canonical URLs used for token replacement in ApplyFrontendRuntimeSettings.
    foreach (var fallback in new[]
    {
        "https://dev-idp.blocksdevelopers.com",
        "https://dev-deployment.blocksdevelopers.com",
        "https://dev-construct.seliseblocks.com",
        "https://dev-logic.blocksdevelopers.com"
    })
    {
        AddOrigin(fallback);
    }

    var connectSrc = origins.Count > 0
        ? $"connect-src 'self' {string.Join(' ', origins)}"
        : "connect-src 'self'";

    // Genesis only emits "default-src 'self'", which (with no script-src/style-src)
    // also blocks the inline window.__BLOCKS_ENV__ bootstrap script in index.html
    // and the app's runtime-injected styles, leaving every getRuntimeEnv() value
    // empty. The inline config script's content is rewritten at startup by token
    // replacement, so a static hash is not stable -> use 'unsafe-inline' for
    // scripts. Google Fonts is loaded from fonts.googleapis.com / fonts.gstatic.com.
    return string.Join("; ",
        "default-src 'self'",
        "frame-ancestors 'none'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        connectSrc);
}

static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
{
    //  var envFilePath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
    //var section = configuration.GetSection("FrontendRuntime");
    //var replacements = new Dictionary<string, string?>
    //{
    //    ["__BLOCKS_API_BASE_URL__"] = section["BLOCKS_API_BASE_URL"],
    //    ["__BLOCKS_X_BLOCKS_KEY__"] = section["BLOCKS_X_BLOCKS_KEY"],
    //    ["__BLOCKS_GOOGLE_SITE_KEY__"] = section["BLOCKS_GOOGLE_SITE_KEY"],
    //    ["__BLOCKS_CONSTRUCT_URL__"] = section["BLOCKS_CONSTRUCT_URL"]
    //};

    DotNetEnv.Env.Load();

    // var replacements = new Dictionary<string, string?>
    // {
    //     ["__BLOCKS_API_BASE_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_API_BASE_URL"),
    //     ["__BLOCKS_X_BLOCKS_KEY__"] = Environment.GetEnvironmentVariable("BLOCKS_X_BLOCKS_KEY"),
    //     ["__BLOCKS_GOOGLE_SITE_KEY__"] = Environment.GetEnvironmentVariable("BLOCKS_GOOGLE_SITE_KEY"),
    //     ["__BLOCKS_CONSTRUCT_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_CONSTRUCT_URL"),
    //     ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = Environment.GetEnvironmentVariable("BLOCKS_GITHUB_SSO_CLIENT_ID"),
    //     ["__BLOCKS_APP_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_APP_URL"),
    //     ["__BLOCKS_LOGIC_APP_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_LOGIC_APP_URL"),
    //     ["__BLOCKS_IDP_BASE_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_IDP_BASE_URL"),
    //     ["__BLOCKS_OIDC_CLIENT_ID__"] = Environment.GetEnvironmentVariable("BLOCKS_OIDC_CLIENT_ID"),
    // };

    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_API_BASE_URL__"] = "https://dev-deployment.blocksdevelopers.com",
        ["__BLOCKS_X_BLOCKS_KEY__"] = "f080a1bea04280a72149fd689d50a48c",
        ["__BLOCKS_GOOGLE_SITE_KEY__"] = "6LeE8uEqAAAAAM-9mzdFO8sajdin-DsVdxh3RT8c",
        ["__BLOCKS_CONSTRUCT_URL__"] = "https://dev-construct.seliseblocks.com",
        ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = "Ov23liqWywFtITPvQ4Z9",
        ["__BLOCKS_APP_URL__"] = "https://dev-deployment.blocksdevelopers.com",
        ["__BLOCKS_LOGIC_APP_URL__"] = "https://dev-logic.blocksdevelopers.com",
        ["__BLOCKS_IDP_BASE_URL__"] = "https://dev-idp.blocksdevelopers.com",
        ["__BLOCKS_OIDC_CLIENT_ID__"] = "6523b311-256f-4b9a-a88a-2ac4e02bad25",
    };


    var files = Directory.EnumerateFiles(webRootPath, "*", SearchOption.AllDirectories)
        .Where(path =>
        {
            var ext = Path.GetExtension(path);
            return ext.Equals(".html", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".js", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".css", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".json", StringComparison.OrdinalIgnoreCase);
        });

    foreach (var filePath in files)
    {
        var content = File.ReadAllText(filePath);
        var updated = content;

        foreach (var (token, value) in replacements)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                updated = updated.Replace(token, value, StringComparison.Ordinal);
            }
        }

        if (!ReferenceEquals(content, updated) && !content.Equals(updated, StringComparison.Ordinal))
        {
            File.WriteAllText(filePath, updated);
        }
    }
}
