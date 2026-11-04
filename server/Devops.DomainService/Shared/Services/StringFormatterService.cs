using System.Text.RegularExpressions;

namespace Devops.DomainService.Shared.Services
{
    public static class StringFormatterService
    {
        private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);

        public static string SanitizeString(string value)
        {
            return Regex.Replace(value, "[^a-zA-Z0-9]", "-", RegexOptions.None, RegexTimeout)
                        .ToLower()
                        .Trim()
                        .Trim('-');
        }

        /// <summary>
        /// A repository's project name in SonarQube and Dependency-Track: the full repository name with "/" as "-",
        /// case and every other character kept. The pipeline receives it as <c>sonar-project-key</c> and its SCA step
        /// uploads the BOM under it, and Dependency-Track matches project names exactly, so a lookup must use it as is.
        /// </summary>
        public static string AnalysisProjectName(string repoName) => repoName.Replace("/", "-");

        public static string RemoveHttpsFromString(string value)
        {
            return Regex.Replace(value, @"^https?://", "", RegexOptions.IgnoreCase, RegexTimeout)
                        .ToLower();
        }

        public static string Truncate(string value, int maxLength)
        {
            if (string.IsNullOrEmpty(value))
                return value;

            var truncated = value.Length <= maxLength ? value : value.Substring(0, maxLength);
            return truncated.TrimEnd('-');
        }
    }
}
