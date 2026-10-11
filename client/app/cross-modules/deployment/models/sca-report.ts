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

/** Response of GET /reports?type=sca-libraries. */
export interface IScaLibraryReportResponse {
  data?: {
    details?: IScaReportDetails;
    vulnerabilities?: IScaVulnerability[];
  };
}
