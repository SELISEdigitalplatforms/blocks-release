import { loginFresh } from "@/support/auth-helpers";
import { test, expect, type Page } from "@playwright/test";

async function openFirstProject(page: Page) {
  await page
    .getByRole("button", {
      name: /Development|Testing|Staging|IAT|UAT|Production/,
    })
    .first()
    .click();
  await expect(page.getByText(/^workspace$/i)).toBeVisible({
    timeout: 50_000,
  });
}

function sidebarNavItem(page: Page, name: "Overview" | "Deployment") {
  return page
    .getByRole("link", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }));
}

async function connectFirstRepository(page: Page): Promise<string> {
  await page.getByTestId("project-card-configure").first().click();
  await page.getByTestId("project-card-configure").first().click();
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
  await expect(page.getByText(repositoryName, { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Back to console" }).click();
  await page.getByRole("button", { name: "SELISE Blocks apps" }).click();
  await page.getByRole("link", { name: "Release Release" }).click();
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30_000,
  });

  return repositoryName;
}

test.describe("Deployment", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 80000,
    });

    await openFirstProject(page);
    await sidebarNavItem(page, "Deployment").click();
    await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
  });

  test("Deployment Overview and Repository Details", async ({ page }) => {
    const noRepoHeading = page.getByRole("heading", {
      name: "No repository added",
    });

    const addRepositoryButton = page.getByRole("button", {
      name: "Add repository",
    });

    const noRepoDescription = page.getByText(
      "To view deployment activity, please add at least one repository to your project",
    );

    const repoCard = page.getByRole("button").filter({ hasText: "Deploys for" }).first();

    // Verify repository empty state or repository card
    const hasNoRepo = await noRepoHeading.isVisible().catch(() => false);

    if (hasNoRepo) {
      await expect(noRepoHeading).toBeVisible();

      await expect(addRepositoryButton).toBeVisible({
        timeout: 10000,
      });

      await expect(noRepoDescription).toBeVisible();
    } else {
      await expect(repoCard).toBeVisible({
        timeout: 10000,
      });
    }

    // Ensure repository is available and open Deployment Overview
    const hasRepo = await repoCard.isVisible().catch(() => false);

    if (!hasRepo) {
      await page.getByRole("button", { name: "Back to console" }).click();

      await connectFirstRepository(page);
      await openFirstProject(page);

      await sidebarNavItem(page, "Deployment").click();

      await expect(
        page.getByRole("heading", {
          name: "Deployment Overview",
        }),
      ).toBeVisible({
        timeout: 30000,
      });
    }

    // Repo card shows Repo URL, Deploys To and Deployment Status
    {
      const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();

      await expect(repoCard).toBeVisible({
        timeout: 30000,
      });

      await expect(repoCard).toContainText("Repo URL");
      await expect(repoCard).toContainText("Deploys To");
      await expect(repoCard).toContainText("Deployment Status");
    }

    // Opening repo card navigates to Repository Details
    {
      const repoCard = page.getByRole("button", { name: /Deploys for/ }).first();

      await repoCard.click();

      await expect(page).toHaveURL(/\/deployment\/repo\//, {
        timeout: 30000,
      });

      await expect(
        page
          .getByRole("heading", {
            name: /Repository Details/i,
          })
          .first(),
      ).toBeVisible({
        timeout: 30000,
      });
    }

    const noDeploymentsHeading = page.getByRole("heading", {
      name: "No deployments available",
    });

    const hasNoDeployments = await noDeploymentsHeading.isVisible().catch(() => false);

    // Never-deployed repo shows empty state with Deploy Now
    if (hasNoDeployments) {
      await expect(
        page.getByText("This repository has not been deployed yet. Click the deploy"),
      ).toBeVisible();

      await expect(
        page.getByRole("button", {
          name: "Deploy Now",
        }),
      ).toBeVisible();
    }

    // Deploy Now opens Configure Deployment modal
    if (hasNoDeployments) {
      await page
        .getByRole("button", {
          name: "Deploy Now",
        })
        .click();

      const dialog = page.getByRole("dialog", {
        name: "Configure Deployment",
      });

      await expect(dialog).toBeVisible();

      await expect(
        dialog.getByText("Deployment Type", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(dialog.getByLabel("Git based deployment")).toBeVisible();

      await expect(dialog.getByLabel("Blocks Cloud based deployment")).toBeVisible();
    }

    // [Negative] Cancel closes Configure Deployment
    if (hasNoDeployments) {
      const dialog = page.getByRole("dialog", {
        name: "Configure Deployment",
      });

      await dialog
        .getByRole("button", {
          name: "Cancel",
        })
        .click();

      await expect(dialog).toBeHidden();

      await expect(noDeploymentsHeading).toBeVisible();
    }

    // Deployed repo shows Deployment Information
    if (!hasNoDeployments) {
      await expect(
        page.getByRole("heading", {
          name: "Deployment Information",
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Repo URL", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Deployment Status", {
          exact: true,
        }),
      ).toBeVisible();
    }

    // [Negative] Deploy confirmation can be cancelled
    if (!hasNoDeployments) {
      await page
        .getByRole("button", {
          name: "Deploy",
          exact: true,
        })
        .click();

      const confirmDialog = page.getByRole("dialog", {
        name: "Confirm Deployment",
      });

      await expect(confirmDialog).toBeVisible();

      await confirmDialog
        .getByRole("button", {
          name: "Cancel",
        })
        .click();

      await expect(confirmDialog).toBeHidden();
    }

    // Back button returns to Deployment Overview
    await page
      .getByRole("button", {
        name: "Go back",
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Deployment Overview",
      }),
    ).toBeVisible();
  });
});
