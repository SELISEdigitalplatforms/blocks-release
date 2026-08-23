using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Devops.DomainService.PipelinerunBuilders;
using FluentAssertions;

namespace XUnitTest.Devops.PipelinerunBuilders
{
    public class PipelineRunSettingsTests
    {
        private static string[] ParamNames => new[]
        {
            "repo-url", "image-reference", "revision", "app-name", "namespace",
            "username", "domains", "cpu", "memory", "sonar-project-key", "extra-args"
        };

        private static IDictionary<string, object> BuildRoot()
        {
            var paramList = new List<object>();
            foreach (var name in ParamNames)
            {
                paramList.Add(new Dictionary<object, object>
                {
                    ["name"] = name,
                    ["value"] = ""
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
        public void Build_AppliesRepoUrlWithAccessToken()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setAccessToken("tok123")
                .setRepoUrl("https://github.com/org/repo.git");

            var result = settings.build();

            GetParamValue(result, "repo-url").Should().Be("https://tok123@github.com/org/repo.git");
        }

        [Fact]
        public void Build_AppliesRepoUrlWithoutAccessToken()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setRepoUrl("https://github.com/org/repo.git");

            var result = settings.build();

            GetParamValue(result, "repo-url").Should().Be("https://github.com/org/repo.git");
        }

        [Fact]
        public void Build_HttpRepoUrlWithToken_PreservesScheme()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setAccessToken("abc")
                .setRepoUrl("http://example.com/repo.git");

            var result = settings.build();

            GetParamValue(result, "repo-url").Should().Be("http://abc@example.com/repo.git");
        }

        [Fact]
        public void SetAppName_FormatsAndLowercases()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setAppName("My App!Name");

            var result = settings.build();

            GetParamValue(result, "app-name").Should().Be("my-app-name");
        }

        [Fact]
        public void SetAppName_Null_GeneratesUnknownName()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setAppName(null);

            var result = settings.build();

            GetParamValue(result, "app-name").ToString().Should().StartWith("unknown-");
        }

        [Fact]
        public void SetMetadataNamespace_AppliedToMetadataName()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setMetadataNamespace("myrun");

            var result = settings.build();

