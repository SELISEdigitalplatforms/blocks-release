namespace Devops.DomainService.Deployment.Models.Response
{
    public class GithubWebhookError
    {
        public string? resource { get; set; }
        public string? code { get; set; }
        public string? message { get; set; }
    }

    public class GithubWebhookConfig
    {
        public string? url { get; set; }
        public string? content_type { get; set; }
        public string? insecure_ssl { get; set; }
    }

    public class GithubWebhookSuccessResponse
    {
        public string? type { get; set; }
        public long id { get; set; }
        public string? name { get; set; }
        public bool active { get; set; }
        public List<string>? events { get; set; }
        public GithubWebhookConfig? config { get; set; }
        public DateTime? updated_at { get; set; }
        public DateTime? created_at { get; set; }
        public string? url { get; set; }
        public string? test_url { get; set; }
        public string? ping_url { get; set; }
    }

    public class GithubWebhookErrorResponse
    {
        public string? message { get; set; }
        public List<GithubWebhookError>? errors { get; set; }
        public string? documentation_url { get; set; }
        public string? status { get; set; }
    }
}
