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

var serviceName = "blocks-deployment-api";
var vaultType = ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, vaultType);
var cloudBuildSecret = await CloudBuildSecret.ProcessBlocksSecret(vaultType);
var builder = WebApplication.CreateBuilder(args);
Console.WriteLine($"Database Connection String: {secret.DatabaseConnectionString}");
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

static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
{
    // ACTIVE path: read frontend runtime values from the "FrontendRuntime" section in
    // appsettings.{Environment}.json. Standard .NET config layering still applies, so
    // env vars named "FrontendRuntime__BLOCKS_*" override individual keys at deploy time.
    var section = configuration.GetSection("FrontendRuntime");
    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_API_BASE_URL__"] = section["BLOCKS_API_BASE_URL"],
        ["__BLOCKS_X_BLOCKS_KEY__"] = section["BLOCKS_X_BLOCKS_KEY"],
        ["__BLOCKS_GOOGLE_SITE_KEY__"] = section["BLOCKS_GOOGLE_SITE_KEY"],
        ["__BLOCKS_CONSTRUCT_URL__"] = section["BLOCKS_CONSTRUCT_URL"],
        ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = section["BLOCKS_GITHUB_SSO_CLIENT_ID"],
        ["__BLOCKS_APP_URL__"] = section["BLOCKS_APP_URL"],
        ["__BLOCKS_LOGIC_APP_URL__"] = section["BLOCKS_LOGIC_APP_URL"],
        ["__BLOCKS_IDP_BASE_URL__"] = section["BLOCKS_IDP_BASE_URL"],
        ["__BLOCKS_OS_URL__"] = section["BLOCKS_OS_URL"],
        ["__BLOCKS_OIDC_CLIENT_ID__"] = section["BLOCKS_OIDC_CLIENT_ID"],
    };

    // PREVIOUS path (kept for reference — flip back to this if we need to read bare
    // process env vars / .env files again instead of the appsettings section):
    //
    // DotNetEnv.Env.Load();
    //
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
    //     ["__BLOCKS_OS_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_OS_URL"),
    //     ["__BLOCKS_OIDC_CLIENT_ID__"] = Environment.GetEnvironmentVariable("BLOCKS_OIDC_CLIENT_ID"),
    // };

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
