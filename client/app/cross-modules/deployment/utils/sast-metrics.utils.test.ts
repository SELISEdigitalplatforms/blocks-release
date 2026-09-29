import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatCount,
  formatEffort,
  formatPercent,
  getNewCodePeriodLabel,
  getNewCodeStats,
  getOverallCodeStats,
  getQualityGateLabel,
  hasNewCode,
  toRatingLetter,
} from "./sast-metrics.utils";

describe("toRatingLetter", () => {
  it.each([
    ["1.0", "A"],
    ["2.0", "B"],
    ["3.0", "C"],
    ["4.0", "D"],
    ["5.0", "E"],
    ["1.4", "A"],
    ["2.6", "C"],
  ] as const)("%s → %s", (input, letter) => {
    expect(toRatingLetter(input)).toBe(letter);
  });

  it.each(["7.0", "", undefined, "NaN", "0", "6"])(
    "returns null for %s",
    (input) => {
      expect(toRatingLetter(input as string | undefined)).toBeNull();
    },
  );
});

describe("formatEffort", () => {
  it.each([
    ["0", "0min"],
    ["45", "45min"],
    ["60", "1h"],
    ["90", "1h 30min"],
    ["480", "1d"],
    ["2940", "6d 1h"],
  ] as const)("%s → %s", (input, expected) => {
    expect(formatEffort(input)).toBe(expected);
  });

  it("returns MISSING for undefined", () => {
    expect(formatEffort(undefined)).toBe(MISSING);
  });
});

describe("formatCount / formatPercent", () => {
  it("formats counts with grouping", () => {
    expect(formatCount("1234")).toBe("1,234");
    expect(formatCount("69")).toBe("69");
  });

  it("returns MISSING for missing count/percent", () => {
    expect(formatCount(undefined)).toBe(MISSING);
    expect(formatCount("abc")).toBe(MISSING);
    expect(formatPercent(undefined)).toBe(MISSING);
  });

  it("formats percent to one decimal", () => {
    expect(formatPercent("0.0")).toBe("0.0%");
    expect(formatPercent("1.44")).toBe("1.4%");
  });
});

describe("getNewCodeStats (Example 1)", () => {
  it("builds New Code stats", () => {
    const stats = getNewCodeStats({
      new_violations: "69",
      new_coverage: "0.0",
      new_lines_to_cover: "780",
      new_duplicated_lines_density: "1.44",
      new_lines: "5512",
      new_security_hotspots: "1",
      new_security_review_rating: "5.0",
    });
    expect(stats.map((s) => s.id)).toEqual([
      "new-issues",
      "new-accepted",
      "new-coverage",
      "new-duplications",
      "new-hotspots",
    ]);
    expect(stats[0].value).toBe("69");
    expect(stats[2].value).toBe("0.0%");
    expect(stats[2].subtitle).toBe("On 780 new lines to cover");
    expect(stats[3].value).toBe("1.4%");
    expect(stats[3].subtitle).toBe("On 5,512 new lines");
    expect(stats[4].value).toBe("1");
    expect(stats[4].indicator).toEqual({ kind: "rating", letter: "E" });
  });
});

describe("getOverallCodeStats", () => {
  it("Example 2 — MQR keys", () => {
    const stats = getOverallCodeStats({
      software_quality_security_issues: "0",
      software_quality_security_rating: "1.0",
      software_quality_reliability_issues: "13",
      software_quality_reliability_rating: "3.0",
      software_quality_maintainability_issues: "99",
      software_quality_maintainability_rating: "1.0",
      security_hotspots: "5",
      security_review_rating: "5.0",
      lines: "9021",
      duplicated_lines_density: "1.2",
      software_quality_maintainability_remediation_effort: "2940",
    });
    const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
    expect(byId["overall-security"].value).toBe("0");
    expect(byId["overall-security"].indicator).toEqual({
      kind: "rating",
      letter: "A",
    });
    expect(byId["overall-reliability"].value).toBe("13");
    expect(byId["overall-reliability"].indicator).toEqual({
      kind: "rating",
      letter: "C",
    });
    expect(byId["overall-maintainability"].value).toBe("99");
    expect(byId["overall-maintainability"].indicator).toEqual({
      kind: "rating",
      letter: "A",
    });
    expect(byId["overall-hotspots"].value).toBe("5");
    expect(byId["overall-hotspots"].indicator).toEqual({
      kind: "rating",
      letter: "E",
    });
    expect(byId["overall-duplications"].value).toBe("1.2%");
    expect(byId["overall-duplications"].subtitle).toBe("On 9,021 lines");
    expect(byId["overall-debt"].value).toBe("6d 1h");
  });

  it("Example 3 — Standard-mode fallback", () => {
    const stats = getOverallCodeStats({
      bugs: "4",
      reliability_rating: "2.0",
      vulnerabilities: "1",
      security_rating: "4.0",
      code_smells: "30",
      sqale_rating: "1.0",
      sqale_index: "45",
    });
    const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
    expect(byId["overall-reliability"].value).toBe("4");
    expect(byId["overall-reliability"].indicator).toEqual({
      kind: "rating",
      letter: "B",
    });
    expect(byId["overall-security"].value).toBe("1");
    expect(byId["overall-security"].indicator).toEqual({
      kind: "rating",
      letter: "D",
    });
    expect(byId["overall-maintainability"].value).toBe("30");
    expect(byId["overall-maintainability"].indicator).toEqual({
      kind: "rating",
      letter: "A",
    });
    expect(byId["overall-debt"].value).toBe("45min");
  });

  it("Example 6 — missing metric / bad rating", () => {
    const stats = getOverallCodeStats({
      software_quality_reliability_rating: "7.0",
    });
    const rel = stats.find((s) => s.id === "overall-reliability")!;
    expect(rel.value).toBe(MISSING);
    expect(rel.indicator).toEqual({ kind: "rating", letter: null });
  });
});

describe("hasNewCode / getQualityGateLabel / getNewCodePeriodLabel", () => {
  it("hasNewCode false for missing and 0", () => {
    expect(hasNewCode({})).toBe(false);
    expect(hasNewCode({ new_lines: "0" })).toBe(false);
    expect(hasNewCode({ new_lines: "10" })).toBe(true);
  });

  it("getQualityGateLabel", () => {
    expect(getQualityGateLabel({ alert_status: "OK" })).toBe("Passed");
    expect(getQualityGateLabel({ alert_status: "ERROR" })).toBe("Failed");
    expect(getQualityGateLabel({})).toBe("Not computed");
  });

  it("getNewCodePeriodLabel formats en-US long date", () => {
    expect(
      getNewCodePeriodLabel({
        new_code_period_date: "2026-08-10T09:12:00+0000",
      }),
    ).toBe("Since August 10, 2026");
    expect(getNewCodePeriodLabel({})).toBeNull();
  });
});
