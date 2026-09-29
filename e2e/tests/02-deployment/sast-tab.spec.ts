import { test, expect, type Page } from "../../support/test-base";
import { openReleaseDeployment } from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * SAST tab New/Overall Code (#209) + Quality Gate conditions (#210).
 *
 * Mocks `GET /build?buildId=` and `GET /build/reports?type=sast` so the
 * deployed client bundle is exercised without needing a Sonar-backed build.
 * Never clicks Deploy.
 */

const FAKE_REPO_ID = "e2e-sast-repo";
const FAKE_BUILD_ID = "e2e-sast-build";

function okEnvelope<T>(data: T) {
  return {
    isSuccess: true,
    statusCode: 200,
    message: null,
    errors: null,
    data,
  };
}

const sastDetailsHappy = {
  alert_status: "OK",
  ncloc: "1200",
  new_violations: "69",
  new_coverage: "0.0",
  new_lines_to_cover: "780",
  new_duplicated_lines_density: "1.44",
  new_lines: "5512",
  new_security_hotspots: "1",
  new_security_review_rating: "5.0",
  new_code_period_date: "2026-08-10T09:12:00+0000",
  new_code_period_mode: "previous_version",
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
  coverage: "80",
  lines_to_cover: "500",
};

type SastReportExtras = {
  qualityGate?: unknown;
  issueBreakdown?: unknown;
};

async function installSastMocks(
  page: Page,
  details: Record<string, string> | null,
  extras: SastReportExtras = {},
) {
  const buildCard = {
    blocksUserId: "u1",
    repoId: FAKE_REPO_ID,
    repoName: "e2e/sast-repo",
    repoUrl: "https://github.com/e2e/sast-repo",
    defaultDeploymentUrl: "https://sast.example.test",
    customDeploymentUrl: null,
    commit: "abc123",
    branch: "dev",
    imageName: "img",
    status: "Succeeded",
    eventName: "push",
    duration: 12,
    buildImageName: null,
    pipelineRunName: "pr-1",
    html_url: null,
    events: [],
    itemId: FAKE_BUILD_ID,
    createdDate: "2026-09-29T00:00:00Z",
    lastUpdatedDate: "2026-09-29T00:00:00Z",
    createdBy: "e2e",
    language: null,
    lastUpdatedBy: null,
    organizationIds: [],
    tags: [],
  };

  await page.route("**/build?**", async (route) => {
    const url = route.request().url();
    if (!url.includes("buildId=") || route.request().method() !== "GET") {
      return route.fallback();
    }
    if (url.includes("/reports")) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(okEnvelope(buildCard)),
    });
  });

  await page.route("**/build/reports**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    if (url.searchParams.get("type") !== "sast") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope({
          type: "SAST",
          details,
          vulnerabilities: null,
          qualityGate: extras.qualityGate ?? null,
          issueBreakdown: extras.issueBreakdown ?? null,
        }),
      ),
    });
  });
}

