import { expect, type Page } from "@playwright/test"
import { e2eBaseUrl, e2eCredentials } from "./env"

function oidcEmailField(page: Page) {
  return page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }))
}

function oidcPasswordField(page: Page) {
  return page.locator("#oidc-password").or(page.getByRole("textbox", { name: "Password" }))
}

const consoleHeading = (page: Page) =>
  page.getByRole("heading", {
    name: /Your Blocks Projects|Welcome to SELISE Blocks/,
  })

// "Authenticated console" only — the "Your Blocks Projects" heading on
// /app/console. Crucially this does NOT match the "Welcome to SELISE
// Blocks" heading on /login; otherwise loginThroughOidc early-returns
// without logging in (a real bug once a previous test has logged out and
// left the storage state invalidated).
const authenticatedConsoleHeading = (page: Page) =>
  page.getByRole("heading", { name: "Your Blocks Projects" })

function resolveLoginBase(loginPath: string): string {
  try {
    return new URL(loginPath).origin
  } catch {
    return e2eBaseUrl()
  }
}

/** True when the page is the product login gate or OIDC credential form. */
export async function isLoginSurface(page: Page): Promise<boolean> {
  if (
    await page
      .getByRole("button", { name: "Log in to your account" })
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return true
  }

  if (await oidcEmailField(page).isVisible({ timeout: 500 }).catch(() => false)) {
    return true
  }

  try {
    if (/\/login\/?$/i.test(new URL(page.url()).pathname)) return true
  } catch {
    // ignore invalid URL
  }

  return false
}

async function fillCredentialsAndSubmit(page: Page) {
  const { email, password } = e2eCredentials()
  const emailField = oidcEmailField(page)
  await emailField.fill(email)
  const passwordField = oidcPasswordField(page)
  await expect(passwordField).toBeVisible({ timeout: 10_000 })
  await passwordField.fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
}

/**
 * OIDC login against a product origin.
 *
 * Important: when `loginPath` is on Blocks OS (teardown delete), every
 * console redirect must stay on that origin — never fall back to
 * `E2E_BASE_URL` (Release), or OS auth lands on a blank/wrong host.
 */
export async function loginThroughOidc(page: Page, options?: { loginPath?: string }) {
  const loginPath = options?.loginPath ?? `${e2eBaseUrl()}/login`
  const base = resolveLoginBase(loginPath)
  const consoleUrl = `${base}/app/console`

  try {
    await page.goto(loginPath, { waitUntil: "domcontentloaded" })
  } catch {
    // SPA may interrupt the very first navigation; the loop below handles
    // landing on either /login or /app/console.
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await authenticatedConsoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }

    // Empty tenant console still counts as authenticated.
    if (
      (await consoleHeading(page).isVisible({ timeout: 1_000 }).catch(() => false)) &&
      !(await isLoginSurface(page))
    ) {
      return
    }

    const loginButton = page.getByRole("button", { name: "Log in to your account" })
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 })
      } catch {
        if (await authenticatedConsoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) {
          return
        }
        try {
          await page.goto(consoleUrl, { waitUntil: "domcontentloaded" })
        } catch {
          // SPA bounced; next iteration re-evaluates.
        }
        continue
      }

      const emailField = oidcEmailField(page)
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        authenticatedConsoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(
          (url) => url.origin === base && /\/app\/console\/?$/i.test(url.pathname),
          { timeout: 30_000 },
        ),
      ]).catch(() => {})

      if (await authenticatedConsoleHeading(page).isVisible().catch(() => false)) {
        return
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page)
        await page.waitForURL(
          (url) => url.origin === base && /\/app\/console\/?$/i.test(url.pathname),
          { timeout: 45_000 },
        )
        return
      }

      try {
        await page.goto(consoleUrl, { waitUntil: "domcontentloaded" })
      } catch {
        // SPA redirected mid-flight; the next loop iteration re-evaluates.
      }
      continue
    }

    // Already on OIDC form (no gate button).
    if (await oidcEmailField(page).isVisible({ timeout: 1_000 }).catch(() => false)) {
      await fillCredentialsAndSubmit(page)
      await page.waitForURL(
        (url) => url.origin === base && /\/app\/console\/?$/i.test(url.pathname),
        { timeout: 45_000 },
      )
      return
    }

    try {
      await page.goto(consoleUrl, { waitUntil: "domcontentloaded" })
    } catch {
      // Same as above — let the next loop iteration check the URL.
    }
  }

  try {
    await page.goto(consoleUrl, { waitUntil: "domcontentloaded" })
  } catch {
    // Final fallback — assert the console heading on whatever page we land on.
  }
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function ensureAuthenticated(page: Page) {
  const base = e2eBaseUrl()
  try {
    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
  } catch {
    // SPA bounced the navigation — the heading check below handles either
    // landing page.
  }

  if (await authenticatedConsoleHeading(page).isVisible({ timeout: 15_000 }).catch(() => false)) {
    return
  }

  if (
    (await consoleHeading(page).isVisible({ timeout: 2_000 }).catch(() => false)) &&
    !(await isLoginSurface(page))
  ) {
    return
  }

  await loginThroughOidc(page)
}

export async function ensureAuthenticatedOnCurrentOrigin(page: Page) {
  const href = page.url()
  if (!/^https?:/.test(href)) {
    await ensureAuthenticated(page)
    return
  }

  const origin = new URL(href).origin
  try {
    await page.goto(`${origin}/app/console`, { waitUntil: "domcontentloaded" })
  } catch {
    // Same SPA-bounce handling as ensureAuthenticated.
  }

  if (await authenticatedConsoleHeading(page).isVisible({ timeout: 15_000 }).catch(() => false)) {
    return
  }

  if (
    (await consoleHeading(page).isVisible({ timeout: 2_000 }).catch(() => false)) &&
    !(await isLoginSurface(page))
  ) {
    return
  }

  await loginThroughOidc(page, { loginPath: `${origin}/login` })
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function loginFresh(page: Page) {
  await loginThroughOidc(page, { loginPath: `${e2eBaseUrl()}/login` })
}
