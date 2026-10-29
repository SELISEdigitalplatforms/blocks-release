import { test, expect } from "../../support/test-base";
import type { Page, Response } from "@playwright/test";
import { openReleaseDeployment } from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * Live, read-only checks of the per-build SAST/SCA reports (#255) against the
 * environment under test. Nothing is mocked, deployed or deleted.
 *
 * - H15/C19: build-returning reads (`repo-details`, `build?buildId`) carry no
 *   report data: `sastReport`/`scaReport` are null or absent on every build.
 * - H9: a build without a saved report renders its SAST tab as before.
 * - C7: a cancelled build's saved reports are no longer Pending, and a NotRun
 *   one says why.
 */

type Json = unknown;
type BuildLike = { itemId?: string; status?: string; sastReport?: Json; scaReport?: Json };

/** Every object in the payload that looks like a build (has a pipelineRunName). */
function findBuilds(node: Json, found: BuildLike[] = []): BuildLike[] {
  if (Array.isArray(node)) node.forEach((n) => findBuilds(n, found));
  else if (node && typeof node === "object") {
    if ("pipelineRunName" in node) found.push(node as BuildLike);
    Object.values(node).forEach((v) => findBuilds(v, found));
  }
  return found;
}

const expectNoReportData = (builds: BuildLike[]) => {
  for (const build of builds) {
    expect(build.sastReport ?? null, `sastReport of build ${build.itemId}`).toBeNull();
    expect(build.scaReport ?? null, `scaReport of build ${build.itemId}`).toBeNull();
  }
};

const isGet = (response: Response, path: string) =>
  response.request().method() === "GET" && new URL(response.url()).pathname.endsWith(path);

async function openBuildTab(page: Page, repoPath: string, buildId: string, tab: "sast" | "sca") {
  const type = tab === "sast" ? "sast" : "sca-libraries";
  const reports = page.waitForResponse(
    (r) =>
      isGet(r, "/build/reports") &&
      new URL(r.url()).searchParams.get("buildId") === buildId &&
      new URL(r.url()).searchParams.get("type") === type,
    { timeout: 60_000 },
  );
  await page.goto(`${repoPath}/deployment-logs/${encodeURIComponent(buildId)}?tab=${tab}`, {
    waitUntil: "domcontentloaded",
  });
  const body = await (await reports).json();
  return (body?.data ?? null) as Record<string, unknown> | null;
}

test.describe("Saved build reports on the live environment (#255)", () => {
  test("build reads carry no report data; legacy and cancelled builds read correctly", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await openReleaseDeployment(page);
    test.skip(!readReleaseProject()?.itemId, "No shared Release project fixture");

    const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();
    if (!(await repoCard.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, "The shared project has no linked repository");
    }

    let builds: BuildLike[] = [];
    let repoPath = "";

    await test.step("[Critical] repo-details builds carry no sastReport/scaReport data (H15, C19)", async () => {
      const repoDetails = page.waitForResponse((r) => isGet(r, "/build/repo-details"), {
        timeout: 60_000,
      });
      await repoCard.click();
      await expect(page).toHaveURL(/\/deployment\/repo\//, { timeout: 30_000 });
      repoPath = new URL(page.url()).pathname.replace(/\/$/, "");
      builds = findBuilds(await (await repoDetails).json());
      expectNoReportData(builds);
    });

    test.skip(builds.length === 0 || !builds[0].itemId, "The repository has no builds");
    const latest = builds[0].itemId as string;

    await test.step("[Critical] GET build?buildId carries no sastReport/scaReport data (H15, C19)", async () => {
      const buildRead = page.waitForResponse(
        (r) => isGet(r, "/build") && new URL(r.url()).searchParams.get("buildId") === latest,
        { timeout: 60_000 },
      );
      await page.goto(`${repoPath}/deployment-logs/${encodeURIComponent(latest)}`, {
        waitUntil: "domcontentloaded",
      });
      expectNoReportData(findBuilds(await (await buildRead).json()));
    });

    await test.step("[Positive] a build without a saved report renders its SAST tab as before (H9)", async () => {
      // The oldest listed build is the likeliest to predate the saved reports.
      const oldest = builds[builds.length - 1].itemId as string;
      const report = await openBuildTab(page, repoPath, oldest, "sast");
      if (report && "status" in report && report.status != null) {
        test
          .info()
          .annotations.push({
            type: "H9",
            description: `build ${oldest} has a saved report; legacy view not exercised`,
          });
        return;
      }
      await expect(page.getByRole("button", { name: "SAST" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Scanned /)).toHaveCount(0);
      await expect(page.getByText("Scan did not run")).toHaveCount(0);
      await expect(page.getByText("Results not captured")).toHaveCount(0);
    });

    await test.step("[Critical] a cancelled build's saved reports are not left Pending (C7)", async () => {
      const cancelled = builds.find((b) => b.status === "Cancelled" && b.itemId);
      if (!cancelled) {
        test
          .info()
          .annotations.push({ type: "C7", description: "no cancelled build in the repository" });
        return;
      }
      for (const tab of ["sast", "sca"] as const) {
        const report = await openBuildTab(page, repoPath, cancelled.itemId as string, tab);
        if (!report || report.status == null) {
          test
            .info()
            .annotations.push({
              type: "C7",
              description: `${tab}: cancelled build predates the saved reports`,
            });
          continue;
        }
        expect(report.status, `${tab} report of the cancelled build`).not.toBe("Pending");
        if (report.status === "NotRun") {
          expect(report.message).toBe("The build was cancelled.");
          await expect(page.getByText("Scan did not run")).toBeVisible({ timeout: 30_000 });
        }
      }
    });
  });
});
