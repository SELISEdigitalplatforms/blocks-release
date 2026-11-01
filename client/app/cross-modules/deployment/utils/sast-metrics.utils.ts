import { tStatic } from "@seliseblocks/genesis-os";
import { formatFullDate } from "@/utils/date.util";
import type { ReportStatus } from "@blocks-deployment/models/sca-report";

export type SastDetails = Record<string, string | undefined>;
export type RatingLetter = "A" | "B" | "C" | "D" | "E";

export const MISSING = "–";

/** "1.0"→"A", "2.0"→"B", "3.0"→"C", "4.0"→"D", "5.0"→"E". Rounded to nearest integer; else null. */
export function toRatingLetter(rating: string | undefined): RatingLetter | null {
  if (rating === undefined || rating === null || rating === "") return null;
  const n = Math.round(Number(rating));
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return (["A", "B", "C", "D", "E"] as const)[n - 1];
}

/** Integer count with locale grouping; missing/non-numeric → MISSING. */
export function formatCount(value: string | undefined): string {
  if (value === undefined || value === null || value === "") return MISSING;
  const n = Number(value);
  if (!Number.isFinite(n)) return MISSING;
  return Math.trunc(n).toLocaleString("en-US");
}

/** One decimal percent; missing → MISSING. */
export function formatPercent(value: string | undefined): string {
  if (value === undefined || value === null || value === "") return MISSING;
  const n = Number(value);
  if (!Number.isFinite(n)) return MISSING;
  return `${n.toFixed(1)}%`;
}

/**
 * Minutes → SonarQube work-time format, 8h per day.
 * Minutes are dropped once days are shown.
 */
export function formatEffort(minutes: string | undefined): string {
  if (minutes === undefined || minutes === null || minutes === "") return MISSING;
  const total = Number(minutes);
  if (!Number.isFinite(total) || total < 0) return MISSING;
  const whole = Math.trunc(total);
  if (whole === 0) return "0min";

  const days = Math.floor(whole / 480);
  const rem = whole % 480;
  const hours = Math.floor(rem / 60);
  const mins = rem % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && mins > 0) parts.push(`${mins}min`);
  return parts.length > 0 ? parts.join(" ") : "0min";
}

export interface SastStat {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  indicator:
    | { kind: "rating"; letter: RatingLetter | null }
    | { kind: "ring"; percent: number | null }
    | { kind: "dot"; percent: number | null }
    | { kind: "none" };
}

function pick(d: SastDetails, primary: string, fallback?: string): string | undefined {
  const a = d[primary];
  if (a !== undefined && a !== null && a !== "") return a;
  if (fallback) {
    const b = d[fallback];
    if (b !== undefined && b !== null && b !== "") return b;
  }
  return undefined;
}

function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getNewCodeStats(d: SastDetails): SastStat[] {
  const coverageRaw = d.new_coverage;
  const dupRaw = d.new_duplicated_lines_density;
  const linesToCover = d.new_lines_to_cover;
  const newLines = d.new_lines;

  return [
    {
      id: "new-issues",
      title: tStatic("release.deployment.scans", "SAST_METRICS.NEW_ISSUES"),
      value: formatCount(d.new_violations),
      indicator: { kind: "none" },
    },
    {
      id: "new-accepted",
      title: tStatic("release.deployment.scans", "SAST_METRICS.ACCEPTED_ISSUES"),
      value: formatCount(d.new_accepted_issues),
      subtitle: tStatic("release.deployment.scans", "SAST_METRICS.ACCEPTED_ISSUES_SUBTITLE"),
      indicator: { kind: "none" },
    },
    {
      id: "new-coverage",
      title: tStatic("release.deployment.scans", "SAST_METRICS.COVERAGE"),
      value: formatPercent(coverageRaw),
      subtitle: linesToCover
        ? tStatic("release.deployment.scans", "SAST_METRICS.NEW_LINES_TO_COVER", { count: formatCount(linesToCover) })
        : undefined,
      indicator: { kind: "ring", percent: parsePercent(coverageRaw) },
    },
    {
      id: "new-duplications",
      title: tStatic("release.deployment.scans", "SAST_METRICS.DUPLICATIONS"),
      value: formatPercent(dupRaw),
      subtitle: newLines ? tStatic("release.deployment.scans", "SAST_METRICS.NEW_LINES", { count: formatCount(newLines) }) : undefined,
      indicator: { kind: "dot", percent: parsePercent(dupRaw) },
    },
    {
      id: "new-hotspots",
      title: tStatic("release.deployment.scans", "SAST_METRICS.SECURITY_HOTSPOTS"),
      value: formatCount(d.new_security_hotspots),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(d.new_security_review_rating),
      },
    },
  ];
}

