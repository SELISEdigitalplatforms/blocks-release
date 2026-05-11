# SeliseBlocks.DeploymentDriver

A NuGet package that exposes deployment and repository management operations for Blocks-based applications.

## Installation

```bash
dotnet add package SeliseBlocks.DeploymentDriver
```

## Registration

```csharp
// Option 1: provide your own ICloudBuildSecret
builder.Services.RegisterBlocksDeploymentServices(cloudBuildSecret);

// Option 2: load secrets from vault automatically
await builder.Services.RegisterBlocksDeploymentServicesAsync();
```

## Usage

Inject `IDeploymentDriverService` and call any of the available methods:

```csharp
public class MyService
{
    private readonly IDeploymentDriverService _deployment;

    public MyService(IDeploymentDriverService deployment)
    {
        _deployment = deployment;
    }
}
```

## Available Operations

| Method | Description |
|--------|-------------|
| `IsAuthorizeAsync()` | Checks whether the current user has a valid access token |
| `GetAccessTokenAsync(code)` | Exchanges an OAuth authorization code for an access token |
| `RemoveAuthorizationAsync()` | Revokes the current user's OAuth access from the provider |
| `DeleteAuthorizationAsync()` | Deletes the stored access token for the current user |
| `GetReposListAsync(projectKey)` | Retrieves the list of repositories for the given project key |
