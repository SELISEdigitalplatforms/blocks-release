namespace Devops.DomainService.Deployment.Models.Response;

/// <summary>
/// What a single queue-driven teardown actually did. Nothing consumes this over the wire - it exists so
/// the worker can log one line for the whole message instead of leaving the outcome spread across
/// per-repository entries, and so tests can assert on the outcome rather than on log text.
/// </summary>
public class DeploymentTeardownSummary
{
    public int ProjectsVisited { get; set; }

    /// <summary>Live repositories the message resolved to, across every project visited.</summary>
    public int ReposMatched { get; set; }

    /// <summary>Repositories that had a recorded namespace and whose teardown succeeded.</summary>
    public int DeploymentsDeleted { get; set; }

    public int ReposArchived { get; set; }

    /// <summary>
    /// Archived repositories whose secret set was also soft-deleted. Lower than
    /// <see cref="ReposArchived"/> is normal - most repositories have no secrets at all.
    /// </summary>
    public int SecretsDeleted { get; set; }

    /// <summary>One entry per repository that could not be torn down. The run continues past each.</summary>
    public List<string> Failures { get; } = [];

    public bool HasFailures => Failures.Count > 0;
}
