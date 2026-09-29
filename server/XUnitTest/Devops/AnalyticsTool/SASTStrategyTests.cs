using System.Collections.Generic;
using System.Threading.Tasks;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace XUnitTest.Devops.AnalyticsTool
{
    public class SASTStrategyTests
    {
        private readonly Mock<IHttpHelperServices> _http = new();
        private readonly Mock<ICloudBuildSecret> _secret = new();
        private readonly IConfiguration _config;

        public SASTStrategyTests()
        {
            _secret.SetupGet(s => s.SastBasicAuthToken).Returns("sast-token");
            _config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["SastToolsApiBaseUri"] = "https://sonar.example.com/api"
                })
                .Build();
        }

        private SASTStrategy Create() => new(_http.Object, _secret.Object, _config);

        [Fact]
        public async Task GetInfo_UsesPeriodValue_WhenMeasureValueIsNull()
        {
            // H1
            string capturedUrl = null;
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((url, _, __) => capturedUrl = url)
                .ReturnsAsync((new SASTResponse
                {
                    Component = new Component
                    {
                        Measures = new List<Measure>
                        {
                            new()
                            {
                                Metric = "new_violations",
                                Value = null,
                                Period = new Period { value = "69" }
                            }
                        }
                    }
                }, ""));

            var result = await Create().getInfo("org-repo", "dev");

            result.Details.Should().ContainKey("new_violations");
            result.Details["new_violations"].Should().Be("69");
            capturedUrl.Should().NotBeNull();
        }

        [Fact]
        public async Task GetInfo_SetsNewCodePeriodFields_AndRequestsAllKeys()
        {
            // H2
            string capturedUrl = null;
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((url, _, __) => capturedUrl = url)
                .ReturnsAsync((new SASTResponse
                {
                    Component = new Component
                    {
                        Measures = new List<Measure>
                        {
                            new() { Metric = "alert_status", Value = "OK" }
                        }
                    },
                    Period = new NewCodePeriod
                    {
                        Mode = "previous_version",
                        Date = "2026-08-10T09:12:00+0000"
                    }
                }, ""));

            var result = await Create().getInfo("org-repo", "dev");

            result.Details["new_code_period_date"].Should().Be("2026-08-10T09:12:00+0000");
            result.Details["new_code_period_mode"].Should().Be("previous_version");

            foreach (var key in new[]
            {
                "software_quality_security_issues",
                "software_quality_reliability_issues",
                "software_quality_maintainability_issues",
                "software_quality_maintainability_rating",
                "software_quality_maintainability_remediation_effort",
                "sqale_index",
                "vulnerabilities",
                "security_review_rating",
                "new_security_review_rating"
            })
            {
                capturedUrl.Should().Contain(key);
                CloudBuildConstants.SAST_METRIC_KEYS.Should().Contain(key);
            }
        }

        [Fact]
        public async Task GetInfo_NullResponse_ReturnsNullDetails()
        {
            // C1
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync(((SASTResponse)null, "Operation Failed."));

            var result = await Create().getInfo("org-repo", "dev");

            result.Type.Should().Be("SAST");
            result.Details.Should().BeNull();
        }

        [Fact]
        public async Task GetInfo_EmptyMeasures_ReturnsNullDetails()
        {
            // C1
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SASTResponse
                {
                    Component = new Component { Measures = new List<Measure>() }
                }, ""));

            var result = await Create().getInfo("org-repo", "dev");
            result.Details.Should().BeNull();
        }

        [Fact]
        public async Task GetInfo_SkipsMeasure_WhenValueAndPeriodAreNull()
        {
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SASTResponse
                {
                    Component = new Component
                    {
                        Measures = new List<Measure>
                        {
                            new() { Metric = "new_violations", Value = null, Period = null },
                            new() { Metric = "bugs", Value = "4" }
                        }
                    }
                }, ""));

            var result = await Create().getInfo("org-repo", "dev");

            result.Details.Should().NotContainKey("new_violations");
            result.Details["bugs"].Should().Be("4");
        }
    }
}
