using System.Text.Json.Serialization;

namespace Devops.DomainService.VersionControlSystems.Models.Response;

public class GithubUserResponse
{
    public string login { get; set; }
    public int id { get; set; }
    public string name { get; set; }
    public string email { get; set; }
    [JsonPropertyName("avatar_url")]
    public string avatarUrl { get; set; }
    [JsonPropertyName("html_url")]
    public string htmlUrl { get; set; }
}