using Devops.DomainService.Deployment.Entities;

namespace Devops.DomainService.Deployment.Interfaces
{
    /// <summary>
    /// Reads and writes heartbeat (InboundPing) entries in blocks-monitor's "MonitorConfigurations"
    /// collection in the shared root database. Rules live in <see cref="IHeartbeatConfigurationService"/>.
    /// </summary>
    public interface IHeartbeatConfigurationStore
    {
        /// <summary>The heartbeat with this id, or null when there is none (or it is not a heartbeat).</summary>
        Task<MonitorConfiguration?> GetAsync(string itemId);

        /// <summary>
        /// Sets only the editable fields, so fields release's mirror entity does not know about
        /// (incident state, recipients, ...) are left untouched.
        /// </summary>
        Task UpdateEditableFieldsAsync(MonitorConfiguration heartbeat);

        Task<bool> DeleteAsync(string itemId);
    }
}
