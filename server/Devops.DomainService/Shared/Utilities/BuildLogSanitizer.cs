using System.Text.RegularExpressions;

namespace Devops.DomainService.Shared.Utilities;

/// <summary>A text that, found anywhere in a step's log, replaces the whole log with <see cref="Message"/>.</summary>
public sealed record LogReplaceRule(string Contains, string Message);

/// <summary>A regex whose matches are replaced with <see cref="Replacement"/>; the rest of the log stays visible.</summary>
public sealed record LogMaskRule(string Pattern, string Replacement);

/// <summary>
/// What a sanitized log turned into. <see cref="MatchedRule"/> and <see cref="MatchedLine"/> are set only when a
/// replace rule fired, so the caller can record the original cause where users cannot see it.
/// </summary>
public sealed record SanitizedLog(string Text, LogReplaceRule? MatchedRule, string? MatchedLine);

/// <summary>
/// Cleans build output before it is stored on a build or sent to users, so platform errors and infrastructure
/// details never reach the deployment log.
/// </summary>
/// <remarks>
/// To handle a newly found platform error, add one line to <see cref="ReplaceRules"/>. To hide a newly found
/// piece of infrastructure detail while keeping the rest of the line, add one line to <see cref="MaskRules"/>.
/// </remarks>
public static class BuildLogSanitizer
{
    public const string ContactAdministrator =
        "Something went wrong on our side. Please contact your administrator for support.";

    private const int MaxMatchedLineLength = 1000;
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);

    /// <summary>
    /// Platform errors the user cannot fix. Plain text, matched case-insensitively; the first match wins.
    /// </summary>
    public static readonly IReadOnlyList<LogReplaceRule> ReplaceRules =
    [
        // Kaniko could not log in to the container registry before building.
        new("error checking push permissions", ContactAdministrator),
        // The shared build volume ran out of space (seen from the SonarQube scan).
        new("No space left on device", ContactAdministrator),
    ];

    /// <summary>Infrastructure details hidden inside logs that are otherwise shown. Regex, applied in order.</summary>
    public static readonly IReadOnlyList<LogMaskRule> MaskRules =
    [
        new(@"\S*github\.com\S*", "**"),
        new(@"(?i)(namespace\s+).*", "$1***"),
        // Container registry addresses and image paths, e.g. Kaniko's "Pushing image to <registry>/<path>:<tag>".
        new(@"(?i)\S*\.azurecr\.io\S*", "***"),
    ];

    public static SanitizedLog Sanitize(string? log)
    {
        if (string.IsNullOrEmpty(log))
            return new SanitizedLog(string.Empty, null, null);

        foreach (var rule in ReplaceRules)
        {
            // A blank rule would match every log and hide all build output.
            if (string.IsNullOrWhiteSpace(rule.Contains))
                continue;

            var index = log.IndexOf(rule.Contains, StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
                return new SanitizedLog(rule.Message, rule, LineAt(log, index));
        }

        var masked = log;
        foreach (var rule in MaskRules)
            masked = Regex.Replace(masked, rule.Pattern, rule.Replacement, RegexOptions.None, RegexTimeout);

        return new SanitizedLog(masked, null, null);
    }

    private static string LineAt(string log, int index)
    {
        var start = log.LastIndexOf('\n', index) + 1;
        var end = log.IndexOf('\n', index);
        var line = (end < 0 ? log[start..] : log[start..end]).Trim();
        return line.Length > MaxMatchedLineLength ? line[..MaxMatchedLineLength] : line;
    }
}
