namespace Devops.DomainService.Shared.Models
{
    /// <summary>
    /// Payload of the <c>blocks_release_project_delete_listener</c> queue.
    ///
    /// <see cref="TenantGroupId"/> is mandatory; the other two only narrow it:
    /// <list type="bullet">
    /// <item><description>group -> every repository of every project in the group</description></item>
    /// <item><description>group + project -> every repository of that one project</description></item>
    /// <item><description>group + project + resource -> that single repository</description></item>
    /// <item><description>group + resource -> that resource's repository in every project of the group</description></item>
    /// </list>
    ///
    /// A message with no group is a no-op, including a bare <see cref="ProjectId"/> or a bare
    /// <see cref="ResourceId"/>. The group is what says which set of tenant databases this message is
    /// allowed to reach, so one that omits it is dropped rather than guessed at.
    /// </summary>
    public class ProjectDeleteQueue
    {
        /// <summary>Required. Without it nothing is torn down.</summary>
        public string TenantGroupId { get; set; }

        /// <summary>The tenant id of a single project (environment), matching <c>Tenant.TenantId</c>.</summary>
        public string ProjectId { get; set; }

        /// <summary>Matches <c>Repo.SourceRepoId</c> - the id of the resource the repository was imported from.</summary>
        public string ResourceId { get; set; }
    }
}
