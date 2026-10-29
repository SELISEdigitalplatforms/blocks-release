import { test, expect } from "../../support/test-base";
import type { Page, Route } from "@playwright/test";
import { openReleaseDeployment } from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * SCA tab states of a build's saved Dependency-Track report (#255).
 *
 * Mocks `GET /build?buildId=` and `GET /build/reports?type=sca-libraries`, so
 * the deployed client bundle is exercised without a build that has a captured
 * report. Never clicks Deploy or the Dependency-Track button.
 */

const FAKE_REPO_ID = "e2e-sca-repo";
const FAKE_BUILD_ID = "e2e-sca-build";

type ScaReport = Record<string, unknown>;

/**
 * Waits a bounded real second, so a request the page would have sent has reached the
 * route handler. Only used before asserting that NO request was sent, which no
 * condition can be awaited for.
 */
const settle = (page: Page) => page.waitForTimeout(1_000);

const okEnvelope = <T>(data: T) => ({
  isSuccess: true,
  statusCode: 200,
  message: null,
  errors: null,
  data,
});

const buildCard = {
  blocksUserId: "u1",
  repoId: FAKE_REPO_ID,
  repoName: "e2e/sca-repo",
  repoUrl: "https://github.com/e2e/sca-repo",
  defaultDeploymentUrl: "https://sca.example.test",
  customDeploymentUrl: null,
  commit: "abc123",
  branch: "dev",
  imageName: "img",
  status: "Succeeded",
  eventName: "push",
  duration: 12,
  buildImageName: null,
  pipelineRunName: "pr-sca-1",
  html_url: null,
  events: [],
  itemId: FAKE_BUILD_ID,
  createdDate: "2026-10-28T10:00:00Z",
  lastUpdatedDate: "2026-10-28T10:00:00Z",
  createdBy: "e2e",
  language: null,
  lastUpdatedBy: null,
  organizationIds: [],
  tags: [],
};

const details = {
  critical: "1",
  high: "1",
  medium: "0",
  low: "0",
  unassigned: "0",
  inheritedRiskScore: "15",
  vulnerabilities: "2",
  vulnerableComponents: "2",
  components: "40",
  kev: "0",
};

const finding = (id: string, severity: string, score: string) => ({
  name: `lib-${id}`,
  group: "org.e2e",
  version: "1.0.0",
  latestVersion: "1.2.0",
  id,
  score,
  severity,
  epssScore: 0.1,
  epssPercentile: 0.5,
  cweName: "Improper Input Validation",
  description: `Advisory ${id}`,
  aliases: [],
});

const pendingSca = { type: "Sca", status: "Pending", details: null, vulnerabilities: null };

const readySca = (extra: ScaReport = {}) => ({
  type: "Sca",
  status: "Ready",
  capturedAt: "2026-10-29T10:20:00Z", // another day, so the caption proves analyzedAt wins
  analyzedAt: "2026-10-28T10:15:00Z",
  findingsTruncated: false,
  details,
  vulnerabilities: [
    finding("CVE-2026-0001", "CRITICAL", "9.8"),
    finding("CVE-2026-0002", "HIGH", "7.5"),
  ],
  ...extra,
});

/** Serves `reports?type=sca-libraries` from `current()`, so a test can change it between refetches. */
async function openScaTab(
  page: Page,
  current: () => ScaReport,
  onReportRequest: () => void = () => {},
) {
  await openReleaseDeployment(page);
  const itemId = readReleaseProject()?.itemId;
  test.skip(!itemId, "No shared Release project fixture");

  await page.route("**/build?**", async (route: Route) => {
    const url = route.request().url();
    if (
      !url.includes("buildId=") ||
      route.request().method() !== "GET" ||
      url.includes("/reports")
    ) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(okEnvelope(buildCard)),
    });
  });
  await page.route("**/build/reports**", async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (new URL(route.request().url()).searchParams.get("type") !== "sca-libraries")
      return route.fallback();
    onReportRequest();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(okEnvelope(current())),
    });
  });

  const target = new URL(page.url());
  target.pathname = `/app/${itemId}/deployment/repo/${FAKE_REPO_ID}/deployment-logs/${FAKE_BUILD_ID}`;
  target.search = "tab=sca";
  await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  // Top-level SAST/SCA/DAST controls are buttons in a nav, not ARIA tabs.
  await expect(page.getByRole("button", { name: "SCA" })).toBeVisible({ timeout: 30_000 });
}

