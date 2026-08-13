import fs from "fs";
import { chromium, expect } from "@playwright/test";
import { ConsolePage } from "@/pages/release/console.page";
import { PROJECT_NAME_FILE_PATH } from "@/support/project-name";
import testData from "@/constants/test-data.constant";

const AUTH_FILE = "fixtures/auth.json";

interface ProjectNameFile {
  projectName: string;
}

export default async function globalTeardown() {
  console.log(`[e2e teardown] started (project fixture: ${PROJECT_NAME_FILE_PATH})`);

  // The setup project may have failed before writing the project-name fixture.
  // In that case, there's nothing to clean up — don't throw, since teardown
  // failures would otherwise mask the real setup failure.
  if (!fs.existsSync(PROJECT_NAME_FILE_PATH)) {
    console.warn(
      `[e2e teardown] ${PROJECT_NAME_FILE_PATH} not found — skipping project deletion. ` +
        `Did the setup project run?`,
    );
    return;
  }

  if (!fs.existsSync(AUTH_FILE)) {
    console.warn(
      `[e2e teardown] ${AUTH_FILE} not found — skipping project deletion (no auth state to reuse).`,
    );
    return;
  }

  let projectName: string;
  try {
    const raw = fs.readFileSync(PROJECT_NAME_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProjectNameFile;
    projectName = parsed.projectName;
    if (!projectName) throw new Error("missing projectName field");
  } catch (err) {
    console.warn(
      `[e2e teardown] Failed to read project name from ${PROJECT_NAME_FILE_PATH}: ${err}. Skipping cleanup.`,
    );
    return;
  }

  const baseURL = process.env.E2E_BASE_URL;
  if (!baseURL) {
    console.warn(
      `[e2e teardown] E2E_BASE_URL is not set — skipping project deletion.`,
    );
    return;
  }

  console.log(
    `[e2e teardown] Deleting project "${projectName}" via ConsolePage...`,
  );

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL,
      storageState: AUTH_FILE,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const consolePage = new ConsolePage(page);

    await consolePage.goto();

    // The console renders the empty state ("0" projects) before the project
    // list finishes loading. Wait for the new project card to appear before
    // trying to click its settings — otherwise the click silently hits the
    // empty-state element and the delete flow never starts.
    await expect(
      page.locator("div").filter({ hasText: projectName }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await consolePage.clickProjectSettings(projectName);
    await consolePage.clickEnvironment(testData.ENVIRONMENTS.DEVELOPMENT);
    await consolePage.clickDeleteButton();
    await consolePage.confirmDelete();
    await consolePage.expectSuccessfullyDeletedToast();

    console.log(`[e2e teardown] Deleted project "${projectName}".`);
    await context.close();
  } catch (err) {
    // Surface the failure loudly but don't throw — the original suite failure
    // (if any) must remain visible. Re-raising would mask it.
    console.error(
      `[e2e teardown] Project deletion failed for "${projectName}":`,
      err,
    );
    console.error(
      `[e2e teardown] The project may need to be removed manually from the OS console.`,
    );
  } finally {
    await browser.close();
  }

  // Tidy up the fixture so a stale name doesn't bleed into the next run.
  try {
    fs.unlinkSync(PROJECT_NAME_FILE_PATH);
  } catch {
    // already gone — fine.
  }
}