            var metadata = (IDictionary<object, object>)result["metadata"];
            metadata["name"].Should().Be("myrun");
        }

        [Fact]
        public void SetDomain_StripsSchemeAndJoins()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setDomain("https://Default.com", "http://Custom.com");

            var result = settings.build();

            GetParamValue(result, "domains").Should().Be("default.com,custom.com");
        }

        [Fact]
        public void SetDomain_BlankCustom_OnlyDefault()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setDomain("https://only.com", "   ");

            var result = settings.build();

            GetParamValue(result, "domains").Should().Be("only.com");
        }

        [Fact]
        public void SetParamNamespace_UsesRepoLastSegmentAndSetsSonarKey()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setAppName("myapp")
                .setParamNamespace("user1", "https://github.com/org/myrepo");

            var result = settings.build();

            GetParamValue(result, "namespace").Should().Be("myapp-myrepo");
            GetParamValue(result, "sonar-project-key").Should().Be("myapp-myrepo");
        }

        [Fact]
        public void SetSimpleValues_AreApplied()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setImageReference("img:1")
                .setBranchName("dev")
                .setUsername("alice")
                .setCpu("500m")
                .setMemory("256Mi");

            var result = settings.build();

            GetParamValue(result, "image-reference").Should().Be("img:1");
            GetParamValue(result, "revision").Should().Be("dev");
            GetParamValue(result, "username").Should().Be("alice");
            GetParamValue(result, "cpu").Should().Be("500m");
            GetParamValue(result, "memory").Should().Be("256Mi");
        }

        [Fact]
        public void SetCliBuildEnv_MapsKnownBranchToEnvironment()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main");

            var result = settings.build();

            var value = GetParamValue(result, "extra-args") as IList<object>;
            value.Should().NotBeNull();
            value.Should().Contain("--build-arg");
            value.Should().Contain("ci_build=prod");
        }

        [Fact]
        public void SetCliBuildEnv_UnknownBranch_UsesRawValue()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("feature-x");

            var result = settings.build();

            var value = GetParamValue(result, "extra-args") as IList<object>;
            value.Should().Contain("ci_build=feature-x");
        }

        // ---- extra build args forwarded from the repository secret set ----

        [Fact]
        public void SetExtraBuildArgs_AppendsPairsAfterCiBuild()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main")
                .setExtraBuildArgs(new Dictionary<string, string>
                {
                    ["VITE_BLOCKS_EXTRA_ARG"] = "NBM"
                });

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            // ci_build stays first, so a Dockerfile that reads it is unaffected by the addition.
            args.Should().Equal(
                "--build-arg", "ci_build=prod",
                "--build-arg", "VITE_BLOCKS_EXTRA_ARG=NBM");
        }

        [Fact]
        public void SetExtraBuildArgs_EmptySet_LeavesTheRunUnchanged()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main")
                .setExtraBuildArgs(new Dictionary<string, string>());

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            args.Should().Equal("--build-arg", "ci_build=prod");
        }

        [Fact]
        public void SetExtraBuildArgs_Null_IsTreatedAsNoArgs()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main")
                .setExtraBuildArgs(null);

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            args.Should().Equal("--build-arg", "ci_build=prod");
        }

        /// <summary>
        /// A value carrying an equals sign, a space or a comma stays one argv entry. kaniko splits
        /// KEY=VALUE on the first equals, so the rest reaches the Dockerfile verbatim.
        /// </summary>
        [Fact]
        public void SetExtraBuildArgs_PreservesValuesVerbatim()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main")
                .setExtraBuildArgs(new Dictionary<string, string>
                {
                    ["VITE_API_URL"] = "https://api.example.com/?a=1&b=2",
                    ["VITE_TITLE"] = "Hello World, again"
                });

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            args.Should().Contain("VITE_API_URL=https://api.example.com/?a=1&b=2");
            args.Should().Contain("VITE_TITLE=Hello World, again");
        }

        [Fact]
        public void SetExtraBuildArgs_BlankKey_IsSkipped()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setCliBuildEnv("main")
                .setExtraBuildArgs(new Dictionary<string, string>
                {
                    ["   "] = "orphan",
                    ["VITE_KEPT"] = "yes"
                });

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            args.Should().Equal(
                "--build-arg", "ci_build=prod",
                "--build-arg", "VITE_KEPT=yes");
        }

        /// <summary>
        /// Without a build env there is nothing to write, so the source document keeps whatever
        /// extra-args it shipped with - the behaviour a run had before repository args existed.
        /// </summary>
        [Fact]
        public void NoBuildEnvAndNoExtraArgs_LeavesTheDocumentValue()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root);

            var value = settings.build();

            GetParamValue(value, "extra-args").Should().Be("");
        }

        /// <summary>
        /// Repository args do not need a build env to travel.
        /// </summary>
        [Fact]
        public void SetExtraBuildArgs_WithoutBuildEnv_StillWritesThePairs()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setExtraBuildArgs(new Dictionary<string, string> { ["VITE_ONLY"] = "1" });

            var value = settings.build();

            var args = (GetParamValue(value, "extra-args") as IList<object>)
                .Select(x => x?.ToString()).ToList();

            args.Should().Equal("--build-arg", "VITE_ONLY=1");
        }

        [Fact]
        public void SetSonarQubeProjectKey_ReplacesSlashesWithDash()
        {
            var root = BuildRoot();
            var settings = new PipelineRunSettings(root)
                .setSonarQubeProjectKey("org/repo");

            var result = settings.build();

            GetParamValue(result, "sonar-project-key").Should().Be("org-repo");
        }

        [Fact]
        public void Build_MissingApiVersion_Throws()
        {
            var root = BuildRoot();
            root.Remove("apiVersion");
            var settings = new PipelineRunSettings(root);

            Action act = () => settings.build();

            act.Should().Throw<InvalidDataException>();
        }

        [Fact]
        public void Build_WrongKind_Throws()
        {
            var root = BuildRoot();
            root["kind"] = "Task";
            var settings = new PipelineRunSettings(root);

            Action act = () => settings.build();

            act.Should().Throw<InvalidDataException>();
        }

        [Fact]
        public void ApplyParams_MissingSpec_Throws()
        {
            var root = BuildRoot();
            root.Remove("spec");
            var settings = new PipelineRunSettings(root).setRepoUrl("https://github.com/x/y");

            Action act = () => settings.build();

            act.Should().Throw<InvalidDataException>();
        }
    }
}
