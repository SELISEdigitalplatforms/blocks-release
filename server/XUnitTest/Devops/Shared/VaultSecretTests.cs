using System.Text;

using Devops.DomainService.Shared.Utilities;

using FluentAssertions;

using Xunit;

namespace XUnitTest.Devops.Shared
{
    public class VaultSecretTests
    {
        [Fact]
        public void DecodeText_Base64Document_RoundTripsByteForByte()
        {
            const string yaml = "apiVersion: tekton.dev/v1beta1\nkind: PipelineRun\n# a comment\n";

            VaultSecret.DecodeText(Convert.ToBase64String(Encoding.UTF8.GetBytes(yaml)))
                       .Should().Be(yaml);
        }

        [Fact]
        public void DecodeText_PlainYaml_IsReturnedUnchanged()
        {
            // A Tekton document starts with characters outside the base64 alphabet, so a hand-set
            // plain-text secret can never be mistaken for an encoded one.
            const string yaml = "# Enhanced PipelineRun\napiVersion: tekton.dev/v1beta1\n";

            VaultSecret.DecodeText(yaml).Should().Be(yaml);
        }

        [Fact]
        public void DecodeText_SurroundingWhitespace_IsToleratedOnTheEncodedForm()
        {
            const string text = "hello world";

            VaultSecret.DecodeText("  " + Convert.ToBase64String(Encoding.UTF8.GetBytes(text)) + "  ")
                       .Should().Be(text);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void DecodeText_BlankInput_IsReturnedUnchanged(string value) =>
            VaultSecret.DecodeText(value).Should().Be(value);
    }
}
