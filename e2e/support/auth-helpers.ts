import { expect, type Page } from "@playwright/test"

/**
 * Opens the first project from the console by clicking its environment chip
 * (e.g. "Development"), then waits for the project workspace shell
 * (sidebar with WORKSPACE/PROJECT/ENVIRONMENT + Overview/Deployment nav)
 * to render.
 */
export async function openFirstProject(page: Page) {
  await page
    .getByRole("button", { name: /Development|Testing|Staging|IAT|UAT|Production/ })
    .first()
    .click()
  await expect(page.getByText(/^workspace$/i)).toBeVisible({
    timeout: 50_000,
  })
}

/** Sidebar nav item: rendered as either a link or a button by the shell. */
export function sidebarNavItem(page: Page, name: "Overview" | "Deployment") {
  return page
    .getByRole("link", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
}
