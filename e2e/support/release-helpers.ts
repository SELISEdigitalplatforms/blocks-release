import { expect, type Page } from "@playwright/test"
import { readReleaseProject } from "./release-project"
import { sidebarNavItem } from "./auth-helpers"

export async function openReleaseConsole(page: Page) {
  await page.goto("/app/console")
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  })
}

export async function openReleaseDashboard(page: Page) {
  const fixture = readReleaseProject()
  if (!fixture?.dashboardUrl) {
    throw new Error("Shared release project missing. Run release.setup first.")
  }

  await page.goto(fixture.dashboardUrl)
  await expect(page.getByText(/^workspace$/i)).toBeVisible({ timeout: 50_000 })
}

export async function openReleaseOverview(page: Page) {
  await openReleaseDashboard(page)
  await sidebarNavItem(page, "Overview").click()
  await expect(page.getByRole("heading", { name: "Project Details" })).toBeVisible({
    timeout: 30_000,
  })
}

export async function openReleaseDeployment(page: Page) {
  await openReleaseDashboard(page)
  await sidebarNavItem(page, "Deployment").click()
  await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible({
    timeout: 30_000,
  })
}
