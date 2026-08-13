using System.Linq;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;

namespace XUnitTest.Devops.Shared
{
    public class CloudBuildConstantsTests
    {
        [Fact]
        public void Constants_HaveExpectedValues()
        {
            CloudBuildConstants.NAMESPACE_NAME.Should().Be("tekton-pipelines");
            CloudBuildConstants.GITHUB_BASE_URI.Should().Be("https://github.com");
            CloudBuildConstants.GITHUB_API_BASE_URI.Should().Be("https://api.github.com");
            CloudBuildConstants.POST_BUILD_LISTENER.Should().Be("blocks_release_post_build_listener");
            CloudBuildConstants.PROJECT_DELETE_LISTENER.Should().Be("blocks_release_project_delete_listener");
            CloudBuildConstants.SONARQUBE_PERMISSIONS.Should().Contain("user");
            CloudBuildConstants.SAST_METRIC_KEYS.Should().Contain("bugs");
        }

        [Fact]
        public void BranchToEnvironmentMap_MapsKnownBranches_CaseInsensitive()
        {
            CloudBuildConstants.BranchToEnvironmentMap["main"].Should().Be("prod");
            CloudBuildConstants.BranchToEnvironmentMap["MAIN"].Should().Be("prod");
            CloudBuildConstants.BranchToEnvironmentMap["pre-prod"].Should().Be("preprod");
            CloudBuildConstants.BranchToEnvironmentMap["prod-shadow"].Should().Be("prodshadow");
            CloudBuildConstants.BranchToEnvironmentMap.ContainsKey("nonexistent").Should().BeFalse();
        }

        [Fact]
        public void GetApiMessageConfiguration_AmqpConnection_UsesRabbitMq()
        {
            var config = CloudBuildConstants.GetApiMessageConfiguration("amqp://<username>:<password>@localhost:5672");

            config.RabbitMqConfiguration.Should().NotBeNull();
            config.RabbitMqConfiguration.ConsumerSubscriptions.Should().NotBeEmpty();
        }

        [Fact]
        public void GetApiMessageConfiguration_NonAmqpConnection_UsesAzure()
        {
            var config = CloudBuildConstants.GetApiMessageConfiguration("Endpoint=sb://foo.servicebus.windows.net/");

            config.AzureServiceBusConfiguration.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Queues.Should().Contain(CloudBuildConstants.POST_BUILD_LISTENER);
        }

        [Fact]
        public void GetWorkerMessageConfiguration_AmqpsConnection_UsesRabbitMq()
        {
            var config = CloudBuildConstants.GetWorkerMessageConfiguration("amqps://host:5671");

            config.RabbitMqConfiguration.Should().NotBeNull();
        }

        [Fact]
        public void GetWorkerMessageConfiguration_PlainString_UsesAzure()
        {
            var config = CloudBuildConstants.GetWorkerMessageConfiguration("not-a-uri");

            config.AzureServiceBusConfiguration.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Queues.Should().Contain(CloudBuildConstants.POST_BUILD_LISTENER);
        }

        [Fact]
        public void GetWorkerMessageConfiguration_BindsTheProjectDeleteQueue()
        {
            CloudBuildConstants.GetWorkerMessageConfiguration("not-a-uri")
                .AzureServiceBusConfiguration.Queues.Should().Contain(CloudBuildConstants.PROJECT_DELETE_LISTENER);

            CloudBuildConstants.GetWorkerMessageConfiguration("amqps://host:5671")
                .RabbitMqConfiguration.ConsumerSubscriptions.Should().HaveCount(2);
        }

        /// <summary>
        /// The API has no consumer for the project-delete message. Binding it there would let the broker
        /// hand the API a delete it silently drops, so the queue must stay off the API configuration.
        /// </summary>
        [Fact]
        public void GetApiMessageConfiguration_DoesNotBindTheProjectDeleteQueue()
        {
            CloudBuildConstants.GetApiMessageConfiguration("Endpoint=sb://foo.servicebus.windows.net/")
                .AzureServiceBusConfiguration.Queues.Should().NotContain(CloudBuildConstants.PROJECT_DELETE_LISTENER);
        }
    }
}
