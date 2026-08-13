# SeliseBlocks.ReleaseDriver.OS

A NuGet package that exposes release and repository management operations for Blocks-based applications.

## Installation

```bash
dotnet add package SeliseBlocks.ReleaseDriver.OS
```

## Registration

Secrets are loaded from the vault, then the domain services and the driver are registered:

```csharp
await builder.Services.RegisterBlocksReleaseServicesAsync();

// or, to read from a non-Azure vault (defaults to VaultType.Azure)
await builder.Services.RegisterBlocksReleaseServicesAsync(VaultType.OnPrem);
```

## Usage

Inject `IReleaseDriverService` and call any of the available methods:

```csharp
public class MyService
{
    private readonly IReleaseDriverService _release;

    public MyService(IReleaseDriverService release)
    {
        _release = release;
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
| `GetReposListAsync()` | Retrieves the repository list; archived repositories are excluded |
| `GetUserAsync()` | Retrieves the authenticated GitHub user |
| `SearchRepositoriesAsync(search, pageNumber, pageSize)` | Searches the authenticated user's GitHub repositories |
| `GetBranchesAsync(repo)` | Retrieves the branches for the specified GitHub repository |
| `GithubBranchExistsAsync(repoId)` | Checks whether the configured branch exists for the given repository |
| `UpdateRepoDomainAsync(request)` | Updates the custom deployment domains for the given repositories |

## Migrating from 4.x

`4.x` shipped these types under the `DeploymentDriver` name. `5.0.0` renames them to match the
package id. The rename is the only change — every method behaves exactly as it did in `4.x`.

| 4.x | 5.0.0 |
|-----|-------|
| `namespace DeploymentDriver` | `namespace ReleaseDriver` |
| `IDeploymentDriverService` | `IReleaseDriverService` |
| `DeploymentDriverService` | `ReleaseDriverService` |
| `RegisterBlocksDeploymentServicesAsync()` | `RegisterBlocksReleaseServicesAsync()` |
