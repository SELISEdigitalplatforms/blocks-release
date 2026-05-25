using System.Text.Json.Serialization;

namespace Devops.DomainService.VersionControlSystems.Models.Dtos;

public class GithubWebhookRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; }

    [JsonPropertyName("active")]
    public bool Active { get; set; }

    [JsonPropertyName("events")]
    public List<string> Events { get; set; }

    [JsonPropertyName("config")]
    public WebhookConfig Config { get; set; }

}

public class Webhook : GithubWebhookRequest
{
    public string blocksUserId { get; set; }
    public string repoName { get; set; }
    public string url { get; set; }
    [JsonPropertyName("test_url")]
    public string testUrl { get; set; }
    [JsonPropertyName("ping_url")]
    public string pingUrl { get; set; }
}


public class WebhookConfig
{
    [JsonPropertyName("url")]
    public string Url { get; set; }

    [JsonPropertyName("content_type")]
    public string ContentType { get; set; }

    [JsonPropertyName("insecure_ssl")]
    public string InsecureSsl { get; set; }
    [JsonPropertyName("secret")]
    public string Secret { get; set; }
}