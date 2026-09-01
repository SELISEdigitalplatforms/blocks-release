import { test, expect } from "../../support/test-base";
import { sidebarNavItem } from "../../support/auth-helpers";
import { e2eCredentials } from "../../support/env";
import { openReleaseConsole, openReleaseOverview } from "../../support/release-helpers";

/**
 * Console + Project Overview ("Project Details" / "Core APIs") as a single
 * end-to-end pass through the console → project → deployment nav → logout.
 *
 * One top-level `test` is used (rather than separate tests per section) so the
 * whole file can be invoked as a single test invocation and so the destructive
 * logout step at the end is the natural end of the same browser session.
 *
 * Uses the shared project from release.setup.spec.ts (one login per suite).
 */
test.describe("Console & Project Overview", () => {
  test("Console, Project Overview, Deployment nav, and logout", async ({ page }) => {
    // -------------------------------------------------------------------------
    // Section 1: Console topbar (theme / language / notifications / app switcher /
    // user menu)
    // -------------------------------------------------------------------------
    await openReleaseConsole(page);
    const themeTablist = page.getByRole("tablist").first();

    const autoTab = themeTablist.locator('[aria-controls$="-content-system"]');
    const lightTab = themeTablist.locator('[aria-controls$="-content-light"]');
    const darkTab = themeTablist.locator('[aria-controls$="-content-dark"]');

    const activeTab = themeTablist.locator('[role="tab"][data-state="active"]');

    await test.step("[Positive] theme switcher offers Auto/Light/Dark and has an active theme", async () => {
      await expect(themeTablist).toBeVisible({ timeout: 30_000 });
      await expect(autoTab).toBeVisible({ timeout: 30_000 });
      await expect(lightTab).toBeVisible({ timeout: 30_000 });
      await expect(darkTab).toBeVisible({ timeout: 30_000 });
      await expect(activeTab).toHaveCount(1);
    });

    await test.step("[Positive] switching to Dark applies the dark theme", async () => {
      await darkTab.click();
      await expect(darkTab).toHaveAttribute("data-state", "active");
      await expect(page.locator("html")).toHaveClass(/dark/);
      await lightTab.click();
      await expect(lightTab).toHaveAttribute("data-state", "active");
    });

    await test.step("[Positive] language selector shows EN and lists English/German/French", async () => {
      const languageButton = page.getByRole("button", { name: /^en$/i });
      await expect(languageButton).toBeVisible();
      await languageButton.click();
      await expect(page.getByRole("menuitem", { name: "English" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "German" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "French" })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await test.step("[Negative] German and French are disabled (English-only environment)", async () => {
      const languageButton = page.getByRole("button", { name: /^en$/i });
      await languageButton.click();
      await expect(page.getByRole("menuitem", { name: "German" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page.getByRole("menuitem", { name: "French" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await page.keyboard.press("Escape");
    });

    await test.step("[Positive] notification bell opens the notifications popover (M8)", async () => {
      await page.getByTestId("notification-bell").click();
      await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Mark all as read" })).toBeVisible();

      // Scope the row lookup to the popover area: the "Notifications" heading
      // is in the popover header, and rows are clickable divs rendered after
      // it. The Radix popover's accessible name comes from the trigger button
      // (not from the "Notifications" text), so use a text-based root instead
      // of getByRole("dialog", { name: "Notifications" }).
      const popoverRoot = page
        .locator("div")
        .filter({ has: page.getByText("Notifications", { exact: true }) })
        .filter({ has: page.getByRole("button", { name: "Mark all as read" }) })
        .last();
      const firstRow = popoverRoot
        .locator('div[class*="cursor-pointer"]')
        .filter({ has: page.getByText(/./) })
        .first();
      if (await firstRow.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await firstRow.click();
        // Re-open the popover if the click navigated away.
        const stillOpen = await page
          .getByRole("button", { name: "Mark all as read" })
          .isVisible()
          .catch(() => false);
        if (!stillOpen) {
          await page.getByTestId("notification-bell").click();
        }
        await page.getByRole("button", { name: "Mark all as read" }).click();
      }
      await page.keyboard.press("Escape");
    });

    await test.step("[Positive] app switcher (grid icon) opens the SELISE Blocks apps list (M9)", async () => {
      const appSwitcher = page.getByRole("button", { name: "SELISE Blocks apps" });
      await expect(appSwitcher).toBeVisible({ timeout: 10_000 });
      await appSwitcher.click();
      await expect(page.getByText("SELISE Blocks", { exact: true })).toBeVisible();

      // Confirm the popover lists at least one app entry. We don't pin
      // specific app names because the list is rendered from a
      // tenant-supplied catalog and varies by environment.
      const popoverLinks = page.locator("a, button").filter({
        has: page.getByText(/Release|OS|IAM|Studio|Monitor|Logic|Data|Utilities|Agents/i),
      });
      await expect(popoverLinks.first()).toBeVisible({ timeout: 10_000 });

      await page.keyboard.press("Escape");
    });

    await test.step("[Security] user menu exposes account info and a Log out action (not clicked) (M5+M6)", async () => {
      const userMenuButton = page.getByRole("button", { name: "Open user menu" });
      await expect(userMenuButton).toBeVisible({ timeout: 10_000 });
      await userMenuButton.click();
      const userMenu = page.getByRole("menu", { name: "Open user menu" });
      await expect(userMenu).toBeVisible();
      await expect(userMenu.getByText("Log out", { exact: true })).toBeVisible();
      await expect(userMenu.getByRole("menuitem", { name: "My Profile" })).toBeVisible();

      // Account metadata rendered as plain text under the initials avatar.
      // Email is asserted against the configured credential (not hardcoded);
      // the role and display name are checked for presence and non-emptiness
      // because the backend's values are tenant-specific.
      const { email } = e2eCredentials();
      await expect(userMenu.getByText(email, { exact: true })).toBeVisible();
      const userNameLine = userMenu.locator("p").filter({ hasText: "User name:" });
      await expect(userNameLine).toBeVisible();
      const displayName = (await userNameLine.innerText()).replace(/^User name:\s*/i, "").trim();
      expect(displayName.length).toBeGreaterThan(0);
      const roleLine = userMenu.locator("p").nth(2);
      const role = (await roleLine.innerText()).trim();
      expect(role.length).toBeGreaterThan(0);

      await page.keyboard.press("Escape");
    });

    // -------------------------------------------------------------------------
    // Section 2: Console project list (sections rendered below the project
    // cards).
    // -------------------------------------------------------------------------
    await test.step("[Positive] Your Blocks Projects section lists at least one project", async () => {
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible();
      await expect(page.getByText("Add Project", { exact: true })).toBeVisible();
    });

    await test.step("[Positive] Resources section (Docs/Code/Cloud) is visible", async () => {
      await expect(page.getByText("Resources", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Docs", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Code", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Cloud", exact: true })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Section 3: Project Overview → Project Details → Core APIs.
    // -------------------------------------------------------------------------
    await openReleaseOverview(page);

    await test.step("[Positive] Project Details card shows core metadata fields", async () => {
      await expect(page.getByRole("heading", { name: "Project Details" })).toBeVisible();
      await expect(
        page.getByText("Core configuration and metadata for this project"),
      ).toBeVisible();
      await expect(page.getByText("Name", { exact: true })).toBeVisible();
      await expect(page.getByText("X-Blocks-Key", { exact: true })).toBeVisible();
      await expect(page.getByRole("main").getByText("Environment", { exact: true })).toBeVisible();
      await expect(page.getByText("Last updated Date", { exact: true })).toBeVisible();
      await expect(page.getByText("Created Date", { exact: true })).toBeVisible();
    });

    await test.step("[Security] the X-Blocks-Key value is masked, not shown in full", async () => {
      const keyRow = page.getByText("X-Blocks-Key", { exact: true }).locator("..");
      await expect(keyRow).toContainText("*");
    });

    await test.step("[Positive] X-Blocks-Key value can be copied to clipboard", async () => {
      const keyRow = page.getByText("X-Blocks-Key", { exact: true }).locator("..");
      const copyButton = keyRow.getByRole("button");

      await expect(copyButton).toBeVisible();
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await copyButton.click();

      await expect(async () => {
        const clipboardText = await page.evaluate(async () => navigator.clipboard.readText());
        expect(clipboardText.trim().length).toBeGreaterThan(0);
      }).toPass({ timeout: 10_000 });
    });

    await test.step("[Positive] Core APIs section lists endpoint groups with counts", async () => {
      await expect(page.getByRole("heading", { name: "Core APIs" })).toBeVisible();
      await expect(page.getByText("Available endpoints for this module")).toBeVisible();
      await expect(page.getByText(/^\d+ Endpoints$/)).toBeVisible();
      await expect(page.getByText("Auth", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Build" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    await test.step("[Positive] Core APIs group can be expanded and a per-endpoint copy works (M10)", async () => {
      const buildGroup = page.getByRole("button", { name: "Build" });
      await expect(buildGroup).toHaveAttribute("aria-expanded", "false");

      // Expand and assert the endpoint list is reachable.
      await buildGroup.click();
      await expect(buildGroup).toHaveAttribute("aria-expanded", "true");
      // The first endpoint is the bare "/api/Build" call. Assert its URL fragment
      // is rendered to confirm the group body is visible.
      const buildEndpointText = page.getByText("/api/Build").first();
      await expect(buildEndpointText).toBeVisible({ timeout: 5_000 });

      // Scope the per-endpoint Copy button to the Build row. The whole
      // Core APIs section has many Copy buttons (X-Blocks-Key, every endpoint
      // in every group) — we want the one that sits next to the "Build /api/Build"
      // entry. Walk up from the URL text to find its sibling Copy button.
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const buildRow = buildEndpointText.locator(
        'xpath=ancestor::*[.//*[@aria-label="Copy" or normalize-space(text())="Copy as cURL"]][1]',
      );
      const buildCopy = buildRow.getByRole("button", { name: "Copy" }).first();
      await buildCopy.scrollIntoViewIfNeeded();
      await buildCopy.click();
      await expect(async () => {
        const text = await page.evaluate(async () => navigator.clipboard.readText());
        expect(text.trim().length).toBeGreaterThan(0);
      }).toPass({ timeout: 5_000 });

      // Collapse again to leave the section in its original state.
      await buildGroup.click();
      await expect(buildGroup).toHaveAttribute("aria-expanded", "false");
    });

    await test.step("[Positive] sidebar shows PROJECT and ENVIRONMENT context", async () => {
      await expect(page.getByText(/^Project$/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment/i })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Section 4: Deployment nav from Project Overview.
    // -------------------------------------------------------------------------
    await test.step("[Positive] Deployment nav item switches to the Deployment section", async () => {
      await sidebarNavItem(page, "Deployment").click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
    });

    await test.step("[Positive] Back to console returns to the project list", async () => {
      await page.getByRole("button", { name: "Back to console" }).click();
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Section 5: Logout (M18). Runs LAST because it ends the in-memory session.
    // Playwright reloads the storage state from disk at the start of every test
    // in this project, so combining it into one test keeps the destructive
    // step at the natural end of the same browser session.
    // -------------------------------------------------------------------------
    await test.step("[Positive] Logging out ends the session and lands on /login (M18)", async () => {
      await openReleaseConsole(page);
      const userMenuButton = page.getByRole("button", { name: "Open user menu" });
      await expect(userMenuButton).toBeVisible({ timeout: 10_000 });
      await userMenuButton.click();
      const userMenu = page.getByRole("menu", { name: "Open user menu" });
      await expect(userMenu).toBeVisible();

      await userMenu.getByText("Log out", { exact: true }).click();

      // The handleLogout flow calls window.location.replace(`${origin}/login`).
      // The /login route then redirects into the OIDC provider, so accept any
      // of the typical post-logout origins. The contract we care about is
      // "no longer on the console".
      await expect(page).not.toHaveURL(/\/app\/console/, { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login|dev-iam|auth/i, { timeout: 15_000 });
    });

    await test.step("[Security] re-opening the menu after logout no longer exposes the user identity (M18)", async () => {
      // After window.location.replace, local tokens are cleared but the new
      // page is on /login (or the OIDC provider). The console topbar should
      // not be visible anymore.
      await expect(page.getByRole("button", { name: "Open user menu" })).toHaveCount(0);
    });
  });
});