test.describe("SCA tab saved report states (#255)", () => {
  test("Pending polls every 30 s until Ready, then shows the Analyzed caption", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    let report: ScaReport = pendingSca;
    let requests = 0;

    await page.clock.install();
    await openScaTab(
      page,
      () => report,
      () => requests++,
    );

    await test.step("[Positive] Pending shows the Data Processing card as a status (H10)", async () => {
      const card = page.getByRole("status").filter({ hasText: "Data Processing" });
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText("Analysis in progress");
    });

    await test.step("[Positive] the report is refetched every 30 s while Pending (H10)", async () => {
      const before = requests;
      await page.clock.fastForward(29_000);
      await settle(page);
      expect(requests, "no refetch before 30 s").toBe(before);
      await page.clock.fastForward(1_000);
      await expect.poll(() => requests, { timeout: 10_000 }).toBe(before + 1);
    });

    await test.step("[Positive] Pending → Ready shows findings and the caption, polling stops (H11)", async () => {
      report = readySca();
      await page.clock.fastForward(30_000);
      await expect(page.getByText(/^Analyzed Oct 28, 2026 at \d{2}:\d{2}$/)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("lib-CVE-2026-0001").first()).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Data Processing" })).toHaveCount(0);
      await expect(page.getByText(/most severe findings/)).toHaveCount(0);

      const afterReady = requests;
      await page.clock.fastForward(90_000);
      await settle(page);
      expect(requests).toBe(afterReady);
    });
  });

  test("truncated, NotRun and Failed reports", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("[Critical] truncated findings show the count line and the Dependency-Track button (C12)", async () => {
      await openScaTab(page, () => readySca({ findingsTruncated: true }));
      await expect(
        page.getByText(
          "Showing the 2 most severe findings. Open Dependency-Track for the full list.",
        ),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page
          .getByText("Showing the 2 most severe findings. Open Dependency-Track for the full list.")
          .locator("..")
          .getByRole("button", { name: /View in Dependency Track/ }),
      ).toBeVisible();
    });

    await test.step("[Critical] NotRun: Scan did not run, amber icon, message, tool button (C14)", async () => {
      await openScaTab(page, () => ({
        type: "Sca",
        status: "NotRun",
        message: "The sca-scan step did not succeed.",
        details: null,
        vulnerabilities: null,
      }));
      await expect(page.getByText("Scan did not run")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("The sca-scan step did not succeed.")).toBeVisible();
      await expect(page.getByTestId("report-unavailable-icon")).toHaveClass(/text-amber-600/);
      await expect(page.getByRole("button", { name: /View in Dependency Track/ })).toBeVisible();
    });

    await test.step("[Critical] Failed: Results not captured, red icon, message, tool button (C14)", async () => {
      await openScaTab(page, () => ({
        type: "Sca",
        status: "Failed",
        message: "Results were not captured.",
        details: null,
        vulnerabilities: null,
      }));
      await expect(page.getByText("Results not captured")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Results were not captured.")).toBeVisible();
      await expect(page.getByTestId("report-unavailable-icon")).toHaveClass(/text-red-600/);
      await expect(page.getByRole("button", { name: /View in Dependency Track/ })).toBeVisible();
    });

    await test.step("[Positive] a legacy report without status renders as before, no caption (H9)", async () => {
      const legacy = readySca();
      delete (legacy as ScaReport).status;
      delete (legacy as ScaReport).capturedAt;
      delete (legacy as ScaReport).analyzedAt;
      delete (legacy as ScaReport).findingsTruncated;
      await openScaTab(page, () => legacy);
      await expect(page.getByText("lib-CVE-2026-0001").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Analyzed /)).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Data Processing" })).toHaveCount(0);
    });
  });
});
