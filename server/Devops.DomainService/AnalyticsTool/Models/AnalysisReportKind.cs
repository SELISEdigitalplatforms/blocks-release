namespace Devops.DomainService.AnalyticsTool.Models;

/// <summary>Which of a build's two saved analysis reports an operation targets.</summary>
public enum AnalysisReportKind
{
    /// <summary><c>Build.SastReport</c>, from SonarQube.</summary>
    Sast,

    /// <summary><c>Build.ScaReport</c>, from Dependency-Track.</summary>
    Sca
}
