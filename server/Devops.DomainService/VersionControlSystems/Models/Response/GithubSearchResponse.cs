using System.Text.Json.Serialization;
using Devops.DomainService.Shared.Entities;

namespace Devops.DomainService.VersionControlSystems.Models.Response;

public class GithubSearchResponse
{
    [JsonPropertyName("total_count")]
    public int TotalCount { get; set; }

    [JsonPropertyName("items")]
    public List<GithubRepositoryResponse> Items { get; set; }
}
