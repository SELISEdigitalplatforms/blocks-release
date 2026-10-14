using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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
            result.QualityGate.Should().BeNull();
            result.IssueBreakdown.Should().BeNull();
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
            result.QualityGate.Should().BeNull();
            result.IssueBreakdown.Should().BeNull();
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
    
        private static SASTResponse MeasuresOk() => new()
        {
            Component = new Component
            {
                Measures = new List<Measure>
                {
                    new() { Metric = "alert_status", Value = "ERROR" },
                    new() { Metric = "new_violations", Value = null, Period = new Period { value = "69" } }
                }
            }
        };

        private void SetupFourCalls(
            SASTResponse measures,
            SonarProjectStatusResponse gate,
            SonarIssuesSearchResponse newIssues,
            SonarIssuesSearchResponse allIssues,
            List<string> urls = null)
        {
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((u, _, __) => urls?.Add(u))
                .ReturnsAsync((measures, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectStatusResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((u, _, __) => urls?.Add(u))
                .ReturnsAsync((gate, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarIssuesSearchResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Callback<string, string, Dictionary<string, string>>((u, _, __) => urls?.Add(u))
                .Returns((string url, string _, Dictionary<string, string> __) =>
                {
                    var payload = url.Contains("inNewCodePeriod=true") ? newIssues : allIssues;
                    return Task.FromResult((payload, ""));
                });
        }

        [Fact]
        public async Task GetInfo_H1_CallsFourEndpoints_AndMapsGate()
        {
            var urls = new List<string>();
            SetupFourCalls(
                MeasuresOk(),
                new SonarProjectStatusResponse
                {
                    ProjectStatus = new SonarProjectStatus
                    {
                        Status = "ERROR",
                        Conditions = new List<SonarGateCondition>
                        {
                            new()
                            {
                                MetricKey = "new_violations",
                                Comparator = "GT",
                                ErrorThreshold = "0",
                                ActualValue = "69",
                                Status = "ERROR"
                            }
                        }
                    }
                },
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 69 } },
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 112 } },
                urls);

            var result = await Create().getInfo("org/repo", "feature/x");

            urls.Should().HaveCount(4);
            urls.Should().Contain(u => u.Contains("measures/component") && u.Contains("component=org%2Frepo") && u.Contains("branch=feature%2Fx"));
            urls.Should().Contain(u => u.Contains("qualitygates/project_status") && u.Contains("projectKey=org%2Frepo"));
            urls.Should().Contain(u => u.Contains("issues/search") && u.Contains("inNewCodePeriod=true"));
            urls.Should().Contain(u => u.Contains("issues/search") && !u.Contains("inNewCodePeriod=true"));

            result.QualityGate.Should().NotBeNull();
            result.QualityGate.Status.Should().Be("ERROR");
            result.QualityGate.Conditions.Should().HaveCount(1);
            result.QualityGate.Conditions[0].MetricKey.Should().Be("new_violations");
            result.QualityGate.Conditions[0].ActualValue.Should().Be("69");
        }

        [Fact]
        public async Task GetInfo_H1_UnknownGateStatus_MapsToNone()
        {
            SetupFourCalls(
                MeasuresOk(),
                new SonarProjectStatusResponse
                {
                    ProjectStatus = new SonarProjectStatus { Status = "WARN", Conditions = new() }
                },
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 0 } },
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 0 } });

            var result = await Create().getInfo("org-repo", "dev");
            result.QualityGate.Status.Should().Be("NONE");
        }

        [Fact]
        public async Task GetInfo_H2_MapsIssueFacets()
        {
            SetupFourCalls(
                MeasuresOk(),
                new SonarProjectStatusResponse
                {
                    ProjectStatus = new SonarProjectStatus { Status = "OK", Conditions = new() }
                },
                new SonarIssuesSearchResponse
                {
                    Paging = new SonarPaging { Total = 69 },
                    Facets = new List<SonarFacet>
                    {
                        new()
                        {
                            Property = "impactSeverities",
                            Values = new List<SonarFacetValue>
                            {
                                new() { Val = "HIGH", Count = 3 },
                                new() { Val = "MEDIUM", Count = 40 },
                                new() { Val = "LOW", Count = 20 },
                                new() { Val = "INFO", Count = 6 }
                            }
                        }
                    }
                },
                new SonarIssuesSearchResponse
                {
                    Paging = new SonarPaging { Total = 112 },
                    Facets = new List<SonarFacet>
                    {
                        new()
                        {
                            Property = "impactSeverities",
                            Values = new List<SonarFacetValue>
                            {
                                new() { Val = "BLOCKER", Count = 1 },
                                new() { Val = "HIGH", Count = 13 }
                            }
                        }
                    }
                });

            var result = await Create().getInfo("org-repo", "dev");
            result.IssueBreakdown.NewCode.Total.Should().Be(69);
            result.IssueBreakdown.NewCode.Blocker.Should().Be(0);
            result.IssueBreakdown.NewCode.High.Should().Be(3);
            result.IssueBreakdown.NewCode.Medium.Should().Be(40);
            result.IssueBreakdown.Overall.Total.Should().Be(112);
            result.IssueBreakdown.Overall.Blocker.Should().Be(1);
            result.IssueBreakdown.Overall.High.Should().Be(13);
            result.IssueBreakdown.Overall.Medium.Should().Be(0);
        }

        [Fact]
        public async Task GetInfo_C1_GateNull_KeepsDetailsAndIssues()
        {
            SetupFourCalls(
                MeasuresOk(),
                null,
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 5 } },
                new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 9 } });

            var result = await Create().getInfo("org-repo", "dev");
            result.Details.Should().NotBeNull();
            result.QualityGate.Should().BeNull();
            result.IssueBreakdown.Should().NotBeNull();
            result.IssueBreakdown.NewCode.Total.Should().Be(5);
        }

        [Fact]
        public async Task GetInfo_C2_OneIssuesCallNull_PartialBreakdown()
        {
            var urls = new List<string>();
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((MeasuresOk(), ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectStatusResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ReturnsAsync((new SonarProjectStatusResponse
                {
                    ProjectStatus = new SonarProjectStatus { Status = "OK", Conditions = new() }
                }, ""));
            _http.Setup(h => h.MakeHttpGetRequest<SonarIssuesSearchResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .Returns((string url, string _, Dictionary<string, string> __) =>
                {
                    if (url.Contains("inNewCodePeriod=true"))
                        return Task.FromResult(((SonarIssuesSearchResponse)null, "fail"));
                    return Task.FromResult((new SonarIssuesSearchResponse { Paging = new SonarPaging { Total = 9 } }, ""));
                });

            var result = await Create().getInfo("org-repo", "dev");
            result.IssueBreakdown.Should().NotBeNull();
            result.IssueBreakdown.NewCode.Should().BeNull();
            result.IssueBreakdown.Overall.Total.Should().Be(9);
        }

        [Fact]
        public async Task GetInfo_C2_BothIssuesNull_IssueBreakdownNull()
        {
            SetupFourCalls(MeasuresOk(),
                new SonarProjectStatusResponse
                {
                    ProjectStatus = new SonarProjectStatus { Status = "OK", Conditions = new() }
                },
                null, null);

            var result = await Create().getInfo("org-repo", "dev");
            result.IssueBreakdown.Should().BeNull();
            result.QualityGate.Should().NotBeNull();
        }

        [Fact]
        public async Task GetInfo_C6_LoggerDoesNotContainToken()
        {
            var logger = new Mock<ILogger<SASTStrategy>>();
            _http.Setup(h => h.MakeHttpGetRequest<SASTResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new System.Exception("boom"));
            _http.Setup(h => h.MakeHttpGetRequest<SonarProjectStatusResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new System.Exception("boom"));
            _http.Setup(h => h.MakeHttpGetRequest<SonarIssuesSearchResponse>(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
                .ThrowsAsync(new System.Exception("boom"));

            var strategy = new SASTStrategy(_http.Object, _secret.Object, _config, logger.Object);
            await strategy.getInfo("org-repo", "dev");

            foreach (var inv in logger.Invocations)
            {
                var rendered = string.Join(" ", inv.Arguments.Select(a => a?.ToString() ?? ""));
                rendered.Should().NotContain("sast-token");
                rendered.Should().NotContain("Bearer");
            }
        }

    }
}
