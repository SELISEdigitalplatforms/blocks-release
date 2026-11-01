import type { Page } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { openReleaseDeployment } from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * Live logs keep open steps open when another build's notification arrives (#236).
 *
 * Mocks `GET /build?buildId=` for a fake running build and dispatches
 * `BuildLogNotification` window events in the page, the same way
 * notification-hub-listener.tsx re-dispatches hub messages. No real build or
 * deployment is created, and Deploy is never clicked.
 */

const FAKE_REPO_ID = "e2e-live-logs-repo";
const FAKE_BUILD_ID = "e2e-live-logs-build";
const FOREIGN_BUILD_ID = "e2e-live-logs-other-build";
// Step header names may start with the status glyph, as in stepHeader below.
const STEP_NAMES = /^(?:[✓✕○]\s*)?(Clone|Build|Sast|Sca|Deploy)\b/;

function okEnvelope<T>(data: T) {
  return {
    isSuccess: true,
    statusCode: 200,
    message: null,
    errors: null,
    data,
  };
}

const historicalEvents = [
  {
    buildId: FAKE_BUILD_ID,
    eventType: "EventStarted",
    eventGroup: "Clone",
    message: "",
    createdAt: "2026-10-13T10:00:00Z",
  },
  {
    buildId: FAKE_BUILD_ID,
    eventType: "Log",
    eventGroup: "Clone",
    message: "e2e clone line one\ne2e clone line two",
    createdAt: "2026-10-13T10:00:05Z",
  },
  {
    buildId: FAKE_BUILD_ID,
    eventType: "EventFinished",
    eventGroup: "Clone",
    message: "",
    createdAt: "2026-10-13T10:00:06Z",
  },
  {
    buildId: FAKE_BUILD_ID,
    eventType: "EventStarted",
    eventGroup: "Build",
    message: "",
    createdAt: "2026-10-13T10:00:07Z",
  },
];

async function installLiveBuildMock(page: Page) {
  const buildCard = {
    blocksUserId: "u1",
    repoId: FAKE_REPO_ID,
    repoName: "e2e/live-logs-repo",
    repoUrl: "https://github.com/e2e/live-logs-repo",
    defaultDeploymentUrl: "https://live-logs.example.test",
    customDeploymentUrl: null,
    commit: "abc123",
    branch: "dev",
    imageName: "img",
    status: "Running",
    eventName: "push",
    duration: 0,
    buildImageName: null,
    pipelineRunName: "pr-1",
    html_url: null,
    events: historicalEvents,
    itemId: FAKE_BUILD_ID,
    createdDate: "2026-10-13T10:00:00Z",
    lastUpdatedDate: "2026-10-13T10:00:07Z",
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
}

async function openLiveLogs(page: Page) {
  await openReleaseDeployment(page);
  const fixture = readReleaseProject();
  const itemId = fixture?.itemId;
  test.skip(!itemId, "No shared Release project fixture");

  await installLiveBuildMock(page);
  const target = new URL(page.url());
  target.pathname = `/app/${itemId}/deployment/repo/${FAKE_REPO_ID}/deployment-live/${FAKE_BUILD_ID}`;
  target.search = "";
  await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Deployment logs" })).toBeVisible({
    timeout: 30_000,
  });
}

type LivePayload = {
  BuildId: string;
  EventGroup: string;
  EventType: string;
  Message: string;
  CreatedAt: string;
};

/**
 * Same detail shape notification-hub-listener.tsx dispatches; the component reads
 * `detail.message.denormalizedPayload` and takes its `Message`.
 */
async function dispatchBuildLog(page: Page, payloads: LivePayload[]) {
  await page.evaluate((items) => {
    for (const payload of items) {
      window.dispatchEvent(
        new CustomEvent("BuildLogNotification", {
          detail: {
            method: "BuildLogNotification",
            message: { denormalizedPayload: JSON.stringify({ Message: payload }) },
            timestamp: new Date().toISOString(),
          },
        }),
      );
    }
  }, payloads);
}

// The logs card is the nearest rounded-lg ancestor of its heading.
const logsCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Deployment logs" })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");

