using System.Text.Json.Serialization;

namespace Devops.DomainService.VersionControlSystems.Models.Response;

public class GithubRepositoryResponse
{
    public int id { get; set; }
    public string name { get; set; }
    [JsonPropertyName("full_name")]
    public string fullName { get; set; }
    [JsonPropertyName("html_url")]
    public string url { get; set; }
}
