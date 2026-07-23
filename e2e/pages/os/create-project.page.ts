import { type Page, expect } from "@playwright/test";

export class OSCreateProjectPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    const osBaseUrl = process.env.E2E_OS_BASE_URL;
    if (!osBaseUrl) {
      throw new Error("E2E_OS_BASE_URL is not set in .env.e2e");
    }
    // First go to the OS app root to ensure auth is handled, then navigate to create project
    await this.page.goto(osBaseUrl);
    await this.page.waitForLoadState("networkidle");
    // Then go to create project
    await this.page.goto(`${osBaseUrl}/app/create-project`);
    await this.page.waitForLoadState("networkidle");
    // Wait for the project name textbox to be visible
    await this.page
      .getByRole("textbox", { name: "Enter your project name" })
      .waitFor({ state: "visible", timeout: 60000 });
  }

  async fillProjectName(projectName: string) {
    await this.page
      .getByRole("textbox", { name: "Enter your project name" })
      .click();
    await this.page
      .getByRole("textbox", { name: "Enter your project name" })
      .fill(projectName);
  }

  async checkConfirmationCheckboxes() {
    await this.page
      .getByRole("checkbox", { name: "I confirm that I will use" })
      .click();
    await this.page
      .getByRole("checkbox", { name: "I accept the Terms of services" })
      .click();
  }

  async clickContinue() {
    await this.page.getByRole("button", { name: "Continue" }).click();
  }

  async clickAddRepository() {
    await this.page.getByRole("button", { name: "Add repository" }).click();
  }

  async clickContinueWithGitHub() {
    const popupPromise = this.page.waitForEvent("popup");
    await this.page
      .getByRole("button", { name: "GitHub icon Continue with" })
      .click();
    return popupPromise;
  }

  async selectRepository(repoOwner: string, repoName: string) {
    await this.page.getByText("Select a repository").click();
    await this.page
      .getByRole("textbox", { name: "Search repositories..." })
      .fill(repoName);
    await this.page.getByText(`${repoOwner}/${repoName}`).click();
  }

  async clickAdd() {
    await this.page.getByRole("button", { name: "Add" }).click();
  }

  async checkEnvironment(environmentName: string) {
    await this.page
      .getByRole("checkbox", { name: new RegExp(`^${environmentName}`) })
      .click();
  }

  async clickSubmit() {
    await this.page.getByRole("button", { name: "Submit" }).click();
  }
}