export function getOverallCodeStats(d: SastDetails): SastStat[] {
  const coverageRaw = d.coverage;
  const dupRaw = d.duplicated_lines_density;
  const linesToCover = d.lines_to_cover;
  const lines = d.lines;

  return [
    {
      id: "overall-security",
      title: tStatic("release.deployment.scans", "SAST_METRICS.SECURITY"),
      value: formatCount(pick(d, "software_quality_security_issues", "vulnerabilities")),
      subtitle: tStatic("release.deployment.scans", "SAST_METRICS.OPEN_ISSUES"),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_security_rating", "security_rating"),
        ),
      },
    },
    {
      id: "overall-reliability",
      title: tStatic("release.deployment.scans", "SAST_METRICS.RELIABILITY"),
      value: formatCount(pick(d, "software_quality_reliability_issues", "bugs")),
      subtitle: tStatic("release.deployment.scans", "SAST_METRICS.OPEN_ISSUES"),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_reliability_rating", "reliability_rating"),
        ),
      },
    },
    {
      id: "overall-maintainability",
      title: tStatic("release.deployment.scans", "SAST_METRICS.MAINTAINABILITY"),
      value: formatCount(
        pick(d, "software_quality_maintainability_issues", "code_smells"),
      ),
      subtitle: tStatic("release.deployment.scans", "SAST_METRICS.OPEN_ISSUES"),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_maintainability_rating", "sqale_rating"),
        ),
      },
    },
    {
      id: "overall-accepted",
      title: tStatic("release.deployment.scans", "SAST_METRICS.ACCEPTED_ISSUES"),
      value: formatCount(d.accepted_issues),
      subtitle: tStatic("release.deployment.scans", "SAST_METRICS.ACCEPTED_ISSUES_SUBTITLE"),
      indicator: { kind: "none" },
    },
    {
      id: "overall-coverage",
      title: tStatic("release.deployment.scans", "SAST_METRICS.COVERAGE"),
      value: formatPercent(coverageRaw),
      subtitle: linesToCover
        ? tStatic("release.deployment.scans", "SAST_METRICS.LINES_TO_COVER", { count: formatCount(linesToCover) })
        : undefined,
      indicator: { kind: "ring", percent: parsePercent(coverageRaw) },
    },
    {
      id: "overall-duplications",
      title: tStatic("release.deployment.scans", "SAST_METRICS.DUPLICATIONS"),
      value: formatPercent(dupRaw),
      subtitle: lines ? tStatic("release.deployment.scans", "SAST_METRICS.LINES", { count: formatCount(lines) }) : undefined,
      indicator: { kind: "dot", percent: parsePercent(dupRaw) },
    },
    {
      id: "overall-hotspots",
      title: tStatic("release.deployment.scans", "SAST_METRICS.SECURITY_HOTSPOTS"),
      value: formatCount(d.security_hotspots),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(d.security_review_rating),
      },
    },
    {
      id: "overall-debt",
      title: tStatic("release.deployment.scans", "SAST_METRICS.TECHNICAL_DEBT"),
      value: formatEffort(
        pick(
          d,
          "software_quality_maintainability_remediation_effort",
          "sqale_index",
        ),
      ),
      indicator: { kind: "none" },
    },
  ];
}

/** false when new_lines is missing or "0" */
export function hasNewCode(d: SastDetails): boolean {
  const v = d.new_lines;
  if (v === undefined || v === null || v === "") return false;
  return v !== "0";
}

/** "Since August 10, 2026" (en-US long date) or null */
export function getNewCodePeriodLabel(d: SastDetails): string | null {
  const raw = d.new_code_period_date;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return tStatic("release.deployment.scans", "SAST_METRICS.SINCE_DATE", { date: formatted });
}


// --- Phase 2 (#210): quality gate conditions + severity breakdown ---

export interface SastGateCondition {
  metricKey: string;
  comparator: "GT" | "LT";
  errorThreshold: string;
  actualValue: string | null;
  status: "OK" | "ERROR";
}
export interface SastQualityGate {
  status: "OK" | "ERROR" | "NONE";
  conditions: SastGateCondition[];
}
export interface SastSeverityCounts {
  total: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}
export interface SastIssueBreakdown {
  newCode: SastSeverityCounts | null;
  overall: SastSeverityCounts | null;
}
export type SastScope = "new" | "overall";

type ConditionGroup =
  | "ISSUES"
  | "COVERAGE"
  | "DUPLICATED_LINES"
  | "HOTSPOTS_REVIEWED"
  | "RELIABILITY_RATING"
  | "SECURITY_RATING"
  | "MAINTAINABILITY_RATING"
  | "SECURITY_REVIEW_RATING";

