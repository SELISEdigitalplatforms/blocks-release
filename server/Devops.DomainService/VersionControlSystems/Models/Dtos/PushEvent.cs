using System.Text.Json.Serialization;
using Devops.DomainService.VersionControlSystems.Models.Response;

namespace Devops.DomainService.VersionControlSystems.Models.Dtos;

public class PushEvent
{

    [JsonPropertyName("ref")]
    public string Ref { get; set; }
    public GithubRepositoryResponse repository { get; set; }
    public List<Commit> commits { get; set; }
    public Pusher pusher { get; set; }

}

public class Pusher
{
    public string name { get; set; }
    public string username { get; set; }
}