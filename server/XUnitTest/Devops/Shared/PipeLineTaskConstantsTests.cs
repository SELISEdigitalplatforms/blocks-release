using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.Deployment.Models.Response;
using FluentAssertions;

namespace XUnitTest.Devops.Shared
{
    public class PipeLineTaskConstantsTests
    {
        [Fact]
        public void TerminalStatus_ContainsExpectedTerminalStates()
        {
            PipeLineTaskConstants.TermialStatus.Should().Contain("Succeeded");
            PipeLineTaskConstants.TermialStatus.Should().Contain("Failed");
            PipeLineTaskConstants.TermialStatus.Should().Contain("Cancelled");
            PipeLineTaskConstants.TermialStatus.Should().NotContain("Running");
        }

        [Fact]
        public void PriorityTaskList_HasExpectedOrder()
        {
            PipeLineTaskConstants.PriorityTaskList.Should().Equal("fetch-source", "build-push", "deploy-app");
        }

        [Fact]
        public void EventGroupMapping_MapsTasksToGroups()
        {
            PipeLineTaskConstants.EventGroupMapping["fetch-source"].Should().Be("Clone");
            PipeLineTaskConstants.EventGroupMapping["build-push"].Should().Be("Build");
            PipeLineTaskConstants.EventGroupMapping["deploy-app"].Should().Be("Deploy");
            PipeLineTaskConstants.EventGroupMapping["sonar-scan"].Should().Be("Sast");
            PipeLineTaskConstants.EventGroupMapping["trivy-image-scan"].Should().Be("Sca");
        }

        [Fact]
        public void StatusEventMapping_MapsStatusesToEventTypes()
        {
            PipeLineTaskConstants.StatusEventMapping["Succeeded"].Should().Be(EventTypes.EventFinished);
            PipeLineTaskConstants.StatusEventMapping["Failed"].Should().Be(EventTypes.EventFailed);
            PipeLineTaskConstants.StatusEventMapping["Running"].Should().Be(EventTypes.Log);
            PipeLineTaskConstants.StatusEventMapping["Pending"].Should().Be(EventTypes.EventStarted);
            PipeLineTaskConstants.StatusEventMapping["Cancelled"].Should().Be(EventTypes.EventCancelled);
            PipeLineTaskConstants.StatusEventMapping["PipelineRunTimeout"].Should().Be(EventTypes.EventFailed);
        }

        [Fact]
        public void EventNames_ExposeExpectedConstants()
        {
            EventNames.PIPELINE.Should().Be("Pipeline");
            EventNames.CLONE.Should().Be("Clone");
            EventNames.DEPLOY.Should().Be("Deploy");
            EventNames.UNKNOWN.Should().Be("Unknown");
        }

        [Fact]
        public void EventStatus_ExposeExpectedConstants()
        {
            EventStatus.QUEUED.Should().Be("Queued");
            EventStatus.SUCCEEDED.Should().Be("Succeeded");
            EventStatus.FAILED.Should().Be("Failed");
            EventStatus.TIMEOUT.Should().Be("Timeout");
        }
    }
}