const CONDITION_GROUPS: Record<string, ConditionGroup> = {
  new_violations: "ISSUES",
  violations: "ISSUES",
  new_coverage: "COVERAGE",
  coverage: "COVERAGE",
  new_duplicated_lines_density: "DUPLICATED_LINES",
  duplicated_lines_density: "DUPLICATED_LINES",
  new_security_hotspots_reviewed: "HOTSPOTS_REVIEWED",
  security_hotspots_reviewed: "HOTSPOTS_REVIEWED",
  new_software_quality_reliability_rating: "RELIABILITY_RATING",
  new_reliability_rating: "RELIABILITY_RATING",
  software_quality_reliability_rating: "RELIABILITY_RATING",
  reliability_rating: "RELIABILITY_RATING",
  new_software_quality_security_rating: "SECURITY_RATING",
  new_security_rating: "SECURITY_RATING",
  software_quality_security_rating: "SECURITY_RATING",
  security_rating: "SECURITY_RATING",
  new_software_quality_maintainability_rating: "MAINTAINABILITY_RATING",
  new_maintainability_rating: "MAINTAINABILITY_RATING",
  software_quality_maintainability_rating: "MAINTAINABILITY_RATING",
  sqale_rating: "MAINTAINABILITY_RATING",
  new_security_review_rating: "SECURITY_REVIEW_RATING",
  security_review_rating: "SECURITY_REVIEW_RATING",
};

/** Label of a quality-gate metric; the raw metric key when it is not known. */
function getConditionLabel(metricKey: string): string {
  switch (CONDITION_GROUPS[metricKey]) {
    case "ISSUES":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_ISSUES");
    case "COVERAGE":
      return tStatic("release.deployment.scans", "SAST_METRICS.COVERAGE");
    case "DUPLICATED_LINES":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_DUPLICATED_LINES");
    case "HOTSPOTS_REVIEWED":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_HOTSPOTS_REVIEWED");
    case "RELIABILITY_RATING":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_RELIABILITY_RATING");
    case "SECURITY_RATING":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_SECURITY_RATING");
    case "MAINTAINABILITY_RATING":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_MAINTAINABILITY_RATING");
    case "SECURITY_REVIEW_RATING":
      return tStatic("release.deployment.scans", "SAST_METRICS.CONDITION_SECURITY_REVIEW_RATING");
    default:
      return metricKey;
  }
}

const RATING_KEYS = new Set(Object.keys(CONDITION_GROUPS).filter((k) => k.includes("rating")));

const STAT_TO_METRICS: Record<string, string[]> = {
  "new-issues": ["new_violations"],
  "new-coverage": ["new_coverage"],
  "new-duplications": ["new_duplicated_lines_density"],
  "new-hotspots": [
    "new_security_hotspots_reviewed",
    "new_security_review_rating",
  ],
  "overall-reliability": [
    "software_quality_reliability_rating",
    "reliability_rating",
  ],
  "overall-security": [
    "software_quality_security_rating",
    "security_rating",
  ],
  "overall-maintainability": [
    "software_quality_maintainability_rating",
    "sqale_rating",
  ],
  "overall-coverage": ["coverage"],
  "overall-duplications": ["duplicated_lines_density"],
  "overall-hotspots": [
    "security_hotspots_reviewed",
    "security_review_rating",
  ],
};

function isPercentMetric(key: string): boolean {
  return (
    key.includes("coverage") ||
    key.includes("duplicated") ||
    key.includes("hotspots_reviewed")
  );
}

function formatConditionValue(metricKey: string, raw: string | null | undefined): string {
  if (raw === undefined || raw === null || raw === "") return MISSING;
  if (RATING_KEYS.has(metricKey) || metricKey.includes("rating")) {
    return toRatingLetter(raw) ?? raw;
  }
  if (isPercentMetric(metricKey)) return formatPercent(raw);
  return formatCount(raw);
}

export function getConditionsForScope(
  gate: SastQualityGate | null | undefined,
  scope: SastScope,
): SastGateCondition[] {
  if (!gate?.conditions?.length) return [];
  return gate.conditions.filter((c) =>
    scope === "new" ? c.metricKey.startsWith("new_") : !c.metricKey.startsWith("new_"),
  );
}

export function formatCondition(c: SastGateCondition): {
  value: string;
  label: string;
  requirement: string;
} {
  const label = getConditionLabel(c.metricKey);
  const value = formatConditionValue(c.metricKey, c.actualValue);
  const isRating = RATING_KEYS.has(c.metricKey) || c.metricKey.includes("rating");
  let thresholdDisplay: string;
  if (isRating) {
    thresholdDisplay = toRatingLetter(c.errorThreshold) ?? c.errorThreshold;
  } else if (isPercentMetric(c.metricKey)) {
    thresholdDisplay = formatPercent(c.errorThreshold);
  } else {
    thresholdDisplay = formatCount(c.errorThreshold);
  }
  let requirement: string;
  if (isRating) {
    requirement =
      c.comparator === "GT"
        ? tStatic("release.deployment.scans", "SAST_METRICS.REQUIREMENT_WORSE_THAN", { value: thresholdDisplay })
        : tStatic("release.deployment.scans", "SAST_METRICS.REQUIREMENT_BETTER_THAN", { value: thresholdDisplay });
  } else {
    requirement =
      c.comparator === "GT"
        ? tStatic("release.deployment.scans", "SAST_METRICS.REQUIREMENT_GREATER_THAN", { value: thresholdDisplay })
        : tStatic("release.deployment.scans", "SAST_METRICS.REQUIREMENT_LESS_THAN", { value: thresholdDisplay });
  }
  return { value, label, requirement };
}

