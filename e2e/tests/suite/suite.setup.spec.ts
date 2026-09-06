import { test, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { reuseOrCreateSharedProject } from "../../support/create-and-delete-project"
import { loginThroughOidc } from "../../support/login-helper"
import { RELEASE_SESSION_PATH, writeReleaseProject } from "../../support/release-project"
import { resetRunOutcome } from "../../support/run-outcome"

test.describe("release suite setup", () => {
  test("login, reuse or create one shared project", async ({ page }) => {
    test.setTimeout(300_000)
    resetRunOutcome()

    await loginThroughOidc(page)
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 })

    const { projectName, dashboardUrl, itemId } = await reuseOrCreateSharedProject(page)
    if (!itemId) {
      throw new Error(`Could not resolve itemId from dashboard URL: ${dashboardUrl}`)
    }

    // Fail fast if E2E_BASE_URL points at another Blocks product (e.g. Monitor).
    // Release shell always exposes Deployment; Monitor exposes Monitor instead.
    const deploymentNav = page
      .getByRole("link", { name: "Deployment", exact: true })
      .or(page.getByRole("button", { name: "Deployment", exact: true }))
    const monitorNav = page.getByRole("link", { name: "Monitor", exact: true })
    if (await monitorNav.isVisible({ timeout: 2_000 }).catch(() => false)) {
      if (!(await deploymentNav.isVisible({ timeout: 1_000 }).catch(() => false))) {
        throw new Error(
          `Opened a non-Release product shell (saw Monitor, no Deployment). ` +
            `E2E_BASE_URL must be a Release host (got ${page.url()}). ` +
            `Use https://dev-release.blocksdevelopers.com or https://release.seliseblocks.com.`,
        )
      }
    }
    await expect(deploymentNav.first()).toBeVisible({ timeout: 15_000 })

    writeReleaseProject({
      projectName,
      itemId,
      dashboardUrl: dashboardUrl.replace(/\?.*$/, ""),
    })

    // Persist AFTER the shared project is open so localStorage keeps the selected
    // project/environment. Saving only post-login makes /app/{id}/dashboard bounce
    // back to /app/console in feature tests.
    fs.mkdirSync(path.dirname(RELEASE_SESSION_PATH), { recursive: true })
    await page.context().storageState({ path: RELEASE_SESSION_PATH })
  })
})
