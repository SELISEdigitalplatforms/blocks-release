namespace Devops.DomainService.VersionControlSystems.Models.Request;

/// <summary>
/// What a caller needs to say to get a brand-new GitHub repository for a
/// project that has none yet — the `blocks git init` case, where the code
/// exists locally (a Studio workspace, or a `blocks new web` scaffold) and
/// there is nowhere to push it.
/// </summary>
public class CreateRepositoryRequest
{
    /// <summary>Repository name only — no owner. GitHub derives the slug.</summary>
    public string Name { get; set; }

    public string? Description { get; set; }

    /// <summary>Defaults to private: generated app source is the owner's, not the world's.</summary>
    public bool Private { get; set; } = true;

    /// <summary>
    /// Create under this organisation instead of the user's own account.
    /// Must be one of the orgs recorded on the stored token, or the call is
    /// refused before GitHub is contacted.
    /// </summary>
    public string? Organization { get; set; }
}
