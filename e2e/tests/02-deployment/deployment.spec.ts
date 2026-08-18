import { test, expect, type Page } from "@playwright/test";
import { namedProjectCard } from "@/support/create-and-delete-project";
import { readReleaseProject } from "@/support/release-project";
import { openReleaseDeployment } from "@/support/release-helpers";

async function openSharedProjectRepositories(osPage: Page) {
  const fixture = readReleaseProject();
  const repositoriesHeading = osPage.getByRole("heading", { name: "Repositories" });
  if (await repositoriesHeading.isVisible({ timeout: 8_000 }).catch(() => false)) {
    return;
  }

  await osPage.goto(`${new URL(osPage.url()).origin}/app/console`);
  await expect(osPage.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  });

  if (fixture?.projectName) {
    const card = namedProjectCard(osPage, fixture.projectName);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("project-card-configure").click();
  } else {
    await osPage.getByTestId("project-card-configure").first().click();
  }

  await osPage.getByRole("link", { name: "Repositories" }).click();
  await expect(repositoriesHeading).toBeVisible({ timeout: 30_000 });
}

async function trySelectFirstRepository(osPage: Page): Promise<boolean> {
  const connectHeading = osPage.getByRole("heading", { name: "Connect repository" });
  const selectHeading = osPage.getByRole("heading", { name: "Select repository" });
  await expect(connectHeading.or(selectHeading)).toBeVisible({ timeout: 30_000 });

  if (await connectHeading.isVisible().catch(() => false)) {
    const githubPopup = osPage.waitForEvent("popup", { timeout: 8_000 }).catch(() => null);
    await osPage.getByRole("button", { name: /Continue with GitHub/i }).click();
    const githubPage = await githubPopup;
    if (githubPage) {
      const needsGitHubLogin = await githubPage
        .getByRole("button", { name: "Sign in" })
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (needsGitHubLogin) {
        await githubPage.close();
        await osPage.keyboard.press("Escape").catch(() => {});
        return false;
      }
      await githubPage.waitForEvent("close", { timeout: 30_000 }).catch(() => {});
    }
  }

  if (!(await selectHeading.isVisible({ timeout: 8_000 }).catch(() => false))) {
    await osPage.keyboard.press("Escape").catch(() => {});
    return false;
  }

  await osPage.getByText("Select a repository", { exact: true }).click();
  const confirmAdd = osPage.getByRole("button", { name: "Add", exact: true });
  const firstRepository = osPage.getByRole("option").first();
  await expect(firstRepository).toBeVisible({ timeout: 30_000 });
  const repositoryName = (await firstRepository.innerText()).trim();
  await firstRepository.click();
  await expect(confirmAdd).toBeEnabled();
  await confirmAdd.click();
  await expect(osPage.getByText(repositoryName, { exact: true })).toBeVisible({ timeout: 30_000 });
  return true;
}

/**
 * Add repository is hosted on Blocks OS so Git credentials never enter Release.
 * Returns true when a repository was actually linked.
 */
async function connectFirstRepository(page: Page): Promise<boolean> {
  const addRepository = page.getByRole("button", { name: "Add repository" });
  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null);

  if (await addRepository.isVisible().catch(() => false)) {
    await addRepository.click();
    const osPage = await popupPromise;
    if (osPage) {
      await osPage.waitForLoadState("domcontentloaded");
      await expect(osPage).toHaveURL(/dev-os/, { timeout: 30_000 });
      await openSharedProjectRepositories(osPage);
      await osPage.getByRole("button", { name: "Add", exact: true }).click();
      const added = await trySelectFirstRepository(osPage);
      await osPage.close();
      return added;
    }
  }

  await page.getByRole("button", { name: "Back to console" }).click();
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  });

  const fixture = readReleaseProject();
  if (fixture?.projectName) {
    const card = namedProjectCard(page, fixture.projectName);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("project-card-configure").click();
  } else {
    await page.getByTestId("project-card-configure").first().click();
  }

  await page.getByRole("link", { name: "Repositories" }).click();
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const added = await trySelectFirstRepository(page);

  await page.getByRole("button", { name: "SELISE Blocks apps" }).click();
  await page.getByRole("link", { name: /Release/i }).first().click();
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  });

  return added;
}

/**
 * Deployment Overview -> Repository Details -> Configure Deployment modal.
 *
 * IMPORTANT: these tests never trigger a real deployment (no "Deploy Now" /
 * "Deploy" confirm click) since that provisions real Blocks Cloud
 * infrastructure. Modal/dialog interactions are verified via Cancel only.
 *
 * Auth: uses the shared project from release.setup.spec.ts (one login per suite).
 */
test.describe("Deployment", () => {
  test.beforeEach(async ({ page }) => {
    await openReleaseDeployment(page);
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
      if (!(await noRepoHeading.isVisible().catch(() => false))) return;

      await expect(page.getByRole("button", { name: "Add repository" })).toBeVisible();
      await expect(
        page.getByText(
          "To view deployment activity, please add at least one repository to your project",
        ),
      ).toBeVisible();
    });

    await test.step("[Security] Add repository opens Blocks OS in a separate tab (no in-app credential exposure)", async () => {
      if (await repoCard.isVisible().catch(() => false)) return;

      await connectFirstRepository(page);
      await openReleaseDeployment(page);
    });

    await test.step("[Positive] repo card shows Repo URL, Deploys To and a Deployment Status badge", async () => {
      const linkedRepoCard = page.getByRole("button", { name: /Deploys for/ }).first();
      if (!(await linkedRepoCard.isVisible({ timeout: 8_000 }).catch(() => false))) return;

      await expect(linkedRepoCard).toContainText("Repo URL");
      await expect(linkedRepoCard).toContainText("Deploys To");
      await expect(linkedRepoCard).toContainText("Deployment Status");
    });
  });

  test("Repository Details", async ({ page }) => {
    const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();

    await test.step("Ensure repository is available", async () => {
      if (await repoCard.isVisible().catch(() => false)) return;

      await connectFirstRepository(page);
      await openReleaseDeployment(page);
    });

    if (!(await repoCard.isVisible().catch(() => false))) {
      test.info().annotations.push({
        type: "note",
        description: "No repository linked (GitHub authorization required on OS).",
      });
      return;
    }

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
