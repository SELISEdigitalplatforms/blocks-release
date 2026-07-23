import { type Page, expect } from "@playwright/test";

export class DeploymentPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/app/console");
    await this.page.getByRole("link", { name: "Deployment" }).click();
  }

  async clickDeploymentLink() {
    await this.page
      .locator("div")
      .filter({ hasText: /^OverviewDeployment$/ })
      .click();
    await this.page.getByRole("link", { name: "Deployment" }).click();
  }

  async clickDeploysForRepo(repoName: string) {
    await this.page
      .locator("div")
      .filter({ hasText: new RegExp(`^Deploys for ${repoName}$`) })
      .click();
  }

  async clickDeployNow() {
    await this.page.getByRole("button", { name: "Deploy Now" }).click();
  }

  async expectDeploymentStartedToast() {
    await expect(this.page.getByText("Deployment Started")).toBeVisible();
  }

  async expectDeploymentLogsVisible() {
    await expect(this.page.getByText("Deployment logsClone")).toBeVisible();
  }

  async expectSuccessfullyDeployedToast() {
    await expect(this.page.getByText("Successfully deployed")).toBeVisible({ timeout: 120000 });
  }

  async clickSASTButton() {
    await this.page.getByRole("button", { name: "SAST" }).click();
  }

  async expectSASTPassed() {
    await expect(this.page.getByText("Passed")).toBeVisible();
  }

  async clickSCAButton() {
    await this.page.getByRole("button", { name: "SCA" }).click();
  }

  async clickDASTButton() {
    await this.page.getByRole("button", { name: "DAST" }).click();
  }

  async clickDeploymentLogsButton() {
    await this.page.getByRole("button", { name: "Deployment Logs" }).click();
  }

  async clickManageMonitors() {
    const popupPromise = this.page.waitForEvent("popup");
    await this.page.getByRole("button", { name: "Manage Monitors" }).click();
    return popupPromise;
  }
}
