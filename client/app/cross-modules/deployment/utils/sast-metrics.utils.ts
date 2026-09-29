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
      title: "New issues",
      value: formatCount(d.new_violations),
      indicator: { kind: "none" },
    },
    {
      id: "new-accepted",
      title: "Accepted issues",
      value: formatCount(d.new_accepted_issues),
      subtitle: "Valid issues that were not fixed",
      indicator: { kind: "none" },
    },
    {
      id: "new-coverage",
      title: "Coverage",
      value: formatPercent(coverageRaw),
      subtitle: linesToCover
        ? `On ${formatCount(linesToCover)} new lines to cover`
        : undefined,
      indicator: { kind: "ring", percent: parsePercent(coverageRaw) },
    },
    {
      id: "new-duplications",
      title: "Duplications",
      value: formatPercent(dupRaw),
      subtitle: newLines ? `On ${formatCount(newLines)} new lines` : undefined,
      indicator: { kind: "dot", percent: parsePercent(dupRaw) },
    },
    {
      id: "new-hotspots",
      title: "Security hotspots",
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
      title: "Security",
      value: formatCount(pick(d, "software_quality_security_issues", "vulnerabilities")),
      subtitle: "Open issues",
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_security_rating", "security_rating"),
        ),
      },
    },
    {
      id: "overall-reliability",
      title: "Reliability",
      value: formatCount(pick(d, "software_quality_reliability_issues", "bugs")),
      subtitle: "Open issues",
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_reliability_rating", "reliability_rating"),
        ),
      },
    },
    {
      id: "overall-maintainability",
      title: "Maintainability",
      value: formatCount(
        pick(d, "software_quality_maintainability_issues", "code_smells"),
      ),
      subtitle: "Open issues",
      indicator: {
        kind: "rating",
        letter: toRatingLetter(
          pick(d, "software_quality_maintainability_rating", "sqale_rating"),
        ),
      },
    },
    {
      id: "overall-accepted",
      title: "Accepted issues",
      value: formatCount(d.accepted_issues),
      subtitle: "Valid issues that were not fixed",
      indicator: { kind: "none" },
    },
    {
      id: "overall-coverage",
      title: "Coverage",
      value: formatPercent(coverageRaw),
      subtitle: linesToCover
        ? `On ${formatCount(linesToCover)} lines to cover`
        : undefined,
      indicator: { kind: "ring", percent: parsePercent(coverageRaw) },
    },
    {
      id: "overall-duplications",
      title: "Duplications",
      value: formatPercent(dupRaw),
      subtitle: lines ? `On ${formatCount(lines)} lines` : undefined,
      indicator: { kind: "dot", percent: parsePercent(dupRaw) },
    },
    {
      id: "overall-hotspots",
      title: "Security hotspots",
      value: formatCount(d.security_hotspots),
      indicator: {
        kind: "rating",
        letter: toRatingLetter(d.security_review_rating),
      },
    },
    {
      id: "overall-debt",
      title: "Technical debt",
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
  return `Since ${formatted}`;
}

export function getQualityGateLabel(
  d: SastDetails,
): "Passed" | "Failed" | "Not computed" {
  if (d.alert_status === "OK") return "Passed";
  if (d.alert_status === "ERROR") return "Failed";
  return "Not computed";
}
