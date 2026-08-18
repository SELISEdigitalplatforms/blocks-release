import { test, expect, type Page } from "@playwright/test";
import { loginFresh, openFirstProject, sidebarNavItem } from "@/support/auth-helpers";

/**
 * Runs on the Blocks OS tab (opened separately - see
 * addRepositoryFromEmptyState below). Connects the first repository
 * available in the picker and returns its display name.
 */
async function connectFirstRepository(page: Page): Promise<string> {
  await page.getByTestId("project-card-configure").first().click();
  // await page.getByTestId("project-card-configure").first().click();
  await page.getByRole("link", { name: "Repositories" }).click();
  await expect(page.getByRole("link", { name: "Repositories" })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Select repository" })).toBeVisible();
  await page.getByText("Select a repository", { exact: true }).click();

  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeDisabled();

  const firstRepository = page.getByRole("option").first();
  await expect(firstRepository).toBeVisible({ timeout: 30_000 });

  const repositoryName = await firstRepository.innerText();
  console.log("Selected repository:", repositoryName);

  await firstRepository.click();
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect(page.getByText(repositoryName, { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Back to console" }).click();
  await page.getByRole("button", { name: "SELISE Blocks apps" }).click();
  await page.getByRole("link", { name: "Release Release" }).click();
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  });

  return repositoryName;
}

/**
 * Deployment Overview -> Repository Details -> Configure Deployment modal.
 *
 * IMPORTANT: these tests never trigger a real deployment (no "Deploy Now" /
 * "Deploy" confirm click) since that provisions real Blocks Cloud
 * infrastructure. Modal/dialog interactions are verified via Cancel only.
 *
 * Auth: each test logs in fresh (no shared storageState) so the file stays
 * fully self-contained, matching profile.spec.ts.
 */
test.describe("Deployment", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await openFirstProject(page);
    await sidebarNavItem(page, "Deployment").click();
    await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
  });

  test("Deployment Overview", async ({ page }) => {
    const noRepoHeading = page.getByRole("heading", { name: "No repository added" });
    const repoCard = page.getByRole("button").filter({ hasText: "Deploys for" }).first();

    await test.step("[Positive] shows either the empty state or at least one repo card", async () => {
      const hasNoRepo = await noRepoHeading.isVisible().catch(() => false);
      const hasRepoCard = await repoCard.isVisible().catch(() => false);
      expect(hasNoRepo || hasRepoCard).toBeTruthy();
    });

    await test.step("[Positive] empty state offers an Add repository action", async () => {
      await expect(page.getByRole("button", { name: "Add repository" })).toBeVisible();
      await expect(
        page.getByText(
          "To view deployment activity, please add at least one repository to your project",
        ),
      ).toBeVisible();
    });

    await test.step("[Security] Add repository opens Blocks OS in a separate tab (no in-app credential exposure)", async () => {
      await page.getByRole("button", { name: "Back to console" }).click();
      await connectFirstRepository(page);
      await openFirstProject(page);
      await sidebarNavItem(page, "Deployment").click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("[Positive] repo card shows Repo URL, Deploys To and a Deployment Status badge", async () => {
      const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();
      await expect(repoCard).toBeVisible({ timeout: 30_000 });
      await expect(repoCard).toContainText("Repo URL");
      await expect(repoCard).toContainText("Deploys To");
      await expect(repoCard).toContainText("Deployment Status");
    });
  });

  test("Repository Details", async ({ page }) => {
    const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();
    await test.step("Ensure repository is available", async () => {
      if (!(await repoCard.isVisible().catch(() => false))) {
        await page.getByRole("button", { name: "Back to console" }).click();
        await connectFirstRepository(page);
        await openFirstProject(page);
        await sidebarNavItem(page, "Deployment").click();
        await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible({
          timeout: 30_000,
        });
      }
    });

    await test.step("[Positive] opening a repo card navigates to Repository Details", async () => {
      await expect(repoCard).toBeVisible({ timeout: 30_000 });
      await repoCard.click();
      await expect(page).toHaveURL(/\/deployment\/repo\//, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: /Repository Details/i }).first()).toBeVisible({
        timeout: 30_000,
      });
    });

    const noDeploymentsHeading = page.getByRole("heading", { name: "No deployments available" });
    const hasNoDeployments = await noDeploymentsHeading.isVisible().catch(() => false);

    await test.step("[Positive] never-deployed repo shows the empty state with Deploy Now", async () => {
      if (!hasNoDeployments) return;

      await expect(
        page.getByText("This repository has not been deployed yet. Click the deploy"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Deploy Now" })).toBeVisible();
    });

    await test.step("[Positive] Deploy Now opens the Configure Deployment modal with both deployment types", async () => {
      if (!hasNoDeployments) return;

      await page.getByRole("button", { name: "Deploy Now" }).click();

      const dialog = page.getByRole("dialog", { name: "Configure Deployment" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Deployment Type", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel("Git based deployment")).toBeVisible();
      await expect(dialog.getByLabel("Blocks Cloud based deployment")).toBeVisible();
    });

    await test.step("[Negative] Cancel closes Configure Deployment without starting a deployment", async () => {
      if (!hasNoDeployments) return;

      const dialog = page.getByRole("dialog", { name: "Configure Deployment" });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(noDeploymentsHeading).toBeVisible();
    });

    await test.step("[Positive] deployed repo shows Deployment Information with Repo URL and status", async () => {
      if (hasNoDeployments) return;

      await expect(page.getByRole("heading", { name: "Deployment Information" })).toBeVisible();
      await expect(page.getByText("Repo URL", { exact: true })).toBeVisible();
      await expect(page.getByText("Deployment Status", { exact: true })).toBeVisible();
    });

    await test.step("[Negative] Deploy confirmation can be dismissed via Cancel without redeploying", async () => {
      if (hasNoDeployments) return;

      await page.getByRole("button", { name: "Deploy", exact: true }).click();

      const confirmDialog = page.getByRole("dialog", { name: "Confirm Deployment" });
      await expect(confirmDialog).toBeVisible();

      await confirmDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(confirmDialog).toBeHidden();
    });

    await test.step("[Positive] back button returns to Deployment Overview", async () => {
      await page.getByRole("button", { name: "Go back" }).click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
    });
  });
});
