using Microsoft.AspNetCore.SignalR;

namespace BlocksTemplate.Api.Hubs
{
    public class DeploymentLogHub : Hub
    {
        public const string UserIdQueryKey = "userId";

        public override async Task OnConnectedAsync()
        {
            var userId = Context.GetHttpContext()?.Request.Query[UserIdQueryKey].ToString();
            if (!string.IsNullOrWhiteSpace(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.GetHttpContext()?.Request.Query[UserIdQueryKey].ToString();
            if (!string.IsNullOrWhiteSpace(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            }
            await base.OnDisconnectedAsync(exception);
        }
    }
}
