import { Page, expect, test } from "@playwright/test"
import { e2eBaseUrl, e2eOsBaseUrl, e2eProjectId } from "./env"
import { ensureAuthenticated, ensureAuthenticatedOnCurrentOrigin } from "./login-helper"

// Match the full "Test Project <timestamp>" name plus any user-added suffix
// (e.g. "Test Project 1788154850949 Renamed"). Stopping at a newline keeps the
// match on the single project-name line in the console; trailing whitespace is
// trimmed so downstream exact-text card matching lines up with the DOM.
const ORPHAN_PROJECT_PATTERN = /Test Project \d+[^\n]*/g
const ENV_BUTTON =
  /Development|Testing|Staging|IAT|UAT|Production|Pre-Prod|Prod Shadow/
const HOME_APP_NAME = /Release/i
const HOME_APP_URL = /dev-release|localhost/

const isVisibleNow = async (locator: { isVisible: (opts: { timeout: number }) => Promise<boolean> }) =>
  locator.isVisible({ timeout: 500 }).catch(() => false)

async function listOrphanProjectNames(page: Page): Promise<string[]> {
  const bodyText = await page.locator("body").innerText().catch(() => "")
  return [
    ...new Set(
      [...bodyText.matchAll(ORPHAN_PROJECT_PATTERN)].map((match) => match[0].trim()),
    ),
  ]
}

/** Blocks console on Release or OS. */
export async function ensureConsole(page: Page, host: "release" | "os" = "release") {
  const base = host === "os" ? e2eOsBaseUrl() : e2eBaseUrl()
  const href = page.url()
  const onConsole =
    /^https?:/.test(href) &&
    new URL(href).origin === new URL(base).origin &&
    /\/app\/console\/?$/.test(new URL(href).pathname)

  if (!onConsole) {
    try {
      await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
    } catch {
      // SPA may bounce the deep-link to /app/console mid-redirect; the
      // heading assertion below verifies we end up on the right page
      // regardless of how we got there.
    }
  }

  await expect(
    page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
  ).toBeVisible({ timeout: 30_000 })
}

export function namedProjectCard(page: Page, projectName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(projectName, { exact: true }) })
    .filter({
      has: page.getByRole("button", { name: ENV_BUTTON }),
    })
    .last()
}

async function waitForProjectCard(page: Page, projectName: string, host: "release" | "os" = "release") {
  for (let attempt = 0; attempt < 6; attempt++) {
    await ensureConsole(page, host)

    const card = namedProjectCard(page, projectName)
    if (await card.isVisible({ timeout: 1_500 }).catch(() => false)) {
      return card
    }

    if (attempt < 5) {
      try {
        await page.reload({ waitUntil: "domcontentloaded" })
      } catch {
        // SPA interrupted the reload (e.g. mid-redirect); next loop
        // iteration re-evaluates the card state.
      }
      await page.waitForTimeout(500)
    }
  }

  throw new Error(`Project "${projectName}" did not appear on the ${host} console`)
}

/**
 * Release project dashboard — workspace shell + project name.
 *
 * The SPA deep-link sometimes lands on `/app/<id>/dashboard` before the
 * project bootstrap finishes, in which case the app silently routes back
 * to `/app/console` and the workspace sidebar never renders. We therefore
 * wait for the sidebar text first (it only mounts on a real dashboard) and
 * treat the URL assertion as a postcondition. If the sidebar never mounts
 * within the timeout, we throw so the caller can fall back to console →
 * card navigation.
 */
async function waitForReleaseDashboardReady(page: Page, projectName: string) {
  await expect(page.getByText(/^workspace$/i)).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 30_000 })
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
}

/** OS project dashboard — project name heading + Delete button. */
async function waitForOsDashboardReady(page: Page, projectName: string) {
  await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 20_000 })
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible({
    timeout: 20_000,
  })
}

async function readProjectNameFromDashboard(page: Page): Promise<string> {
  const sidebarProject = page.getByRole("button", { name: /^Project / })
  if (await sidebarProject.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const label = await sidebarProject.innerText()
    return label.replace(/^Project\s+/i, "").trim()
  }

  const details = page
    .locator("main")
    .filter({ has: page.getByRole("heading", { name: "Project Details" }) })
  const nameBlock = details.getByText(/^Name\s+\S/, { exact: false }).first()
  if (await nameBlock.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return (await nameBlock.innerText()).replace(/^Name\s+/, "").trim()
  }

  throw new Error(`Could not read project name from dashboard: ${page.url()}`)
}

