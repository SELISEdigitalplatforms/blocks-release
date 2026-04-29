using System.Text.RegularExpressions;

namespace Devops.DomainService.Shared.Services
{
    public static class StringFormatterService
    {
        public static string SanitizeString(string value)
        {
            return Regex.Replace(value, "[^a-zA-Z0-9]", "-")
                        .ToLower()
                        .Trim()
                        .Trim('-');
        }

        public static string RemoveHttpsFromString(string value)
        {
            return Regex.Replace(value, @"^https?://", "", RegexOptions.IgnoreCase)
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
