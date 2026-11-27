import { test, expect, type Page } from "../../support/test-base";
import type { Locator, Route, TestInfo } from "@playwright/test";
import { openReleaseDeployment } from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * Git based deployment answers truthfully when GitHub refuses (#279, spec §10).
 *
 * GitHub OAuth is unavailable to the e2e account, so every GitHub outcome is
 * stubbed at the blocks-release API boundary with `page.route` (the
 * env-paste-mode.spec.ts pattern): repos-list and repo-details serve a fake
 * repository `e2e/webhook-repo`, build/settings serves one Azure provider in
 * West Europe with one active spec, and run-build / repo-settings-update answer
 * per step while their request bodies are captured. No server state changes.
 *
 * Real GitHub behaviour (webhook rights, hook created or left inactive) is
 * proven by the server's xUnit tests and by the spec's manual dev check (A6),
 * which needs real GitHub accounts and is not run here.
 */

const FAKE_REPO_ID = "e2e-webhook-repo";
const REPO_NAME = "e2e/webhook-repo";
const FAKE_BUILD_ID = "e2e-webhook-build";
const REPO_BRANCH = "main";

const PERMISSION_TEXT = "Your GitHub account can't manage webhooks on e2e/webhook-repo.";
const DEPLOY_HINT = "To deploy now, switch to Blocks Cloud based deployment in Settings.";
const NOT_CONNECTED_TEXT = "Connect your GitHub account to use Git based deployment.";
const STILL_ACTIVE_TEXT =
  "Push deploys are off. The GitHub webhook on e2e/webhook-repo is still active";
const NOT_WORKING_TEXT =
  "Settings saved, but Git based deployment isn't working: GitHub didn't respond.";
const SAML_DETAIL = "Resource protected by organization SAML enforcement.";
const WEBHOOK_FAILED_TEXT = `GitHub couldn't set up the webhook on e2e/webhook-repo: ${SAML_DETAIL}`;
const MONITOR_ERROR = "Failed to add the repository to Blocks Monitor.";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

type DeploymentType = "Manual" | "Auto";
type StubAnswer = { status: number; body: unknown };

type WebhookStubs = {
  deploymentType: DeploymentType;
  withBuild: boolean;
  runBuild?: StubAnswer;
  settingsUpdate?: StubAnswer;
};

type Captured = {
  runBuild: Record<string, unknown>[];
  settingsUpdate: Record<string, unknown>[];
};

function okEnvelope<T>(data: T) {
  return {
    isSuccess: true,
    statusCode: 200,
    message: null,
    errors: null,
    data,
  };
}

const fulfillJson = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

function fakeRepo(deploymentType: DeploymentType) {
  return {
    itemId: FAKE_REPO_ID,
    repoName: REPO_NAME,
    branch: REPO_BRANCH,
    repoUrl: `https://github.com/${REPO_NAME}`,
    defaultDeploymentUrl: "https://webhook-repo.example.test",
    customDeploymentUrl: "",
    deploymentType,
    lastDeploymentDate: null,
    deployedNamespace: null,
    lastDeploymentStatus: null,
    deploySettings: {},
  };
}

const fakeBuild = {
  blocksUserId: "u1",
  repoId: FAKE_REPO_ID,
  repoName: REPO_NAME,
  repoUrl: `https://github.com/${REPO_NAME}`,
  defaultDeploymentUrl: "https://webhook-repo.example.test",
  customDeploymentUrl: null,
  commit: "abc123",
  branch: REPO_BRANCH,
  imageName: "img",
  status: "Succeeded",
  eventName: "push",
  duration: 12,
  buildImageName: null,
  pipelineRunName: "pr-webhook-1",
  html_url: null,
  events: [],
  itemId: FAKE_BUILD_ID,
  createdDate: "2026-11-20T00:00:00Z",
  lastUpdatedDate: "2026-11-20T00:00:00Z",
  createdBy: "e2e",
  language: null,
  lastUpdatedBy: null,
  organizationIds: [],
  tags: [],
};

const azureSpecs = [
  {
    id: "provider-azure",
    name: "Azure",
    region: [
      {
        id: "region-west-europe",
        name: "West Europe",
        machineSpecs: [{ id: "spec-active", name: "Standard", status: "active" }],
      },
    ],
  },
];

async function installWebhookStubs(page: Page, stubs: WebhookStubs): Promise<Captured> {
  const captured: Captured = { runBuild: [], settingsUpdate: [] };
  const repo = fakeRepo(stubs.deploymentType);
  const builds = stubs.withBuild ? [fakeBuild] : [];

  await page.route("**/build/repos-list**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await fulfillJson(
      route,
      200,
      okEnvelope([
        {
          ...repo,
          sourceRepoId: "src-1",
          blocksUserId: null,
          projectId: null,
          projectName: null,
          commit: null,
          createdDate: "2026-11-20T00:00:00Z",
          lastUpdatedDate: "2026-11-20T00:00:00Z",
          organizationIds: [],
          tags: [],
        },
      ]),
    );
  });

  await page.route("**/build/repo-details**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await fulfillJson(route, 200, okEnvelope({ repo, build: builds, totalCount: builds.length }));
  });

  await page.route("**/build/settings**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await fulfillJson(route, 200, okEnvelope(azureSpecs));
  });

  await page.route("**/build?**", async (route) => {
    const url = route.request().url();
    if (route.request().method() !== "GET" || !url.includes("buildId=")) {
      return route.fallback();
    }
    if (url.includes("/reports")) return route.fallback();
    await fulfillJson(route, 200, okEnvelope(fakeBuild));
  });

  await page.route("**/build/run-build**", async (route) => {
    // GET run-build?repoId= reads logs; only the deploy (POST) is stubbed.
    if (route.request().method() !== "POST" || !stubs.runBuild) {
      return route.fallback();
    }
    captured.runBuild.push(route.request().postDataJSON());
    await fulfillJson(route, stubs.runBuild.status, stubs.runBuild.body);
  });

  await page.route("**/build/repo-settings-update**", async (route) => {
    if (route.request().method() !== "POST" || !stubs.settingsUpdate) {
      return route.fallback();
    }
    captured.settingsUpdate.push(route.request().postDataJSON());
    await fulfillJson(route, stubs.settingsUpdate.status, stubs.settingsUpdate.body);
  });

  return captured;
}

