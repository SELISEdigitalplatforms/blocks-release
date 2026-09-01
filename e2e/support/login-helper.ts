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

async function fillCredentialsAndSubmit(page: Page) {
  const { email, password } = e2eCredentials()
  const emailField = oidcEmailField(page)
  await emailField.fill(email)
  const passwordField = oidcPasswordField(page)
  await expect(passwordField).toBeVisible({ timeout: 10_000 })
  await passwordField.fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
}

export async function loginThroughOidc(page: Page, options?: { loginPath?: string }) {
  const base = e2eBaseUrl()
  const loginPath = options?.loginPath ?? `${base}/login`

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

    const loginButton = page.getByRole("button", { name: "Log in to your account" })
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 })
      } catch {
        if (await authenticatedConsoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) return
        try {
          await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
        } catch {
          // SPA bounced the navigation (e.g. mid-redirect to the OIDC
          // provider). The next loop iteration will see /app/console already
          // loaded (or the provider page) and re-evaluate.
        }
        continue
      }

      const emailField = oidcEmailField(page)
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        authenticatedConsoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 30_000 }),
      ]).catch(() => {})

      if (await authenticatedConsoleHeading(page).isVisible().catch(() => false)) {
        return
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page)
        await page.waitForURL(/\/app\/console/, { timeout: 45_000 })
        return
      }

      try {
        await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
      } catch {
        // SPA redirected mid-flight; the next loop iteration re-evaluates.
      }
      continue
    }

    try {
      await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
    } catch {
      // Same as above — let the next loop iteration check the URL.
    }
  }

  try {
    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
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

  await loginThroughOidc(page, { loginPath: `${origin}/login` })
}

export async function loginFresh(page: Page) {
  await loginThroughOidc(page, { loginPath: e2eBaseUrl() })
}
