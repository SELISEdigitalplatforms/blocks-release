using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Devops.DomainService.PipelinerunBuilders;
using FluentAssertions;

namespace XUnitTest.Devops.PipelinerunBuilders
{
    public class DataGatewayPipelineBuilderTests
    {
        private static string[] ParamNames => new[]
        {
            "project-key", "version", "cluster-names", "repo-url", "revision", "tenant-id"
        };

        private static IDictionary<string, object> BuildRoot(string repoUrlValue = "https://github.com/org/repo.git")
        {
            var paramList = new List<object>();
            foreach (var name in ParamNames)
            {
                paramList.Add(new Dictionary<object, object>
                {
                    ["name"] = name,
                    ["value"] = name == "repo-url" ? repoUrlValue : ""
                });
            }

            return new Dictionary<string, object>
            {
                ["apiVersion"] = "tekton.dev/v1beta1",
                ["kind"] = "PipelineRun",
                ["metadata"] = new Dictionary<object, object> { ["name"] = "" },
                ["spec"] = new Dictionary<object, object> { ["params"] = paramList }
            };
        }

        private static object GetParamValue(IDictionary<string, object> root, string key)
        {
            var spec = (IDictionary<object, object>)root["spec"];
            var list = (IList<object>)spec["params"];
            var item = list.OfType<IDictionary<object, object>>()
                .First(i => i["name"].ToString() == key);
            return item.TryGetValue("value", out var v) ? v : null;
        }

        [Fact]
        public void Build_AppliesAllSimpleValues()
        {
            var root = BuildRoot();
            var builder = new DataGatewayPipelineBuilder(root)
                .setMetadataName("run-1")
                .setProjectKey("proj")
                .setVersion("1.2.3")
                .setClusterNames("c1,c2")
                .setRevision("main")
                .setTenantId("tenant-9");

            var result = builder.build();

            GetParamValue(result, "project-key").Should().Be("proj");
            GetParamValue(result, "version").Should().Be("1.2.3");
            GetParamValue(result, "cluster-names").Should().Be("c1,c2");
            GetParamValue(result, "revision").Should().Be("main");
            GetParamValue(result, "tenant-id").Should().Be("tenant-9");

            var metadata = (IDictionary<object, object>)result["metadata"];
            metadata["name"].Should().Be("run-1");
        }

        [Fact]
        public void SetRepoUrl_InsertsAccessTokenIntoExistingRepoUrl()
        {
            var root = BuildRoot("https://github.com/org/repo.git");
            var builder = new DataGatewayPipelineBuilder(root)
                .setRepoUrl("tok@");

            var result = builder.build();

            GetParamValue(result, "repo-url").Should().Be("https://tok@github.com/org/repo.git");
        }

        [Fact]
        public void SetRepoUrl_HttpScheme_Preserved()
        {
            var root = BuildRoot("http://example.com/repo.git");
            var builder = new DataGatewayPipelineBuilder(root)
                .setRepoUrl("tok@");

            var result = builder.build();

            GetParamValue(result, "repo-url").Should().Be("http://tok@example.com/repo.git");
        }

        [Fact]
        public void Build_WithNothingSet_LeavesValuesUntouched()
        {
            var root = BuildRoot();
            var builder = new DataGatewayPipelineBuilder(root);

            var result = builder.build();

            GetParamValue(result, "project-key").Should().Be("");
            GetParamValue(result, "version").Should().Be("");
        }

        [Fact]
        public void ApplyParams_MissingParam_Throws()
        {
            var root = BuildRoot();
            var spec = (IDictionary<object, object>)root["spec"];
            var list = (IList<object>)spec["params"];
            var toRemove = list.OfType<IDictionary<object, object>>()
                .First(i => i["name"].ToString() == "project-key");
            list.Remove(toRemove);

            var builder = new DataGatewayPipelineBuilder(root).setProjectKey("x");

            Action act = () => builder.build();

            act.Should().Throw<InvalidDataException>();
        }

        [Fact]
        public void ApplyParams_MissingSpec_Throws()
        {
            var root = BuildRoot();
            root.Remove("spec");
            var builder = new DataGatewayPipelineBuilder(root).setProjectKey("x");

            Action act = () => builder.build();

            act.Should().Throw<InvalidDataException>();
        }
    }
}
