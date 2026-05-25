using Blocks.Genesis;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Shared.Models;

namespace Worker.Consumers
{
    public class LogNotificationConsumer : IConsumer<LogNotificationQueue>
    {
        private readonly INotificationService _notificationService;

        public LogNotificationConsumer(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        public async Task Consume(LogNotificationQueue task)
        {
            await _notificationService.NotifyPipeLineLogData(task.Message, task.UserIds, task.TenantId, task.RepoId, task.BuildStatus);
        }
    }
}