// The header's accessible name starts with its status icon's glyph (✓, ✕ or ○; none while running),
// e.g. "✓ Clone ~6.0s", so the step name may follow one glyph.
const stepHeader = (page: Page, name: string) =>
  logsCard(page).getByRole("button", { name: new RegExp(`^(?:[✓✕○]\\s*)?${name}\\b`) });

const expectExpanded = async (page: Page, name: string) => {
  await expect(stepHeader(page, name).locator("svg.lucide-chevron-down")).toBeVisible();
};

test.describe("Live logs keep open steps open (#236)", () => {
  test("foreign-build messages leave an expanded step open; own logs still auto-expand", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("[Positive] Open the live page and expand Clone", async () => {
      await openLiveLogs(page);
      await expect(stepHeader(page, "Clone")).toBeVisible({ timeout: 30_000 });
      await stepHeader(page, "Clone").click();
      await expectExpanded(page, "Clone");
      await expect(page.getByText("e2e clone line one")).toBeVisible();
      await expect(page.getByText("e2e clone line two")).toBeVisible();
    });

    await test.step("[Critical] Foreign-build messages change nothing (H1/H2/C3)", async () => {
      const at = "2026-10-13T10:01:00Z";
      await dispatchBuildLog(page, [
        // H1: another build's Log, for the same and for a different group.
        {
          BuildId: FOREIGN_BUILD_ID,
          EventGroup: "Clone",
          EventType: "Log",
          Message: "foreign clone line",
          CreatedAt: at,
        },
        {
          BuildId: FOREIGN_BUILD_ID,
          EventGroup: "Deploy",
          EventType: "Log",
          Message: "foreign deploy line",
          CreatedAt: at,
        },
        // H2: another build's lifecycle events.
        {
          BuildId: FOREIGN_BUILD_ID,
          EventGroup: "Build",
          EventType: "EventStarted",
          Message: "",
          CreatedAt: at,
        },
        {
          BuildId: FOREIGN_BUILD_ID,
          EventGroup: "Build",
          EventType: "EventFinished",
          Message: "",
          CreatedAt: at,
        },
        {
          BuildId: FOREIGN_BUILD_ID,
          EventGroup: "Deploy",
          EventType: "EventFailed",
          Message: "",
          CreatedAt: at,
        },
        // Sentinel: a current-build event that adds a log-less Sast step, so the
        // assertions below run only after every message above was handled.
        {
          BuildId: FAKE_BUILD_ID,
          EventGroup: "Sast",
          EventType: "EventStarted",
          Message: "",
          CreatedAt: at,
        },
      ]);
      await expect(stepHeader(page, "Sast")).toBeVisible();

      // H1/H2: Clone is still expanded with both lines.
      await expectExpanded(page, "Clone");
      await expect(page.getByText("e2e clone line one")).toBeVisible();
      await expect(page.getByText("e2e clone line two")).toBeVisible();
      // C3: no foreign step, line or toast.
      await expect(logsCard(page).getByRole("button", { name: STEP_NAMES })).toHaveCount(3);
      await expect(stepHeader(page, "Deploy")).toHaveCount(0);
      await expect(page.getByText("foreign clone line")).toHaveCount(0);
      await expect(page.getByText("foreign deploy line")).toHaveCount(0);
      await expect(page.getByText("Deployment Failed")).toHaveCount(0);
    });

    await test.step("[Positive] A current-build log for a new step auto-expands it (H5)", async () => {
      await dispatchBuildLog(page, [
        {
          BuildId: FAKE_BUILD_ID,
          EventGroup: "Deploy",
          EventType: "Log",
          Message: "e2e deploying now",
          CreatedAt: "2026-10-13T10:02:00Z",
        },
      ]);
      await expect(stepHeader(page, "Deploy")).toBeVisible();
      await expectExpanded(page, "Deploy");
      await expect(page.getByText("e2e deploying now")).toBeVisible();
      // H1: Clone stays open alongside it.
      await expectExpanded(page, "Clone");
      await expect(page.getByText("e2e clone line one")).toBeVisible();
    });
  });
});
