import fs from "fs";
import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { OSCreateProjectPage } from "@/pages/os/create-project.page";
import { PROJECT_NAME_FILE_PATH } from "@/support/project-name";
import testData from "@/constants/test-data.constant";
import routePaths from "@/constants/route-paths.constant";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const osBaseUrl = process.env.E2E_OS_BASE_URL;

test.describe("Authentication + project setup", () => {
  test.beforeAll(() => {
    if (!username || !password) {
      throw new Error(
        "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e before running.",
      );
    }
    if (!osBaseUrl) {
      throw new Error("E2E_OS_BASE_URL is not set. Set it in e2e/.env.e2e before running.");
    }
  });

  test("logs in, creates the run's test project in OS, and persists state", async ({ page }) => {
    // Extend the test timeout to cover an optional inspection hold at the end.
    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0);
    if (holdMs > 0) test.setTimeout(holdMs + 60_000);

    // 1. Blocks Release login page — a single CTA that starts the OIDC flow.
    await page.goto(routePaths.LOGIN);
    await page.getByRole("button", { name: "Log in to your account" }).click();

    // 2. Redirected to the dev-iam OIDC login page (/oidc/login, cross-origin).
    //    Selectors come from blocks-idp oidc-login-form.tsx (stable field ids).
    const emailField = page.locator("#oidc-email");
    await emailField.waitFor({ timeout: 30_000 });
    await emailField.fill(username!);
    await page.locator("#oidc-password").fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();

    // 3. Back on Blocks Release, authenticated → console.
    await page.waitForURL("**/app/console", { timeout: 45_000 });
    await expect(page).toHaveURL(/\/app\/console/);

    // Assert the console actually rendered — not just that the route changed.
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 20_000,
    });

    // Persist the authenticated session for future specs to reuse.
    await page.context().storageState({ path: "fixtures/auth.json" });

    // 4. Now create the run's test project in the OS app.
    const projectName = `E2E Test ${Date.now()}`;
    const osCreateProjectPage = new OSCreateProjectPage(page);
    const consolePage = new ConsolePage(page);

    await consolePage.goto();
    await consolePage.clickAddProject();
    await page.waitForURL(`${osBaseUrl}${routePaths.CREATE_PROJECT}`, {
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("textbox", { name: "Enter your project name" })
      .waitFor({ state: "visible" });

    await osCreateProjectPage.fillProjectName(projectName);
    await osCreateProjectPage.checkConfirmationCheckboxes();
    await osCreateProjectPage.clickContinue();
    await osCreateProjectPage.clickAddRepository();
    // GitHub auth is already handled by the saved storage state, so we skip
    // the popup step and just pick the configured test repo.
    await osCreateProjectPage.selectRepository(testData.TEST_REPO_OWNER, testData.TEST_REPO_NAME);
    await osCreateProjectPage.clickAdd();
    await osCreateProjectPage.clickContinue();
    await osCreateProjectPage.checkEnvironment(testData.ENVIRONMENTS.DEVELOPMENT);
    await osCreateProjectPage.clickSubmit();

    // Wait for the OS "Your project has been created." success toast before
    // moving on — otherwise the Release console can fetch the project list
    // before OS invalidates its cache and we'll see the empty state.
    await expect(
      page.locator("ol").filter({ hasText: "Your project has been created." }),
    ).toBeVisible({ timeout: 60_000 });

    // 5. Persist the project name so every spec + the global teardown can
    //    reference the same project without passing it through every file.
    fs.writeFileSync(PROJECT_NAME_FILE_PATH, JSON.stringify({ projectName }, null, 2), "utf8");

    // 6. Return to the Release console and wait for the new project card to
    //    appear before re-saving storage state — OS may have rotated cookies
    //    during the cross-origin flow, and subsequent specs need a session
    //    that already knows about the new project. Reload forces the console
    //    to refetch the project list (a soft goto reuses the stale render).
    await consolePage.goto();
    await page.reload();
    await expect(page.locator("div").filter({ hasText: projectName }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.context().storageState({ path: "fixtures/auth.json" });

    // Optionally keep the browser open to inspect the result before it closes.
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
  });
});
