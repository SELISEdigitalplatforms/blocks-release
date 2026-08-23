import { expect, type Page } from "@playwright/test"
import {
  ensureConsole,
  namedProjectCard,
  openNamedProjectDashboard,
} from "./create-and-delete-project"
import { ensureAuthenticatedOnCurrentOrigin } from "./login-helper"
import { readReleaseProject } from "./release-project"
import { sidebarNavItem } from "./auth-helpers"

const consoleHeading = (page: Page) =>
  page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ })

const workspaceReady = (page: Page) => page.getByText(/^workspace$/i)

/** Open the shared project shell (workspace sidebar). Deep-links often bounce to console. */
async function openSharedProjectWorkspace(page: Page) {
  const fixture = readReleaseProject()
  if (!fixture) {
    throw new Error("Release project fixture not found. Did release-setup run?")
  }

  // 1) Try seeded dashboard URL (same as e2e_logic fixture deep-link).
  if (fixture.dashboardUrl) {
    await page.goto(fixture.dashboardUrl, { waitUntil: "domcontentloaded" })
    if (await workspaceReady(page).isVisible({ timeout: 8_000 }).catch(() => false)) {
      return fixture
    }
  }

  // 2) Fallback: console → project card → Development (reliable path).
  await openNamedProjectDashboard(page, fixture.projectName)
  await expect(workspaceReady(page)).toBeVisible({ timeout: 50_000 })
  return fixture
}

export async function openReleaseConsole(page: Page) {
  await page.goto("/app/console")
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function openReleaseDashboard(page: Page) {
  const fixture = await openSharedProjectWorkspace(page)
  return { projectName: fixture.projectName }
}

/**
 * Same idea as e2e_logic `openWorkflowList`:
 * enter the project shell, then click the feature nav link.
 */
export async function openReleaseOverview(page: Page) {
  const fixture = await openSharedProjectWorkspace(page)

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

  return { projectName: fixture.projectName }
}

/**
 * Same idea as e2e_logic `openWorkflowList`:
 * try seeded deployment URL, else open project via console card → Deployment.
 */
export async function openReleaseDeployment(page: Page) {
  const fixture = readReleaseProject()
  if (!fixture) {
    throw new Error("Release project fixture not found. Did release-setup run?")
  }

  if (fixture.deploymentUrl) {
    await page.goto(fixture.deploymentUrl, { waitUntil: "domcontentloaded" })
    const heading = page.getByRole("heading", { name: "Deployment Overview" })
    if (await heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
      return { projectName: fixture.projectName }
    }
  }

  await openSharedProjectWorkspace(page)

  const deploymentLink = sidebarNavItem(page, "Deployment")
  await deploymentLink.waitFor({ state: "visible", timeout: 30_000 })
  await deploymentLink.click()

  await expect(page.getByRole("heading", { name: "Deployment Overview" }))
    .toBeVisible({ timeout: 30_000 })
    .catch(async () => {
      await deploymentLink.click()
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible({
        timeout: 30_000,
      })
    })

  return { projectName: fixture.projectName }
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
  await expect(connectHeading.or(selectHeading)).toBeVisible({ timeout: 30_000 })

  if (await connectHeading.isVisible().catch(() => false)) {
    const githubPopup = osPage.waitForEvent("popup", { timeout: 8_000 }).catch(() => null)
    await osPage.getByRole("button", { name: /Continue with GitHub/i }).click()
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
      await githubPage.waitForEvent("close", { timeout: 30_000 }).catch(() => {})
    }
  }

  if (!(await selectHeading.isVisible({ timeout: 8_000 }).catch(() => false))) {
    await osPage.keyboard.press("Escape").catch(() => {})
    return false
  }

  await osPage.getByText("Select a repository", { exact: true }).click()
  const confirmAdd = osPage.getByRole("button", { name: "Add", exact: true })
  const firstRepository = osPage.getByRole("option").first()
  await expect(firstRepository).toBeVisible({ timeout: 30_000 })
  const repositoryName = (await firstRepository.innerText()).trim()
  await firstRepository.click()
  await expect(confirmAdd).toBeEnabled()
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
  await expect(osPage).toHaveURL(/dev-os/, { timeout: 30_000 })
  await osPage.close()
  return true
}

/**
 * Add repository is hosted on Blocks OS so Git credentials never enter Release.
 * Returns true when a repository was actually linked.
 */
export async function connectFirstRepository(page: Page): Promise<boolean> {
  const addRepository = page.getByRole("button", { name: "Add repository" })
  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null)

  if (await addRepository.isVisible().catch(() => false)) {
    await addRepository.click()
    const osPage = await popupPromise
    if (osPage) {
      try {
        await osPage.waitForLoadState("domcontentloaded")
        await expect(osPage).toHaveURL(/dev-os/, { timeout: 30_000 })
        await openSharedProjectRepositories(osPage)
        await osPage.getByRole("button", { name: "Add", exact: true }).click()
        const added = await trySelectFirstRepository(osPage)
        await osPage.close()
        return added
      } catch {
        await osPage.close().catch(() => {})
        return false
      }
    }
  }

  try {
    await page.getByRole("button", { name: "Back to console" }).click()
    await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })

    const fixture = readReleaseProject()
    if (fixture?.projectName) {
      const card = namedProjectCard(page, fixture.projectName)
      await expect(card).toBeVisible({ timeout: 30_000 })
      await card.getByTestId("project-card-configure").click()
    } else {
      await page.getByTestId("project-card-configure").first().click()
    }

    await page.getByRole("link", { name: "Repositories" }).click()
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Add", exact: true }).click()
    const added = await trySelectFirstRepository(page)

    await page.getByRole("button", { name: "SELISE Blocks apps" }).click()
    await page.getByRole("link", { name: /Release/i }).first().click()
    await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })

    return added
  } catch {
    return false
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