export function formatRequired(c: SastGateCondition): string {
  const isRating = RATING_KEYS.has(c.metricKey) || c.metricKey.includes("rating");
  let thresholdDisplay: string;
  if (isRating) {
    thresholdDisplay = toRatingLetter(c.errorThreshold) ?? c.errorThreshold;
  } else if (isPercentMetric(c.metricKey)) {
    thresholdDisplay = formatPercent(c.errorThreshold);
  } else {
    thresholdDisplay = c.errorThreshold;
  }
  if (isRating) {
    // GT = worse-than threshold → Required ≥ letter; LT = better-than → Required ≤ letter
    return c.comparator === "GT"
      ? tStatic("release.deployment.scans", "SAST_METRICS.REQUIRED_AT_LEAST", { value: thresholdDisplay })
      : tStatic("release.deployment.scans", "SAST_METRICS.REQUIRED_AT_MOST", { value: thresholdDisplay });
  }
  if (c.comparator === "GT") {
    const n = Number(c.errorThreshold);
    if (Number.isFinite(n) && n === 0) return tStatic("release.deployment.scans", "SAST_METRICS.REQUIRED_ZERO");
    return tStatic("release.deployment.scans", "SAST_METRICS.REQUIRED_AT_MOST", { value: thresholdDisplay });
  }
  return tStatic("release.deployment.scans", "SAST_METRICS.REQUIRED_AT_LEAST", { value: thresholdDisplay });
}

export function getFailedConditionForStat(
  statId: string,
  gate: SastQualityGate | null | undefined,
): SastGateCondition | null {
  if (!gate?.conditions?.length) return null;
  const keys = STAT_TO_METRICS[statId];
  if (!keys) return null;
  return (
    gate.conditions.find(
      (c) => c.status === "ERROR" && keys.includes(c.metricKey),
    ) ?? null
  );
}

export function getSeverityRows(
  counts: SastSeverityCounts,
): { key: string; label: string; count: number }[] {
  return [
    { key: "blocker", label: tStatic("release.deployment.scans", "SAST_METRICS.SEVERITY_BLOCKER"), count: counts.blocker },
    { key: "high", label: tStatic("release.deployment.scans", "SAST_METRICS.SEVERITY_HIGH"), count: counts.high },
    { key: "medium", label: tStatic("release.deployment.scans", "SAST_METRICS.SEVERITY_MEDIUM"), count: counts.medium },
    { key: "low", label: tStatic("release.deployment.scans", "SAST_METRICS.SEVERITY_LOW"), count: counts.low },
    { key: "info", label: tStatic("release.deployment.scans", "SAST_METRICS.SEVERITY_INFO"), count: counts.info },
  ];
}

export function getQualityGateLabel(
  d: SastDetails,
  gate?: SastQualityGate | null,
): "Passed" | "Failed" | "Not computed" {
  if (gate?.status === "OK") return "Passed";
  if (gate?.status === "ERROR") return "Failed";
  if (gate?.status === "NONE") return "Not computed";
  if (d.alert_status === "OK") return "Passed";
  if (d.alert_status === "ERROR") return "Failed";
  return "Not computed";
}

/** `data` of GET /reports?type=sast. `status` is absent on builds without a saved report. */
export interface SastReportData {
  type?: string;
  status?: ReportStatus | null;
  message?: string | null;
  capturedAt?: string | null;
  analysisDate?: string | null;
  revision?: string | null;
  details?: SastDetails | null;
  qualityGate?: SastQualityGate | null;
  issueBreakdown?: SastIssueBreakdown | null;
}
export interface SastReportResponse {
  data?: SastReportData | null;
}

/** "Scanned {date} · commit {7 chars}"; the commit part only when the revision is known. */
export function getSastScanCaption(report: SastReportData): string | null {
  const scannedAt = report.analysisDate ?? report.capturedAt;
  if (!scannedAt) return null;
  const date = formatFullDate(new Date(scannedAt));
  return report.revision
    ? tStatic("release.deployment.scans", "SAST_METRICS.SCAN_CAPTION_COMMIT", {
        date,
        commit: report.revision.slice(0, 7),
      })
    : tStatic("release.deployment.scans", "SAST_METRICS.SCAN_CAPTION", { date });
}
