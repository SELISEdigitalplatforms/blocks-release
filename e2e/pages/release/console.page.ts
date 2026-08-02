import { type Page, expect } from "@playwright/test";

export class ConsolePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/app/console");
  }

  async clickAddProject() {
    await this.page.getByText("Add Project").click();
  }

  async clickBackToConsole() {
    await this.page.getByRole("button", { name: "Back to console" }).click();
  }

  async clickSELISEBlocksApps() {
    await this.page.getByRole("button", { name: "SELISE Blocks apps" }).click();
  }

  async clickReleaseLink() {
    await this.page.getByRole("link", { name: "Release Release" }).click();
  }

  async clickProjectSettings(projectName: string) {
    // Find the project by name and click its settings icon
    // Find the container that has both the project name and a settings button (svg.lucide-settings2),
    // then click that button inside it
    const projectContainer = this.page
      .locator("div")
      .filter({ has: this.page.getByText(projectName, { exact: false }) })
      .filter({ has: this.page.locator("svg.lucide-settings2") })
      .last();
    const settingsButton = projectContainer
      .locator("button")
      .filter({ has: this.page.locator("svg.lucide-settings2") });
    await settingsButton.click();
  }

  async clickEnvironment(environmentName: string) {
    await this.page
      .locator("div")
      .filter({ hasText: new RegExp(`^${environmentName}$`) })
      .first()
      .click();
  }

  async clickDeleteButton() {
    // Click the main delete button (not the "Delete domain" buttons)
    await this.page
      .getByRole("button", { name: "Delete", exact: true })
      .click();
  }

  async confirmDelete() {
    // Click the confirmation delete button (target the destructive variant, not domain delete buttons)
    // Or use the exact button with name "Delete" and no title "Delete domain"
    await this.page
      .getByRole("button", { name: "Delete", exact: true })
      .filter({ hasNot: this.page.getByTitle("Delete domain") })
      .click();
  }

  async expectSuccessfullyDeletedToast() {
    // Target the specific toast div with "Successfully deleted" (not the status element)
    await expect(
      this.page
        .locator("div.text-sm.opacity-90")
        .filter({ hasText: "Successfully deleted" }),
    ).toBeVisible();
  }
}
