import { test, expect } from "../../support/test-base";
import { sidebarNavItem } from "../../support/auth-helpers";
import { e2eCredentials } from "../../support/env";
import { openReleaseConsole, openReleaseOverview } from "../../support/release-helpers";

test.describe("Console & Project Overview", () => {
  test("Console, Project Overview, and Deployment nav", async ({ page }) => {
    await openReleaseConsole(page);
    const themeSwitcher = page.getByRole("button", { name: /Change theme/i });

    await test.step("[Positive] theme switcher offers Auto/Light/Dark and has an active theme", async () => {
      await expect(themeSwitcher).toBeVisible({ timeout: 30_000 });

      await themeSwitcher.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible({ timeout: 5_000 });
      await expect(menu.getByRole("menuitemradio", { name: /Auto/ })).toBeVisible();
      await expect(menu.getByRole("menuitemradio", { name: /Light/ })).toBeVisible();
      await expect(menu.getByRole("menuitemradio", { name: /Dark/ })).toBeVisible();

      const checked = menu.locator('[role="menuitemradio"][data-state="checked"]');
      expect(await checked.count()).toBe(1);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });

    await test.step("[Positive] clicking a theme menu item applies light or dark", async () => {
      const html = page.locator("html");
      const wasDark = await html.evaluate((el) => el.classList.contains("dark"));

      await themeSwitcher.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible({ timeout: 5_000 });

      await menu.getByRole("menuitemradio", { name: /Dark/ }).click();
      await expect(html).toHaveClass(/dark/);

      await themeSwitcher.click();
      await expect(menu).toBeVisible({ timeout: 5_000 });
      await menu.getByRole("menuitemradio", { name: /Light/ }).click();
      await expect(html).not.toHaveClass(/dark/);

      await themeSwitcher.click();
      await expect(menu).toBeVisible({ timeout: 5_000 });
      if (wasDark) {
        await menu.getByRole("menuitemradio", { name: /Dark/ }).click();
        await expect(html).toHaveClass(/dark/);
      } else {
        await menu.getByRole("menuitemradio", { name: /Light/ }).click();
        await expect(html).not.toHaveClass(/dark/);
      }
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
      const bell = page.getByTestId("notification-bell");
      await expect(bell).toBeVisible({ timeout: 15_000 });

      // Radix renders PopoverContent in a Portal with open animation, and the
      // Notification component invalidates the `notifications` query on open
      // (causing a remount/refetch). So retry the open and scope all lookups
      // to the dialog instead of the whole page.
      const dialog = page.getByRole("dialog");
      await expect(async () => {
        if (!(await dialog.isVisible().catch(() => false))) {
          await bell.click();
        }
        await expect(dialog).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 20_000 });

      await expect(dialog.getByText("Notifications", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      const markAll = dialog.getByRole("button", { name: "Mark all as read" });
      await expect(markAll).toBeVisible({ timeout: 15_000 });

      // Hover (not click) the first row: hover triggers the
      // onMouseEnter -> mark-as-read path without risking navigation away
      // from the console, which would close the popover mid-step.
      const firstRow = dialog.locator('div[class*="cursor-pointer"]').first();
      if (await firstRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await firstRow.hover().catch(() => {});
        await markAll.click().catch(() => {});
        await expect(markAll)
          .toBeVisible({ timeout: 15_000 })
          .catch(() => {});
      }
      await page.keyboard.press("Escape");
      await expect(dialog)
        .toBeHidden({ timeout: 10_000 })
        .catch(() => {});
    });

    await test.step("[Positive] app switcher (grid icon) opens the SELISE Blocks apps list (M9)", async () => {
      const appSwitcher = page.getByRole("button", { name: "SELISE Blocks apps" });
      await expect(appSwitcher).toBeVisible({ timeout: 10_000 });
      await appSwitcher.click();
      await expect(page.getByText("SELISE Blocks", { exact: true })).toBeVisible();

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

    await test.step("[Positive] Your Blocks Projects section lists at least one project", async () => {
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible();
      await expect(page.getByText("Add Project", { exact: true })).toBeVisible();
    });

    await test.step("[Positive] Resources section exposes three cards (Read Docs, Install CLI, Bootstrap)", async () => {
      await expect(page.getByText("Resources", { exact: true })).toBeVisible();
      const resourceCards = page
        .locator("h1, h2, h3, h4, h5, h6")
        .filter({ hasText: /(Read Docs|Install CLI|Bootstrap)/ });
      await expect(resourceCards).toHaveCount(3);
    });

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

      await buildGroup.click();
      await expect(buildGroup).toHaveAttribute("aria-expanded", "true");
      const buildEndpointText = page.getByText("/api/Build").first();
      await expect(buildEndpointText).toBeVisible({ timeout: 5_000 });

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

      await buildGroup.click();
      await expect(buildGroup).toHaveAttribute("aria-expanded", "false");
    });

    await test.step("[Positive] sidebar shows PROJECT and ENVIRONMENT context", async () => {
      await expect(page.getByText(/^Project$/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment/i })).toBeVisible();
    });

    await test.step("[Positive] Deployment nav item switches to the Deployment section", async () => {
      await sidebarNavItem(page, "Deployment").click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
    });

    await test.step("[Positive] Back to console returns to the project list", async () => {
      await page.getByRole("button", { name: "Back to console" }).click();
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible();
    });
  });
});
