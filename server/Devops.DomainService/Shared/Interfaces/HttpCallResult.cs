using System.Net;

namespace Devops.DomainService.Shared.Interfaces;

/// <summary>
/// The answer to one call made through <see cref="IHttpHelperServices.SendWithTimeoutAsync"/>: the status and
/// body the server sent, or no status at all when the call timed out or failed at the network level.
/// </summary>
public sealed record HttpCallResult(HttpStatusCode? StatusCode, string? Body)
{
    /// <summary>True when no answer came back: a timeout or a network failure, never a status to act on.</summary>
    public bool TransportFailed => StatusCode is null;

    public static HttpCallResult NoAnswer() => new(null, null);
}
