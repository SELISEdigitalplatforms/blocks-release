using System.Collections.Immutable;

namespace Devops.DomainService.Deployment.Models.Response;

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

    public static readonly ImmutableList<string> EventGroupsList = ImmutableList.Create(
        EventGroups.Clone,
        EventGroups.Build,
        EventGroups.Deploy);
}
