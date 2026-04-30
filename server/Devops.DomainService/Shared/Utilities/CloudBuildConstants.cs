using Blocks.Genesis;

namespace Devops.DomainService.Shared.Utilities
{
    public class CloudBuildConstants
    {
        public static readonly string NAMESPACE_NAME = "tekton-pipelines";
        public static readonly string YAML_PATH = Path.Combine(AppContext.BaseDirectory, "Assets" , "pipeline_fe_react_construct.yaml");
        public static readonly string DATAGETWAY_YAML_PATH = Path.Combine(AppContext.BaseDirectory, "Assets" , "pipeline_run_uds.yaml");
        public static readonly string GITHUB_BASE_URI = "https://github.com";
        public static readonly string GITHUB_API_BASE_URI = "https://api.github.com";
        public static readonly string SAST_TOOLS_API_BASE_URI = "https://code.selise.biz/api";
        public static readonly string SCA_TOOLS_API_BASE_URI = "https://api-dt.seliseblocks.com";
        public static readonly string NOTIFICATION_LISTENER = "blocks_cloudbuild_notification_listener_asif_local";
        public static readonly string POST_BUILD_LISTENER = "blocks_cloudbuild_post_build_listener_asif_local";
        public static readonly string ProjectCreateSuccessQueue = "blocks_identifier_project_create_listener_asif_local";

        public static readonly string[] SAST_METRIC_KEYS = new string[]
        {
            "alert_status",
            "quality_gate_details",
            "violations",
            "new_violations",
            "accepted_issues",
            "new_accepted_issues",
            "bugs",
            "reliability_rating",
            "software_quality_reliability_rating",
            "security_rating",
            "software_quality_security_rating",
            "security_hotspots",
            "new_security_hotspots",
            "code_smells",
            "new_code_smells",
            "sqale_rating",
            "new_technical_debt",
            "coverage",
            "new_coverage",
            "lines_to_cover",
            "new_lines_to_cover",
            "duplicated_lines_density",
            "new_duplicated_lines_density",
            "duplicated_lines",
            "new_duplicated_lines",
            "ncloc",
            "lines",
            "new_lines"
        };
        public static readonly Dictionary<string, string> BranchToEnvironmentMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "dev", "dev" },
            { "test", "test" },
            { "stg", "stg" },
            { "iat", "iat" },
            { "uat", "uat" },
            { "prod-shadow", "prodshadow" },
            { "pre-prod", "preprod" },
            { "main", "prod" }
        };

        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";

        public static MessageConfiguration GetApiMessageConfiguration(string messageConnectionString)
        {
            var provider = GetProvider(messageConnectionString);

            return provider switch
            {
                RabbitMqProvider => new MessageConfiguration
                {
                    RabbitMqConfiguration = new RabbitMqConfiguration
                    {
                        ConsumerSubscriptions =
                        [
                            ConsumerSubscription.BindToQueue(NOTIFICATION_LISTENER),
                            ConsumerSubscription.BindToQueue(POST_BUILD_LISTENER)
                        ]
                    }
                },
                _ => new MessageConfiguration
                {
                    AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                    {
                        Queues = [NOTIFICATION_LISTENER, POST_BUILD_LISTENER],
                        Topics = []
                    }
                }
            };
        }

        public static MessageConfiguration GetWorkerMessageConfiguration(string messageConnectionString)
        {
            var provider = GetProvider(messageConnectionString);

            return provider switch
            {
                RabbitMqProvider => new MessageConfiguration
                {
                    RabbitMqConfiguration = new RabbitMqConfiguration
                    {
                        ConsumerSubscriptions =
                        [
                            ConsumerSubscription.BindToQueue(NOTIFICATION_LISTENER),
                            ConsumerSubscription.BindToQueue(POST_BUILD_LISTENER),
                            ConsumerSubscription.BindToQueue(ProjectCreateSuccessQueue)
                        ]
                    }
                },
                _ => new MessageConfiguration
                {
                    AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                    {
                        Queues = [NOTIFICATION_LISTENER, POST_BUILD_LISTENER, ProjectCreateSuccessQueue],
                        Topics = []
                    }
                }
            };
        }

        private static string GetProvider(string messageConnectionString)
        {
            if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri))
            {
                if (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
                    uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase))
                {
                    return RabbitMqProvider;
                }
            }

            return DefaultProvider;
        }
    }
}
