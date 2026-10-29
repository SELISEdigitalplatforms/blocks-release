/** One vulnerable library entry in the SCA "libraries" report. */
export interface IScaVulnerability {
  id?: string;
  name?: string;
  group?: string;
  version?: string;
  latestVersion?: string;
  severity?: string;
  score?: string | number;
  epssScore?: number;
  epssPercentile?: number;
  cweName?: string;
  description?: string;
}

/** Totals for the SCA "libraries" report. */
export interface IScaReportDetails {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unassigned: number;
  inheritedRiskScore: number;
  vulnerabilities: string;
  vulnerableComponents: string;
  components: string;
}

/**
 * State of a report saved on the build. Absent on builds created before reports were saved
 * (the endpoint then returns today's live result).
 */
export type ReportStatus = "Pending" | "Ready" | "NotRun" | "Failed";

/** Response of GET /reports?type=sca-libraries. */
export interface IScaLibraryReportResponse {
  data?: {
    type?: string;
    status?: ReportStatus | null;
    message?: string | null;
    capturedAt?: string | null;
    analyzedAt?: string | null;
    findingsTruncated?: boolean | null;
    details?: IScaReportDetails | null;
    vulnerabilities?: IScaVulnerability[] | null;
  };
}
