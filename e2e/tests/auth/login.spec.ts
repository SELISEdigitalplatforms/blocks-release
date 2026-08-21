import { test, expect } from "../../support/test-base"
import fs from "fs"
import path from "path"
import { e2eCredentials } from "../../support/env"
import { loginThroughOidc } from "../../support/login-helper"
import { RELEASE_SESSION_PATH } from "../../support/release-project"

test.describe("Authentication", () => {
  test.beforeAll(() => {
    e2eCredentials()
  })

  test("logs in through dev-iam and lands on the console", async ({ page }) => {
    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0)
    if (holdMs > 0) test.setTimeout(holdMs + 120_000)

    await loginThroughOidc(page)

    await expect(
      page.getByRole("heading", {
        name: /Your Blocks Projects|Welcome to SELISE Blocks/,
      }),
    ).toBeVisible({ timeout: 20_000 })

    // Refresh the shared session used by [release] / [release-teardown].
    // release-setup already wrote project fixtures; this login has a full cookie
    // jar so feature deep-links do not bounce to /login.
    fs.mkdirSync(path.dirname(RELEASE_SESSION_PATH), { recursive: true })
    await page.context().storageState({ path: RELEASE_SESSION_PATH })
    await page.context().storageState({ path: "fixtures/auth.json" })

    if (holdMs > 0) {
      await page.waitForTimeout(holdMs)
    }
  })
})
