using Devops.DomainService.Shared.Services;
using FluentAssertions;

namespace XUnitTest.Devops.Shared
{
    public class StringFormatterServiceTests
    {
        [Theory]
        [InlineData("My App!Name", "my-app-name")]
        [InlineData("already-clean", "already-clean")]
        [InlineData("  spaced  ", "spaced")]
        [InlineData("--edges--", "edges")]
        public void SanitizeString_ReplacesNonAlnumLowercasesAndTrims(string input, string expected)
        {
            StringFormatterService.SanitizeString(input).Should().Be(expected);
        }

        [Theory]
        [InlineData("https://Example.com", "example.com")]
        [InlineData("http://Example.com", "example.com")]
        [InlineData("Example.com", "example.com")]
        public void RemoveHttpsFromString_StripsSchemeAndLowercases(string input, string expected)
        {
            StringFormatterService.RemoveHttpsFromString(input).Should().Be(expected);
        }

        [Fact]
        public void Truncate_ShorterThanMax_ReturnsSame()
        {
            StringFormatterService.Truncate("short", 20).Should().Be("short");
        }

        [Fact]
        public void Truncate_LongerThanMax_TruncatesAndTrimsTrailingDash()
        {
            StringFormatterService.Truncate("abcde-fghij", 6).Should().Be("abcde");
        }

        [Fact]
        public void Truncate_NullOrEmpty_ReturnsInput()
        {
            StringFormatterService.Truncate(null, 5).Should().BeNull();
            StringFormatterService.Truncate("", 5).Should().Be("");
        }
    }
}
