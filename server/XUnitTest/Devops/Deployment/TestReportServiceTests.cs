using System.Threading.Tasks;
using Devops.DomainService.Deployment.Entities;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    public class TestReportServiceTests
    {
        private readonly DeploymentServiceFactory _f = new();

        [Fact]
        public async Task GetReport_Dast_ReturnsReport()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "org/r", Branch = "main" });
            var result = await _f.TestReportService().GetReport("b1", "dast");
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetReport_Sast_ReturnsReport()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "org/r", Branch = "main" });
            var result = await _f.TestReportService().GetReport("b1", "sast");
            result.Should().NotBeNull();
            result.Type.Should().Be("SAST");
        }

        [Fact]
        public async Task GetReport_UnknownType_ReturnsNull()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "org/r", Branch = "main" });
            var result = await _f.TestReportService().GetReport("b1", "unknown");
            result.Should().BeNull();
        }
    }
}
