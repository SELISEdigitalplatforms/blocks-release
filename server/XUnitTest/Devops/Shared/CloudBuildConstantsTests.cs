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
            var config = CloudBuildConstants.GetApiMessageConfiguration("amqp://guest:guest@localhost:5672");

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
    }
}
