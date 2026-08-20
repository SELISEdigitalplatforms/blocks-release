using System.Net;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Manages the secret key/value set attached to a repository.
/// </summary>
/// <remarks>
/// Routing and envelopes only. Every rule - validation, tenant scope, status, audit - lives in
/// <see cref="IRepoSecretService"/> and the secrets package beneath it, and domain failures reach
/// the client through <c>SecretExceptionFilter</c> rather than through try/catch here.
/// <para>
/// Every action is keyed on a repository id. None accepts a secret id, so a caller cannot address
/// a secret that does not belong to a repository their tenant can see.
/// </para>
/// </remarks>
[ApiController]
[Route("[controller]")]
public class RepoSecretController : ControllerBase
{
    private readonly IRepoSecretService _repoSecretService;

    public RepoSecretController(IRepoSecretService repoSecretService)
    {
        _repoSecretService = repoSecretService;
    }

    /// <summary>Creates or replaces the repository's whole secret set.</summary>
    [HttpPost("save")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Save([FromBody] RepoSecretSaveRequest request, CancellationToken cancellationToken)
    {
        var result = await _repoSecretService.SaveAsync(request, cancellationToken);
        return Ok(Success(result));
    }

    /// <summary>Metadata only. Never returns a value or a key name.</summary>
    [HttpGet("get")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Get([FromQuery] string repoId, CancellationToken cancellationToken)
    {
        var result = await _repoSecretService.GetMetaAsync(repoId, cancellationToken);
        return Ok(Success(result));
    }

    /// <summary>Reads the plaintext set. Audited server-side on every call.</summary>
    [HttpGet("value")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Value([FromQuery] string repoId, CancellationToken cancellationToken)
    {
        var result = await _repoSecretService.GetValueAsync(repoId, cancellationToken);

        // The body carries plaintext, so keep it out of every cache between here and the browser.
        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        Response.Headers.Pragma = "no-cache";

        return Ok(Success(result));
    }

    [HttpPost("lock")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Lock([FromBody] RepoSecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _repoSecretService.LockAsync(request.RepoId, cancellationToken);
        return Ok(Success(null));
    }

    /// <summary>Unlocks. Shares the manage permission - lock and unlock are one capability.</summary>
    [HttpPost("unlock")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Unlock([FromBody] RepoSecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _repoSecretService.UnlockAsync(request.RepoId, cancellationToken);
        return Ok(Success(null));
    }

    /// <summary>Soft-deletes. The vault value is retained so restore works.</summary>
    [HttpDelete("delete")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Delete([FromQuery] string repoId, CancellationToken cancellationToken)
    {
        await _repoSecretService.DeleteAsync(repoId, cancellationToken);
        return Ok(Success(null));
    }

    [HttpPost("restore")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Restore([FromBody] RepoSecretIdRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await _repoSecretService.RestoreAsync(request.RepoId, cancellationToken);
        return Ok(Success(null));
    }

    [HttpGet("audit")]
    // [ProtectedEndPoint("blocks-release::repo-secret::manage")]
    [Authorize]
    public async Task<IActionResult> Audit(
        [FromQuery] string repoId,
        [FromQuery] SecretAuditFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await _repoSecretService.GetAuditLogsAsync(repoId, filter, cancellationToken);
        return Ok(Success(result));
    }

    private static BaseApiResponse Success(object data) =>
        new() { Data = data, IsSuccess = true, StatusCode = HttpStatusCode.OK };
}
