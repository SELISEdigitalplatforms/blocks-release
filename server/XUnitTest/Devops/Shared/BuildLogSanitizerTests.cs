using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Devops.Shared
{
    public class BuildLogSanitizerTests
    {
        // Shape of Kaniko's output when the registry rejects its login; names and ids are made up.
        private const string RegistryLoginRejected =
            "error checking push permissions -- make sure you entered the correct tag name, and that you are "
            + "authenticated correctly, and try again: checking push permission for "
            + "\"example.azurecr.io/team/app:1b2c3d4e\": creating push check transport for example.azurecr.io failed: "
            + "GET https://example.azurecr.io/oauth2/token?scope=repository%3Ateam%2Fapp%3Apush%2Cpull&service=example.azurecr.io: "
            + "UNAUTHORIZED: Application not registered with AAD. CorrelationId: 00000000-0000-0000-0000-000000000000";

        // Shape of the SonarQube scanner's output when the shared build volume is full.
        private const string VolumeFull =
            "05:45:13.265 ERROR Error during SonarScanner Engine execution\n"
            + "java.lang.IllegalStateException: Unable to store file source in the report\n"
            + "Caused by: java.io.FileNotFoundException: /workspace/source/.scannerwork/scanner-report/source-938.txt (No space left on device)\n"
            + "05:45:13.618 INFO  EXECUTION FAILURE\n";

        [Fact]
        public void Sanitize_RegistryLoginRejected_ReplacesWholeLogWithContactAdministrator()
        {
            var log = "2026/11/08 05:40:51 Skipping step because a previous step failed\n" + RegistryLoginRejected + "\n";

            var result = BuildLogSanitizer.Sanitize(log);

            result.Text.Should().Be(BuildLogSanitizer.ContactAdministrator);
            result.Text.Should().NotContainAny("azurecr", "oauth2", "AAD", "CorrelationId", "push");
            result.MatchedRule!.Contains.Should().Be("error checking push permissions");
            result.MatchedLine.Should().Be(RegistryLoginRejected);
        }

        [Fact]
        public void Sanitize_VolumeFull_ReplacesWholeLogWithContactAdministrator()
        {
            var result = BuildLogSanitizer.Sanitize(VolumeFull);

            result.Text.Should().Be(BuildLogSanitizer.ContactAdministrator);
            result.Text.Should().NotContain("/workspace");
            result.MatchedLine.Should().StartWith("Caused by: java.io.FileNotFoundException");
        }

        [Fact]
        public void Sanitize_ReplaceRule_IgnoresCase()
        {
            BuildLogSanitizer.Sanitize("write failed: NO SPACE LEFT ON DEVICE").Text
                .Should().Be(BuildLogSanitizer.ContactAdministrator);
        }

        [Fact]
        public void Sanitize_RegistryAddressInNormalOutput_IsMaskedAndRestKept()
        {
            var result = BuildLogSanitizer.Sanitize("INFO[0042] Pushing image to example.azurecr.io/team/app:1b2c3d4e\n");

            result.Text.Should().Be("INFO[0042] Pushing image to ***\n");
            result.MatchedRule.Should().BeNull();
            result.MatchedLine.Should().BeNull();
        }

        [Fact]
        public void Sanitize_UserBuildOutput_IsUnchanged()
        {
            const string log = "npm ERR! code ELIFECYCLE\nnpm ERR! errno 1\nnpm ERR! app@1.0.0 build: `vite build`\n";

            var result = BuildLogSanitizer.Sanitize(log);

            result.Text.Should().Be(log);
            result.MatchedRule.Should().BeNull();
        }

        [Fact]
        public void Sanitize_GithubUrlsAndNamespaces_AreStillMasked()
        {
            var result = BuildLogSanitizer.Sanitize("cloning https://github.com/org/secret-repo.git\nnamespace tenant-secret\n");

            result.Text.Should().NotContainAny("github.com", "secret-repo", "tenant-secret");
            result.Text.Should().Contain("**").And.Contain("namespace ***");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Sanitize_NoLog_ReturnsEmpty(string? log)
        {
            var result = BuildLogSanitizer.Sanitize(log);

            result.Text.Should().BeEmpty();
            result.MatchedRule.Should().BeNull();
        }

        [Fact]
        public void Sanitize_MatchedLine_IsCappedForTheServerLog()
        {
            var result = BuildLogSanitizer.Sanitize("No space left on device " + new string('x', 5000));

            result.MatchedLine!.Length.Should().Be(1000);
        }

        [Fact]
        public void Rules_AreNeverBlank()
        {
            // A blank replace rule would hide every build log, a blank mask pattern would match everywhere.
            BuildLogSanitizer.ReplaceRules.Should().OnlyContain(r =>
                !string.IsNullOrWhiteSpace(r.Contains) && !string.IsNullOrWhiteSpace(r.Message));
            BuildLogSanitizer.MaskRules.Should().OnlyContain(r => !string.IsNullOrWhiteSpace(r.Pattern));
        }
    }
}
