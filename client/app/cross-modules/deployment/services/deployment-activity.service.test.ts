import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubInfoService } from "./github-info.service";
import {
  activityStart,
  deploymentTimestamp,
  getDeploymentActivity,
} from "./deployment-activity.service";

vi.mock("./github-info.service", () => ({ githubInfoService: { getRepoDetails: vi.fn() } }));
const getRepoDetails = vi.mocked(githubInfoService.getRepoDetails);
const build = (itemId: string, createdDate = "2026-10-11T12:00:00Z", branch = "main") => ({
  itemId,
  createdDate,
  branch,
  status: "Succeeded",
});
const page = (builds: ReturnType<typeof build>[], totalCount?: number) => ({
  isSuccess: true,
  data: { build: builds, totalCount },
});

describe("deployment activity", () => {
  beforeEach(() => getRepoDetails.mockReset());

  it("loads every page independently of the history list and counts all attempt statuses", async () => {
    getRepoDetails.mockResolvedValueOnce(
      page(
        Array.from({ length: 100 }, (_, i) => build(`b${i}`)),
        102,
      ),
    );
    getRepoDetails.mockResolvedValueOnce(
      page(
        [
          { ...build("failed", "2026-10-10T09:00:00Z"), status: "Failed" },
          { ...build("running", "2026-10-10T10:00:00Z"), status: "Running" },
        ],
        102,
      ),
    );
    const result = await getDeploymentActivity("179", "main", "2026-10-11");
    expect(getRepoDetails).toHaveBeenNthCalledWith(2, "179", {
      branch: "main",
      pageNumber: 2,
      pageSize: 100,
    });
    expect(result.days).toEqual([
      { date: "2026-10-10", count: 2 },
      { date: "2026-10-11", count: 100 },
    ]);
    expect(result.builds).toHaveLength(102);
  });

  it("continues small pages when the server supplies a larger total", async () => {
    getRepoDetails.mockResolvedValueOnce(page([build("a")], 2));
    getRepoDetails.mockResolvedValueOnce(page([build("b")], 2));
    expect((await getDeploymentActivity("179", "main", "2026-10-11")).days[0].count).toBe(2);
    expect(getRepoDetails).toHaveBeenCalledTimes(2);
  });

  it("deduplicates builds, scopes the branch and calendar, and groups offsets in UTC", async () => {
    getRepoDetails.mockResolvedValue(
      page([
        build("a"),
        build("a"),
        build("b", "2026-10-12T00:30:00+02:00"),
        build("old", "2024-01-01T00:00:00Z"),
        build("future", "2026-10-12T00:00:00Z"),
        build("other", "2026-10-11T12:00:00Z", "other"),
        build("invalid", "garbage"),
      ]),
    );
    const result = await getDeploymentActivity("179", "main", "2026-10-11");
    expect(result.days).toEqual([{ date: "2026-10-11", count: 2 }]);
    expect(result.builds.map((b) => b.itemId)).toEqual(["b", "a"]);
    expect(result.builds[0].createdDate).toBe("2026-10-11T22:30:00.000Z");
  });

  it("normalizes Release UTC timestamps and aligns the first week to Sunday", () => {
    expect(deploymentTimestamp("2026-10-11T12:00:00")).toBe(Date.parse("2026-10-11T12:00:00Z"));
    expect(new Date(activityStart("2026-10-08")).toISOString()).toBe("2025-10-05T00:00:00.000Z");
  });

  it("returns an empty calendar only for successful empty history", async () => {
    getRepoDetails.mockResolvedValue(page([]));
    expect(await getDeploymentActivity("179", "main", "2026-10-11")).toEqual({
      days: [],
      builds: [],
    });
    getRepoDetails.mockResolvedValue({ isSuccess: false });
    await expect(getDeploymentActivity("179", "main", "2026-10-11")).rejects.toThrow(
      "could not be loaded",
    );
  });

  it("keeps valid activity instead of failing or looping when a successful page repeats", async () => {
    getRepoDetails.mockResolvedValue(page([build("same")], 200));
    const result = await getDeploymentActivity("179", "main", "2026-10-11");
    expect(result.days).toEqual([{ date: "2026-10-11", count: 1 }]);
    expect(result.builds).toHaveLength(1);
    expect(result.isPartial).toBe(true);
    expect(getRepoDetails).toHaveBeenCalledTimes(2);
  });

  it("handles legacy full pages with no total and ignored pagination", async () => {
    getRepoDetails.mockResolvedValue(page(Array.from({ length: 100 }, (_, i) => build(`b${i}`))));
    const result = await getDeploymentActivity("179", "main", "2026-10-11");
    expect(result.days).toEqual([{ date: "2026-10-11", count: 100 }]);
    expect(result.isPartial).toBe(true);
    expect(getRepoDetails).toHaveBeenCalledTimes(2);
  });

  it("accepts a successful null build list as empty history", async () => {
    getRepoDetails.mockResolvedValue({ isSuccess: true, data: { build: null, totalCount: 0 } });
    expect(await getDeploymentActivity("179", "main", "2026-10-11")).toEqual({
      days: [],
      builds: [],
    });
  });

  it("skips incomplete records without discarding valid deployment dates", async () => {
    getRepoDetails.mockResolvedValue(page([build("valid"), build("missing", null as never)]));
    expect((await getDeploymentActivity("179", "main", "2026-10-11")).days).toEqual([
      { date: "2026-10-11", count: 1 },
    ]);
  });

  it("stops at the calendar boundary instead of fetching older years", async () => {
    getRepoDetails.mockResolvedValueOnce(page([build("recent")], 300));
    getRepoDetails.mockResolvedValueOnce(page([build("old", "2024-01-01T00:00:00Z")], 300));
    const result = await getDeploymentActivity("179", "main", "2026-10-11");
    expect(result.days).toEqual([{ date: "2026-10-11", count: 1 }]);
    expect(result.isPartial).toBeUndefined();
    expect(getRepoDetails).toHaveBeenCalledTimes(2);
  });

  it("stops fetching when the repository or project query is cancelled", async () => {
    const controller = new AbortController();
    getRepoDetails.mockImplementation(async () => {
      controller.abort();
      return page([build("a")], 200);
    });
    await expect(
      getDeploymentActivity("179", "main", "2026-10-11", controller.signal),
    ).rejects.toThrow();
    expect(getRepoDetails).toHaveBeenCalledTimes(1);
  });
});