/** Opens the shared project's Deployment area, installs the stubs and lands on the fake repository. */
async function openStubbedRepo(page: Page, stubs: WebhookStubs): Promise<Captured> {
  // The shared navigation helper uses the desktop sidebar (behind a menu button on mobile),
  // so reach the project at desktop width and switch to the test's own viewport afterwards.
  const viewport = page.viewportSize();
  await page.setViewportSize(DESKTOP);
  await openReleaseDeployment(page);
  if (viewport) await page.setViewportSize(viewport);
  const itemId = readReleaseProject()?.itemId;
  test.skip(!itemId, "No shared Release project fixture");

  const captured = await installWebhookStubs(page, stubs);
  const target = new URL(page.url());
  target.pathname = `/app/${itemId}/deployment/repo/${FAKE_REPO_ID}`;
  target.search = "";
  await page.goto(target.toString(), { waitUntil: "domcontentloaded" });

  if (stubs.withBuild) {
    await expect(page.getByRole("heading", { name: "Deployment Information" })).toBeVisible({
      timeout: 30_000,
    });
  } else {
    await expect(page.getByRole("heading", { name: /Repository Details/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  }
  return captured;
}

/** The open toast that contains `text`. */
function toastWith(page: Page, text: string): Locator {
  return page.locator("li[data-state='open']").filter({ hasText: text });
}

async function expectDestructiveToast(page: Page, ...texts: string[]) {
  const toast = toastWith(page, texts[0]);
  await expect(toast).toBeVisible({ timeout: 30_000 });
  for (const text of texts) await expect(toast).toContainText(text);
  await expect(toast).toHaveClass(/\bdestructive\b/);
  return toast;
}

async function expectWarningToast(page: Page, text: string) {
  const toast = toastWith(page, text);
  await expect(toast).toBeVisible({ timeout: 30_000 });
  // The warning variant of toast.tsx (spec §4: L37).
  await expect(toast).toHaveClass(/border-yellow-500/);
  return toast;
}

function modeRadio(dialog: Locator, label: string): Locator {
  return dialog.getByRole("radio", { name: label });
}

async function openFirstDeployDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Deploy Now" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Configure Deployment" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function openSettingsModal(page: Page): Promise<Locator> {
  // On mobile the "Configure" label is hidden; the button keeps its settings icon.
  await page.locator("button:has(svg.lucide-settings)").first().click();
  const dialog = page.getByRole("dialog", { name: "Deployment Settings" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
  }, theme);
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
}

/** Light and dark screenshots for the spec's §4 visual check. */
async function captureThemes(page: Page, testInfo: TestInfo, name: string) {
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    // Recorded for the §4 visual check: the dialog's computed background in this theme, read once
    // it has settled (colour transitions run after the theme class changes).
    const dialog = page.getByRole("dialog").first();
    const readBackground = () => dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
    let dialogBackground = await readBackground();
    await expect
      .poll(async () => {
        const previous = dialogBackground;
        await page.waitForTimeout(250);
        dialogBackground = await readBackground();
        return dialogBackground === previous;
      })
      .toBe(true);
    testInfo.annotations.push({
      type: "visual-check",
      description: `${name} ${theme}: dialog background ${dialogBackground}`,
    });
    const path = testInfo.outputPath(`${name}-${theme}.png`);
    await page.screenshot({ path });
    await testInfo.attach(`${name}-${theme}`, {
      path,
      contentType: "image/png",
    });
  }
  await setTheme(page, "light");
}

const firstDeployRefused: WebhookStubs = {
  deploymentType: "Manual",
  withBuild: false,
  runBuild: {
    status: 400,
    body: {
      isSuccess: false,
      message: "GitHub refused the webhook.",
      errors: { webhook: "GITHUB_WEBHOOK_PERMISSION" },
    },
  },
};

const settingsRefused: WebhookStubs = {
  deploymentType: "Manual",
  withBuild: true,
  settingsUpdate: {
    status: 400,
    body: {
      isSuccess: false,
      message: "GitHub refused the webhook.",
      errors: { webhook: "GITHUB_NOT_CONNECTED" },
    },
  },
};

async function stepFirstDeployRefused(page: Page): Promise<Locator> {
  const captured = await openStubbedRepo(page, firstDeployRefused);
  const dialog = await openFirstDeployDialog(page);
  const gitBased = modeRadio(dialog, "Git based deployment");
  await gitBased.click();
  await expect(gitBased).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Deploy Now" }).click();

  await expect.poll(() => captured.runBuild.length).toBe(1);
  expect(captured.runBuild[0].deploymentType).toBe("auto");
  const toast = await expectDestructiveToast(
    page,
    PERMISSION_TEXT,
    DEPLOY_HINT,
    "Deployment Failed",
  );

  await expect(dialog).toBeVisible();
  await expect(gitBased).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("button", { name: "Deploy Now" })).toBeEnabled();
  return toast;
}

async function stepSettingsRefused(page: Page): Promise<Locator> {
  const captured = await openStubbedRepo(page, settingsRefused);
  const dialog = await openSettingsModal(page);
  const gitBased = modeRadio(dialog, "Git based deployment");
  await expect(modeRadio(dialog, "Blocks Cloud based deployment")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await gitBased.click();
  await dialog.getByRole("button", { name: "Save Settings" }).click();

  await expect.poll(() => captured.settingsUpdate.length).toBe(1);
  expect(captured.settingsUpdate[0].deploymentType).toBe("auto");
  const toast = await expectDestructiveToast(page, NOT_CONNECTED_TEXT);

  await expect(dialog).toBeVisible();
  await expect(gitBased).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("button", { name: "Save Settings" })).toBeEnabled();
  return toast;
}

test.describe("Git based deployment webhook responses (#279), desktop", () => {
  test.use({ viewport: DESKTOP });

  test("[Critical] 1. First deploy refused keeps the dialog open (H3, C1, C2, C5, C18)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await stepFirstDeployRefused(page);
  });

  test("[Positive] 2. First deploy with warning navigates and warns (H3, C7, H13)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const captured = await openStubbedRepo(page, {
      deploymentType: "Auto",
      withBuild: false,
      runBuild: {
        status: 200,
        body: {
          isSuccess: true,
          buildId: "b-1",
          warning: {
            code: "WEBHOOK_STILL_ACTIVE",
            reason: "GITHUB_WEBHOOK_PERMISSION",
            message: "Push deploys are off, but the webhook is still active.",
            detail: null,
          },
        },
      },
    });
    const dialog = await openFirstDeployDialog(page);
    await expect(modeRadio(dialog, "Git based deployment")).toHaveAttribute("aria-checked", "true");
    await modeRadio(dialog, "Blocks Cloud based deployment").click();
    await dialog.getByRole("button", { name: "Deploy Now" }).click();

    await expect.poll(() => captured.runBuild.length).toBe(1);
    expect(captured.runBuild[0].deploymentType).toBe("manual");
    await expect(page).toHaveURL(/\/deployment-live\/b-1(?:[/?#]|$)/, {
      timeout: 30_000,
    });
    await expectWarningToast(page, STILL_ACTIVE_TEXT);
  });

  test("[Critical] 3. Settings refused keeps the modal open (C1, C3, C18)", async ({ page }) => {
    test.setTimeout(180_000);
    await stepSettingsRefused(page);
  });

  test("[Positive] 4. Settings saved with warning closes the modal and warns (C8, H13)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const captured = await openStubbedRepo(page, {
      deploymentType: "Auto",
      withBuild: true,
      settingsUpdate: {
        status: 200,
        body: {
          isSuccess: true,
          warning: {
            code: "WEBHOOK_NOT_WORKING",
            reason: "GITHUB_UNREACHABLE",
            message: "Settings saved, but the webhook is not working.",
            detail: null,
          },
        },
      },
    });
    const dialog = await openSettingsModal(page);
    await expect(modeRadio(dialog, "Git based deployment")).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("button", { name: "Save Settings" }).click();

    await expect.poll(() => captured.settingsUpdate.length).toBe(1);
    expect(captured.settingsUpdate[0].deploymentType).toBe("auto");
    await expectWarningToast(page, NOT_WORKING_TEXT);
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });

  test("[Critical] 5. Redeploy refused shows GitHub's detail (C5, A1)", async ({ page }) => {
    test.setTimeout(180_000);
    const captured = await openStubbedRepo(page, {
      deploymentType: "Auto",
      withBuild: true,
      runBuild: {
        status: 400,
        body: {
          isSuccess: false,
          message: "GitHub refused the webhook.",
          errors: {
            webhook: "GITHUB_WEBHOOK_FAILED",
            webhookDetail: SAML_DETAIL,
          },
        },
      },
    });
    await page.getByRole("button", { name: "Deploy", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Confirm Deployment" });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await confirm.getByRole("button", { name: "Deploy Now" }).click();

    await expect.poll(() => captured.runBuild.length).toBe(1);
    await expectDestructiveToast(page, WEBHOOK_FAILED_TEXT, DEPLOY_HINT, "Deployment Failed");
    await expect(confirm).toBeVisible();
  });

  test("[Positive] 6. Deploy with both warning and monitor error shows both secondary toasts (H13)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // monitorError only exists on a first deploy (the monitor is created once, right after the
    // first build; repo-details shows it only there), so this step runs the first-deploy path.
    const captured = await openStubbedRepo(page, {
      deploymentType: "Auto",
      withBuild: false,
      runBuild: {
        status: 200,
        body: {
          isSuccess: true,
          buildId: "b-2",
          monitorError: MONITOR_ERROR,
          warning: {
            code: "WEBHOOK_STILL_ACTIVE",
            reason: "GITHUB_WEBHOOK_PERMISSION",
            message: "Push deploys are off, but the webhook is still active.",
            detail: null,
          },
        },
      },
    });
    const dialog = await openFirstDeployDialog(page);
    await modeRadio(dialog, "Blocks Cloud based deployment").click();
    await dialog.getByRole("button", { name: "Deploy Now" }).click();

    await expect.poll(() => captured.runBuild.length).toBe(1);
    await expect(page).toHaveURL(/\/deployment-live\/b-2(?:[/?#]|$)/, {
      timeout: 30_000,
    });
    await expectWarningToast(page, STILL_ACTIVE_TEXT);
    await expect(toastWith(page, MONITOR_ERROR)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("[Critical] 7. Settings failure without a webhook code keeps today's toast (C15)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const captured = await openStubbedRepo(page, {
      deploymentType: "Auto",
      withBuild: true,
      settingsUpdate: {
        status: 400,
        body: { isSuccess: false, message: "Failed to update." },
      },
    });
    const dialog = await openSettingsModal(page);
    await dialog.getByRole("button", { name: "Save Settings" }).click();

    await expect.poll(() => captured.settingsUpdate.length).toBe(1);
    await expectDestructiveToast(page, "Failed to update settings");
    await expect(dialog).toBeVisible();
  });
});

test.describe("Git based deployment webhook responses (#279), mobile", () => {
  test.use({ viewport: MOBILE });

  test("[Critical] 1m. First deploy refused at 390x844, light and dark", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await stepFirstDeployRefused(page);
    await captureThemes(page, testInfo, "step1-first-deploy-refused-390x844");
  });

  test("[Critical] 3m. Settings refused at 390x844, light and dark", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await stepSettingsRefused(page);
    await captureThemes(page, testInfo, "step3-settings-refused-390x844");
  });
});
