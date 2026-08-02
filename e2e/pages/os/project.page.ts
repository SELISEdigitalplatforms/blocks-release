import { type Page, expect } from "@playwright/test";

export class OSProjectPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickRepositoriesLink() {
    await this.page.getByRole("link", { name: "Repositories" }).click();
  }

  async clickAddButton() {
    await this.page.getByRole("button", { name: "Add" }).click();
  }

  async selectRepository(repoOwner: string, repoName: string) {
    await this.page.getByText("Select a repository").click();
    await this.page.getByRole("textbox", { name: "Search repositories..." }).fill(repoName);
    await this.page.getByText(`${repoOwner}/${repoName}`).click();
  }

  async clickAdd() {
    await this.page.getByRole("button", { name: "Add" }).click();
  }
}
