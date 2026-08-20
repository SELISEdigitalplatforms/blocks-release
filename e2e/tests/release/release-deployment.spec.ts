import { test, expect } from "../../support/test-base"
import {
  connectFirstRepository,
  openReleaseDeployment,
  verifyAddRepositoryOpensOsTab,
} from "../../support/release-helpers"

/**
 * Deployment Overview -> Repository Details -> Configure Deployment modal.
 *
 * IMPORTANT: these tests never trigger a real deployment (no "Deploy Now" /
 * "Deploy" confirm click) since that provisions real Blocks Cloud
 * infrastructure. Modal/dialog interactions are verified via Cancel only.
 *
 * Auth: uses the shared project from release.setup.spec.ts (one login per suite).
 */
test.describe("Deployment", () => {
  test.beforeEach(async ({ page }) => {
    await openReleaseDeployment(page)
  })

  test("Deployment Overview", async ({ page }) => {
    const noRepoHeading = page.getByRole("heading", { name: "No repository added" })
    const repoCard = page.getByRole("button").filter({ hasText: "Deploys for" }).first()

    await test.step("[Positive] shows either the empty state or at least one repo card", async () => {
      const hasNoRepo = await noRepoHeading.isVisible().catch(() => false)
      const hasRepoCard = await repoCard.isVisible().catch(() => false)
      expect(hasNoRepo || hasRepoCard).toBeTruthy()
    })

    await test.step("[Positive] empty state offers an Add repository action", async () => {
      if (!(await noRepoHeading.isVisible().catch(() => false))) return

      await expect(page.getByRole("button", { name: "Add repository" })).toBeVisible()
      await expect(
        page.getByText(
          "To view deployment activity, please add at least one repository to your project",
        ),
      ).toBeVisible()
    })

    await test.step("[Security] Add repository opens Blocks OS in a separate tab (no in-app credential exposure)", async () => {
      if (await repoCard.isVisible().catch(() => false)) return

      const openedOsTab = await verifyAddRepositoryOpensOsTab(page)
      expect(openedOsTab).toBeTruthy()
    })

    await test.step("[Positive] repo card shows Repo URL, Deploys To and a Deployment Status badge", async () => {
      const linkedRepoCard = page.getByRole("button", { name: /Deploys for/ }).first()
      if (!(await linkedRepoCard.isVisible({ timeout: 8_000 }).catch(() => false))) return

      await expect(linkedRepoCard).toContainText("Repo URL")
      await expect(linkedRepoCard).toContainText("Deploys To")
      await expect(linkedRepoCard).toContainText("Deployment Status")
    })
  })

  test("Repository Details", async ({ page }) => {
    const repoCard = page.getByRole("button", { name: /Deploys for/ }).first()

    await test.step("Ensure repository is available", async () => {
      if (await repoCard.isVisible().catch(() => false)) return

      await connectFirstRepository(page)
      await openReleaseDeployment(page)
    })

    if (!(await repoCard.isVisible().catch(() => false))) {
      test.skip(true, "No repository linked (GitHub authorization required on OS).")
    }

    await test.step("[Positive] opening a repo card navigates to Repository Details", async () => {
      await expect(repoCard).toBeVisible({ timeout: 30_000 })
      await repoCard.click()
      await expect(page).toHaveURL(/\/deployment\/repo\//, { timeout: 30_000 })
      await expect(page.getByRole("heading", { name: /Repository Details/i }).first()).toBeVisible({
        timeout: 30_000,
      })
    })

    const noDeploymentsHeading = page.getByRole("heading", { name: "No deployments available" })
    const hasNoDeployments = await noDeploymentsHeading.isVisible().catch(() => false)

    await test.step("[Positive] never-deployed repo shows the empty state with Deploy Now", async () => {
      if (!hasNoDeployments) return

      await expect(
        page.getByText("This repository has not been deployed yet. Click the deploy"),
      ).toBeVisible()
      await expect(page.getByRole("button", { name: "Deploy Now" })).toBeVisible()
    })

    await test.step("[Positive] Deploy Now opens the Configure Deployment modal with both deployment types", async () => {
      if (!hasNoDeployments) return

      await page.getByRole("button", { name: "Deploy Now" }).click()

      const dialog = page.getByRole("dialog", { name: "Configure Deployment" })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText("Deployment Type", { exact: true })).toBeVisible()
      await expect(dialog.getByLabel("Git based deployment")).toBeVisible()
      await expect(dialog.getByLabel("Blocks Cloud based deployment")).toBeVisible()
    })

    await test.step("[Negative] Cancel closes Configure Deployment without starting a deployment", async () => {
      if (!hasNoDeployments) return

      const dialog = page.getByRole("dialog", { name: "Configure Deployment" })
      await dialog.getByRole("button", { name: "Cancel" }).click()
      await expect(dialog).toBeHidden()
      await expect(noDeploymentsHeading).toBeVisible()
    })

    await test.step("[Positive] deployed repo shows Deployment Information with Repo URL and status", async () => {
      if (hasNoDeployments) return

      await expect(page.getByRole("heading", { name: "Deployment Information" })).toBeVisible()
      await expect(page.getByText("Repo URL", { exact: true })).toBeVisible()
      await expect(page.getByText("Deployment Status", { exact: true })).toBeVisible()
    })

    await test.step("[Negative] Deploy confirmation can be dismissed via Cancel without redeploying", async () => {
      if (hasNoDeployments) return

      await page.getByRole("button", { name: "Deploy", exact: true }).click()

      const confirmDialog = page.getByRole("dialog", { name: "Confirm Deployment" })
      await expect(confirmDialog).toBeVisible()

      await confirmDialog.getByRole("button", { name: "Cancel" }).click()
      await expect(confirmDialog).toBeHidden()
    })

    await test.step("[Positive] back button returns to Deployment Overview", async () => {
      await page.getByRole("button", { name: "Go back" }).click()
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible()
    })
  })
})
