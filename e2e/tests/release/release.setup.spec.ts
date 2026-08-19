import { test, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { reuseOrCreateSharedProject } from "../../support/create-and-delete-project"
import { loginThroughOidc } from "../../support/login-helper"
import {
  RELEASE_SESSION_PATH,
  writeReleaseProject,
} from "../../support/release-project"
import { resetRunOutcome } from "../../support/run-outcome"
import { sidebarNavItem } from "../../support/auth-helpers"

test.describe("release setup", () => {
  test("login, reuse or create one shared project, open Deployment", async ({ page }) => {
    test.setTimeout(300_000)
    resetRunOutcome()

    await loginThroughOidc(page)
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 50_000 })

    fs.mkdirSync(path.dirname(RELEASE_SESSION_PATH), { recursive: true })
    await page.context().storageState({ path: RELEASE_SESSION_PATH })

    const { projectName, dashboardUrl, itemId } = await reuseOrCreateSharedProject(page)
    if (!itemId) {
      throw new Error(`Could not resolve itemId from dashboard URL: ${dashboardUrl}`)
    }

    await sidebarNavItem(page, "Deployment").click()
    await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible({
      timeout: 30_000,
    })

    writeReleaseProject({
      projectName,
      itemId,
      dashboardUrl,
      deploymentUrl: page.url().replace(/\?.*$/, ""),
    })
  })
})
