import { describe, expect, it } from "vitest";
import { buildGrid, computeStats, dayMs } from "./contribution-skyline";

describe("contribution calendar statistics", () => {
  it("combines duplicate days, excludes dates outside the year, and reports streaks", () => {
    const grid = buildGrid(
      [
        { date: "2026-10-08", count: 1 },
        { date: "2026-10-08", count: 2 },
        { date: "2026-10-09", count: 4 },
        { date: "2026-10-10", count: 2 },
        { date: "2024-01-01", count: 100 },
        { date: "2026-10-12", count: 100 },
      ],
      dayMs("2026-10-11"),
    );
    const stats = computeStats(grid.cells);
    expect(stats.total).toBe(9);
    expect(stats.busiest).toEqual({ count: 4, date: "2026-10-09" });
    expect(stats.longest).toEqual({ days: 3, start: "2026-10-08", end: "2026-10-10" });
    expect(stats.current).toEqual(stats.longest);
    expect(grid.weeks).toBe(53);
  });

  it("does not invent activity for empty data or retain an expired streak", () => {
    const empty = buildGrid([], dayMs("2026-10-11"));
    expect(computeStats(empty.cells).total).toBe(0);
    expect(empty.cells.every((c) => c.level === 0)).toBe(true);
    const old = buildGrid([{ date: "2026-10-08", count: 4 }], dayMs("2026-10-11"));
    expect(computeStats(old.cells).current.days).toBe(0);
  });
});
