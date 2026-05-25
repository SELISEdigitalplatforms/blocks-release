namespace Devops.DomainService.Deployment.Models.Response;

public class BuildEventResponse
{
    public string? Id { get; set; }
    public string BuildId { get; set; }
    public string EventType { get; set; }
    public string Message { get; set; }
    public string EventGroup { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastUpdateDate { get; set; } = DateTime.UtcNow;

}

public static class EventTypes
{
    public const string EventStarted = "EventStarted";
    public const string EventFinished = "EventFinished";
    public const string EventFailed = "EventFailed";
    public const string Log = "Log";
    public const string EventCancelled = "EventCancelled";

}

public static class EventGroups
{
    public const string Clone = "Clone";
    public const string Build = "Build";
    public const string Deploy = "Deploy";
    public const string Sast = "Sast";
    public const string Sca = "Sca";
    public const string Dast = "Dast";

    public static readonly List<string> EventGroupsList = new List<string>
    {
        EventGroups.Clone,
        EventGroups.Build,
        EventGroups.Deploy
    };
}
