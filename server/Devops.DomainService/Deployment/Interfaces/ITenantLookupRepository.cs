using Blocks.Genesis;

namespace Devops.DomainService.Deployment.Interfaces;

/// <summary>
/// Reads the root Tenants collection. Projects (one per environment) are owned and written by
/// blocks-os; this service only ever resolves them so it knows which tenant databases to visit.
/// </summary>
public interface ITenantLookupRepository
{
    /// <summary>Every project in a tenant group, in no particular order. Empty when the group is unknown.</summary>
    public Task<List<Tenant>> GetProjectsByGroupAsync(string tenantGroupId);

    /// <summary>A single project by its tenant id, or null when it does not exist.</summary>
    public Task<Tenant?> GetProjectAsync(string projectId);
}
