import { expect, type Page } from "@playwright/test"
import {
  ensureConsole,
  namedProjectCard,
} from "./create-and-delete-project"
import { ensureAuthenticatedOnCurrentOrigin } from "./login-helper"
import { readReleaseProject } from "./release-project"
import { openSharedProjectDashboard } from "./suite-helpers"
import { sidebarNavItem } from "./auth-helpers"

const consoleHeading = (page: Page) =>
  page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ })

export async function openReleaseConsole(page: Page) {
  await page.goto("/app/console")
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function openReleaseDashboard(page: Page) {
  await openSharedProjectDashboard(page)
  const fixture = readReleaseProject()
  return { projectName: fixture?.projectName ?? "" }
}

/**
 * Enter the shared project shell, then click Overview in the sidebar.
 */
export async function openReleaseOverview(page: Page) {
  await openSharedProjectDashboard(page)
  const fixture = readReleaseProject()

  const overviewLink = sidebarNavItem(page, "Overview")
  await overviewLink.waitFor({ state: "visible", timeout: 30_000 })
  await overviewLink.click()

  await expect(page.getByRole("heading", { name: "Project Details" }))
    .toBeVisible({ timeout: 30_000 })
    .catch(async () => {
      await overviewLink.click()
      await expect(page.getByRole("heading", { name: "Project Details" })).toBeVisible({
        timeout: 30_000,
      })
    })

  return { projectName: fixture?.projectName ?? "" }
}

/**
 * Open Deployment for the shared project via dashboard → sidebar nav.
 * Does not seed Deployment in suite setup — features own their navigation.
 */
export async function openReleaseDeployment(page: Page) {
  await openSharedProjectDashboard(page)
  const fixture = readReleaseProject()

  const deploymentHeading = page.getByRole("heading", { name: "Deployment Overview" })
  const deploymentLink = sidebarNavItem(page, "Deployment").first()

  if (!(await deploymentLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
    const onMonitor = await page
      .getByRole("link", { name: "Monitor", exact: true })
      .isVisible({ timeout: 1_000 })
      .catch(() => false)
    throw new Error(
      onMonitor
        ? `Deployment nav missing — page looks like Blocks Monitor (${page.url()}). ` +
          `Set E2E_BASE_URL to a Release host, not monitor.`
        : `Deployment nav not visible on ${page.url()}. Is the shared Release project open?`,
    )
  }

  await deploymentLink.click()
  await expect(deploymentHeading).toBeVisible({ timeout: 30_000 })

  return { projectName: fixture?.projectName ?? "" }
}

async function openSharedProjectRepositories(osPage: Page) {
  const fixture = readReleaseProject()
  const repositoriesHeading = osPage.getByRole("heading", { name: "Repositories" })
  if (await repositoriesHeading.isVisible({ timeout: 8_000 }).catch(() => false)) {
    return
  }

  await ensureAuthenticatedOnCurrentOrigin(osPage)
  await ensureConsole(osPage, "os")

  if (fixture?.projectName) {
    const card = namedProjectCard(osPage, fixture.projectName)
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.getByTestId("project-card-configure").click()
  } else {
    await osPage.getByTestId("project-card-configure").first().click()
  }

  await osPage.getByRole("link", { name: "Repositories" }).click()
  await expect(repositoriesHeading).toBeVisible({ timeout: 30_000 })
}

async function trySelectFirstRepository(osPage: Page): Promise<boolean> {
  const connectHeading = osPage.getByRole("heading", { name: "Connect repository" })
  const selectHeading = osPage.getByRole("heading", { name: "Select repository" })

  const headed = await Promise.race([
    connectHeading.waitFor({ state: "visible", timeout: 15_000 }).then(() => "connect" as const),
    selectHeading.waitFor({ state: "visible", timeout: 15_000 }).then(() => "select" as const),
  ]).catch(() => null)

  if (!headed) {
    await osPage.keyboard.press("Escape").catch(() => {})
    return false
  }

  if (headed === "connect" || (await connectHeading.isVisible().catch(() => false))) {
    const githubButton = osPage.getByRole("button", { name: /Continue with GitHub/i })
    if (!(await githubButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
      await osPage.keyboard.press("Escape").catch(() => {})
      return false
    }

    const githubPopup = osPage.waitForEvent("popup", { timeout: 8_000 }).catch(() => null)
    await githubButton.click({ timeout: 8_000 })
    const githubPage = await githubPopup
    if (githubPage) {
      const needsGitHubLogin = await githubPage
        .getByRole("button", { name: "Sign in" })
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
      if (needsGitHubLogin) {
        await githubPage.close()
        await osPage.keyboard.press("Escape").catch(() => {})
        return false
      }
      await githubPage.waitForEvent("close", { timeout: 20_000 }).catch(() => {})
    }
  }

  if (!(await selectHeading.isVisible({ timeout: 8_000 }).catch(() => false))) {
    await osPage.keyboard.press("Escape").catch(() => {})
    return false
  }

  await osPage.getByText("Select a repository", { exact: true }).click()
  const confirmAdd = osPage.getByRole("button", { name: "Add", exact: true })
  const firstRepository = osPage.getByRole("option").first()
  if (!(await firstRepository.isVisible({ timeout: 10_000 }).catch(() => false))) {
    await osPage.keyboard.press("Escape").catch(() => {})
    return false
  }
  const repositoryName = (await firstRepository.innerText()).trim()
  await firstRepository.click()
  await expect(confirmAdd).toBeEnabled({ timeout: 10_000 })
  await confirmAdd.click()
  await expect(osPage.getByText(repositoryName, { exact: true })).toBeVisible({ timeout: 30_000 })
  return true
}

/**
 * Clicks Add repository and verifies Blocks OS opens in a separate tab.
 * Does not complete GitHub linking — credential entry stays on OS only.
 */
export async function verifyAddRepositoryOpensOsTab(page: Page): Promise<boolean> {
  const addRepository = page.getByRole("button", { name: "Add repository" })
  if (!(await addRepository.isVisible().catch(() => false))) return false

  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 })
  await addRepository.click()
  const osPage = await popupPromise.catch(() => null)
  if (!osPage) return false

  await osPage.waitForLoadState("domcontentloaded")
  await expect(osPage).toHaveURL(/dev-os|os\./, { timeout: 30_000 })
  await osPage.close()
  return true
}

/**
 * Add repository is hosted on Blocks OS so Git credentials never enter Release.
 * Returns true when a repository was actually linked.
 * Must fail fast when GitHub OAuth is unavailable — never burn the test timeout.
 */
export async function connectFirstRepository(page: Page): Promise<boolean> {
  const addRepository = page.getByRole("button", { name: "Add repository" })
  if (!(await addRepository.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return false
  }

  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null)
  await addRepository.click()
  const osPage = await popupPromise

  if (!osPage) return false

  try {
    await osPage.waitForLoadState("domcontentloaded")
    await expect(osPage).toHaveURL(/dev-os|os\./, { timeout: 20_000 })
    await openSharedProjectRepositories(osPage)

    const osAdd = osPage
      .getByRole("button", { name: "Add repository" })
      .or(osPage.getByRole("button", { name: "Add", exact: true }))
      .first()
    if (!(await osAdd.isVisible({ timeout: 8_000 }).catch(() => false))) {
      return false
    }
    await osAdd.click({ timeout: 8_000 })

    return await trySelectFirstRepository(osPage)
  } catch {
    return false
  } finally {
    await osPage.close().catch(() => {})
  }
}

export async function hasLinkedRepository(page: Page): Promise<boolean> {
  const noRepoHeading = page.getByRole("heading", { name: "No repository added" })
  if (await noRepoHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return false
  }
  return page
    .getByRole("button", { name: /Deploys for/ })
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false)
}