async function openProjectById(page: Page, projectId: string) {
  try {
    await page.goto(`${e2eBaseUrl()}/app/${projectId}/dashboard`, { waitUntil: "domcontentloaded" })
  } catch {
    // SPA may bounce the deep-link; readiness check below handles either
    // landing page.
  }
  const projectName = await readProjectNameFromDashboard(page)
  await waitForReleaseDashboardReady(page, projectName)
  return { projectName, dashboardUrl: page.url(), itemId: projectId }
}

export async function openNamedProjectDashboard(
  page: Page,
  projectName: string,
  options?: { dashboardUrl?: string },
) {
  if (options?.dashboardUrl) {
    try {
      await page.goto(options.dashboardUrl, { waitUntil: "domcontentloaded" })
    } catch {
      // SPA bounced the deep-link; fall through to card navigation below.
    }
    try {
      await waitForReleaseDashboardReady(page, projectName)
      return
    } catch {
      // Fall through to card navigation.
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const card = await waitForProjectCard(page, projectName, "release")
    const envButton = card.getByRole("button", { name: ENV_BUTTON }).first()
    await expect(envButton).toBeVisible({ timeout: 10_000 })
    await envButton.click({ force: true })

    try {
      await waitForReleaseDashboardReady(page, projectName)
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

async function openOsProjectDashboard(page: Page, projectName: string) {
  await ensureConsole(page, "os")

  for (let attempt = 0; attempt < 3; attempt++) {
    const card = await waitForProjectCard(page, projectName, "os")
    const envButton = card.getByRole("button", { name: ENV_BUTTON }).first()
    await expect(envButton).toBeVisible({ timeout: 10_000 })
    await envButton.click({ force: true })

    try {
      await waitForOsDashboardReady(page, projectName)
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

async function clickAppSwitcherAndNavigate(page: Page, appNamePattern: RegExp) {
  const appSwitcher = page.getByRole("button", { name: "SELISE Blocks apps" })
  await expect(appSwitcher).toBeVisible({ timeout: 10_000 })
  await appSwitcher.click()

  const popup = page
    .locator(
      '[role="dialog"], [data-radix-popper-content-wrapper], [class*="popover"], [class*="dropdown"]',
    )
    .first()
  const scope = (await popup.isVisible({ timeout: 3_000 }).catch(() => false)) ? popup : page

  const appLink = scope
    .getByRole("link", { name: appNamePattern })
    .or(scope.getByRole("button", { name: appNamePattern }))
    .or(scope.getByRole("menuitem", { name: appNamePattern }))
    .first()
  await expect(appLink).toBeVisible({ timeout: 5_000 })
  await appLink.click()
}

async function deleteProjectOnOs(page: Page, projectName: string): Promise<boolean> {
  await page.goto(`${e2eOsBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
  await ensureAuthenticatedOnCurrentOrigin(page)
  await openOsProjectDashboard(page, projectName)

  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Delete this environment?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete", exact: true }).last().click()
  await expect(page.getByText("Successfully deleted", { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page).toHaveURL(/\/app\/console$/, { timeout: 15_000 })
  return true
}

async function freeProjectSlotIfNeeded(page: Page) {
  await ensureConsole(page, "release")

  const welcomeHeading = page.getByRole("heading", { name: "Welcome to SELISE Blocks" })
  if (await isVisibleNow(welcomeHeading)) return

  const addProjectButton = page.getByText("Add Project", { exact: true }).first()
  if (await isVisibleNow(addProjectButton)) return

  const atProjectLimit = page.getByText("Please delete an existing project to create a new one.")
  if (!(await isVisibleNow(atProjectLimit))) return

  for (let attempt = 0; attempt < 8; attempt++) {
    const orphanNames = await listOrphanProjectNames(page)
    if (orphanNames.length === 0) break

    await deleteCreatedProject(page, orphanNames[0]).catch(() => {})
    await ensureConsole(page, "release")

    if (await isVisibleNow(addProjectButton)) return
  }

  await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
}

/**
 * Creates a project via the OS-hosted wizard (Release redirects to OS for this).
 *
 * Flow:
 *   Release console → "Add Project" → OS create-project wizard →
 *   project created on OS environments page → app switcher → Release →
 *   Release console → click the new project → Release dashboard
 */
export async function createProject(page: Page) {
  await test.step("Start a new project (redirects to OS)", async () => {
    await ensureAuthenticated(page)
    await ensureConsole(page, "release")

    const welcomeHeading = page.getByRole("heading", { name: "Welcome to SELISE Blocks" })
    const createProjectButton = page.getByRole("button", { name: "Create a project" })
    const addProjectButton = page.getByText("Add Project", { exact: true }).first()

    await freeProjectSlotIfNeeded(page)

    if (await welcomeHeading.isVisible().catch(() => false)) {
      await createProjectButton.click()
    } else {
      await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
      await addProjectButton.click()
    }

    const nameHeading = page.getByRole("heading", { name: "Name your project" })
    const loginButton = page.getByRole("button", { name: "Log in to your account" })

    await Promise.race([
      nameHeading.waitFor({ state: "visible", timeout: 60_000 }),
      loginButton.waitFor({ state: "visible", timeout: 60_000 }),
    ]).catch(() => {})

    if (await loginButton.isVisible().catch(() => false)) {
      await page.waitForTimeout(2_000)
      try {
        await loginButton.click({ timeout: 10_000 })
      } catch {
        // Login prompt may already be dismissed by redirect.
      }
      await Promise.race([
        nameHeading.waitFor({ state: "visible", timeout: 60_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 60_000 }),
      ]).catch(() => {})

      if (!(await nameHeading.isVisible().catch(() => false))) {
        await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
        await ensureConsole(page, "release")
        const addBtn = page.getByText("Add Project", { exact: true }).first()
        await expect(addBtn).toBeVisible({ timeout: 15_000 })
        await addBtn.click()
      }
    }

    await expect(nameHeading).toBeVisible({ timeout: 60_000 })
  })

  const projectName = `Test Project ${Date.now()}`
  await test.step("Name the project and accept the agreements", async () => {
    const nameInput = page.locator('[placeholder="Enter your project name"]:visible')
    await nameInput.fill(projectName)

    await page.getByRole("checkbox", { name: "I confirm that I will use" }).click()
    await page.getByRole("checkbox", { name: "I accept the Terms of services" }).click()

    const continueButton = page.getByRole("button", { name: "Continue", exact: true })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
  })

  await test.step("Skip optional repositories", async () => {
    await expect(page.getByRole("heading", { name: "Add resource" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Continue", exact: true }).click()
  })

  await test.step("Select Development and submit", async () => {
    await expect(
      page.getByText("Select environments", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByText("Development", { exact: true }).and(page.locator(":visible")).click()
    const submitButton = page.getByRole("button", { name: "Submit" })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
  })

  await test.step("Wait for create success (on OS)", async () => {
    await expect(page.getByText("Your project has been created.", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page).toHaveURL(/\/app\/project\/[^/]+\/environments$/, {
      timeout: 20_000,
    })
  })

  await test.step("Switch back to Release via app switcher", async () => {
    await clickAppSwitcherAndNavigate(page, HOME_APP_NAME)
    await page.waitForURL(HOME_APP_URL, { timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 30_000,
    })
  })

  await test.step("Open the newly created project on Release", async () => {
    await openNamedProjectDashboard(page, projectName)
  })

  return { projectName, dashboardUrl: page.url() }
}

/** Reuse an existing project, or create one when Add Project is available. */
export async function reuseOrCreateSharedProject(
  page: Page,
): Promise<{ projectName: string; dashboardUrl: string; itemId: string }> {
  await ensureAuthenticated(page)

  const configuredProjectId = e2eProjectId()
  if (configuredProjectId) {
    return openProjectById(page, configuredProjectId)
  }

  await ensureConsole(page, "release")

  const reuseName = process.env.E2E_REUSE_PROJECT_NAME?.trim()
  if (reuseName) {
    await openNamedProjectDashboard(page, reuseName)
    const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
    return { projectName: reuseName, dashboardUrl: page.url(), itemId }
  }

  const testProjects = await listOrphanProjectNames(page)
  if (testProjects.length > 0) {
    const projectName = testProjects[testProjects.length - 1]!
    await openNamedProjectDashboard(page, projectName)
    const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
    return { projectName, dashboardUrl: page.url(), itemId }
  }

  const addProjectButton = page.getByText("Add Project", { exact: true }).first()
  if (await addProjectButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const created = await createProject(page)
    const itemId = new URL(created.dashboardUrl).pathname.split("/")[2] ?? ""
    return { ...created, itemId }
  }

  throw new Error(
    "No project to reuse and Add Project is unavailable. " +
      "Set E2E_REUSE_PROJECT_NAME (e.g. test) or E2E_PROJECT_ID, or free a console slot.",
  )
}

/** Delete project on Blocks OS (mandatory path per BLOCKS-E2E-SPEC). */
export async function deleteCreatedProject(
  page: Page,
  projectName?: string,
  options?: { itemId?: string },
): Promise<boolean> {
  if (!projectName) return false
  void options

  return test.step("Delete project on Blocks OS", async () => {
    try {
      const deleted = await deleteProjectOnOs(page, projectName)
      if (deleted) {
        await ensureConsole(page, "os")
        await expect(page.getByText(projectName, { exact: true })).toHaveCount(0, {
          timeout: 10_000,
        })
      }
      return deleted
    } catch (error) {
      console.warn(`[e2e] Failed to delete project "${projectName}" on OS:`, error)
      return false
    }
  })
}