async function openSastTab(
  page: Page,
  details: Record<string, string> | null,
  extras: SastReportExtras = {},
) {
  await openReleaseDeployment(page);
  const fixture = readReleaseProject();
  const itemId = fixture?.itemId;
  test.skip(!itemId, "No shared Release project fixture");

  await installSastMocks(page, details, extras);
  const target = new URL(page.url());
  target.pathname = `/app/${itemId}/deployment/repo/${FAKE_REPO_ID}/deployment-logs/${FAKE_BUILD_ID}`;
  target.search = "tab=sast";
  await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  // Top-level SAST/SCA/DAST controls are buttons in a nav, not ARIA tabs.
  await expect(page.getByRole("button", { name: "SAST" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("SAST tab New Code / Overall Code (#209)", () => {
  test("New Code default, Overall Code ratings, empty and not-computed states", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("[Positive] New Code selected by default with Example 1 numbers (H3)", async () => {
      await openSastTab(page, sastDetailsHappy);
      await expect(page.getByRole("tab", { name: "New Code" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Quality Gate")).toBeVisible();
      await expect(page.getByText("Passed").first()).toBeVisible();
      await expect(page.getByRole("tab", { name: "New Code" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(
        page.getByText(/New code: Since August 10, 2026/),
      ).toBeVisible();
      await expect(page.getByTestId("sast-stat-new-issues")).toContainText("69");
    });

    await test.step("[Positive] Overall Code shows Reliability 13 with C (H4/H5)", async () => {
      await page.getByRole("tab", { name: "Overall Code" }).click();
      await expect(
        page.getByRole("tab", { name: "Overall Code" }),
      ).toHaveAttribute("data-state", "active");
      await expect(
        page.getByTestId("sast-stat-overall-reliability"),
      ).toContainText("13");
      await expect(
        page.getByTestId("sast-rating-overall-reliability"),
      ).toHaveText("C");
    });

    await test.step("[Critical] details null shows Data Processing (C1)", async () => {
      await openSastTab(page, null);
      await expect(page.getByText("Data Processing")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Passed")).toHaveCount(0);
    });

    await test.step("[Critical] new_lines 0 shows No new lines (C5)", async () => {
      await openSastTab(page, { ...sastDetailsHappy, new_lines: "0" });
      await expect(page.getByText("No new lines to analyze")).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("[Critical] missing alert_status → Not computed (C4)", async () => {
      const { alert_status: _, ...rest } = sastDetailsHappy;
      await openSastTab(page, rest);
      await expect(page.getByText("Not computed")).toBeVisible({
        timeout: 30_000,
      });
    });
  });
});

const failedGate = {
  status: "ERROR" as const,
  conditions: [
    {
      metricKey: "new_violations",
      comparator: "GT" as const,
      errorThreshold: "0",
      actualValue: "69",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_security_hotspots_reviewed",
      comparator: "LT" as const,
      errorThreshold: "100",
      actualValue: "0.0",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_coverage",
      comparator: "LT" as const,
      errorThreshold: "5.0",
      actualValue: "0.0",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_duplicated_lines_density",
      comparator: "GT" as const,
      errorThreshold: "25.0",
      actualValue: "1.44",
      status: "OK" as const,
    },
  ],
};

const issueBreakdown = {
  newCode: { total: 69, blocker: 0, high: 3, medium: 40, low: 20, info: 6 },
  overall: { total: 112, blocker: 1, high: 13, medium: 60, low: 30, info: 8 },
};

test.describe("SAST tab Quality Gate conditions (#210 Phase 2)", () => {
  test("failed conditions, Failed badges, severity rows, and Data Processing", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("[Positive] Failed gate shows conditions and badges (H3/H4/H6)", async () => {
      await openSastTab(
        page,
        { ...sastDetailsHappy, alert_status: "ERROR" },
        { qualityGate: failedGate, issueBreakdown },
      );
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Failed").first()).toBeVisible();
      await expect(page.getByText("3 conditions failed")).toBeVisible();
      await expect(page.getByText(/is greater than 0/)).toBeVisible();
      await expect(page.getByTestId("sast-failed-new-issues")).toBeVisible();
      await expect(page.getByTestId("sast-failed-new-coverage")).toBeVisible();
      await expect(page.getByTestId("sast-failed-new-hotspots")).toBeVisible();
      await expect(page.getByText("Required = 0")).toBeVisible();
      await expect(page.getByText("High 3")).toBeVisible();
    });

    await test.step("[Positive] Overall severity row (H5)", async () => {
      await page.getByRole("tab", { name: "Overall Code" }).click();
      await expect(page.getByText("High 13")).toBeVisible();
      await expect(page.getByText("Blocker 1")).toBeVisible();
    });

    await test.step("[Positive] All conditions passed (H6)", async () => {
      const okGate = {
        status: "OK" as const,
        conditions: failedGate.conditions.map((c) => ({
          ...c,
          status: "OK" as const,
        })),
      };
      await openSastTab(page, sastDetailsHappy, {
        qualityGate: okGate,
        issueBreakdown,
      });
      await expect(page.getByText("Passed").first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("All conditions passed")).toBeVisible();
    });

    await test.step("[Critical] details null ignores gate payload (C3)", async () => {
      await openSastTab(page, null, {
        qualityGate: failedGate,
        issueBreakdown,
      });
      await expect(page.getByText("Data Processing")).toBeVisible({
        timeout: 30_000,
      });
    });
  });
});
