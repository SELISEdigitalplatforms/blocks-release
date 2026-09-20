import { test, expect } from "../../support/test-base";
import {
  openReleaseDeployment,
  verifyAddRepositoryOpensOsTab,
} from "../../support/release-helpers";

test.describe("Deployment", () => {
  test("Deployment Overview and Repository Details", async ({ page }) => {
    await openReleaseDeployment(page);

    const noRepoHeading = page.getByRole("heading", { name: "No repository added" });
    const repoCard = page.getByRole("button").filter({ hasText: "Deploys for" }).first();

    await test.step("[Positive] shows either the empty state or at least one repo card", async () => {
      const hasNoRepo = await noRepoHeading.isVisible().catch(() => false);
      const hasRepoCard = await repoCard.isVisible().catch(() => false);
      expect(hasNoRepo || hasRepoCard).toBe(true);
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

      const openedOsTab = await verifyAddRepositoryOpensOsTab(page);
      expect(openedOsTab).toBe(true);
    });

    await test.step("[Positive] repo card shows Repo URL, Deploys To and a Deployment Status badge", async () => {
      const linkedRepoCard = page.getByRole("button", { name: /Deploys for/ }).first();
      if (!(await linkedRepoCard.isVisible({ timeout: 8_000 }).catch(() => false))) return;

      await expect(linkedRepoCard).toContainText("Repo URL");
      await expect(linkedRepoCard).toContainText("Deploys To");
      await expect(linkedRepoCard).toContainText("Deployment Status");
    });

    if (!(await repoCard.isVisible().catch(() => false))) {
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
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByText("Deployment Type", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel(/Git based deployment/i)).toBeVisible();
      await expect(dialog.getByLabel(/Blocks Cloud based deployment/i)).toBeVisible();
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

    await test.step("[Positive] History tab lists paginated deploys and clicking a row opens its logs (M11+M16)", async () => {
      if (hasNoDeployments) {
        return;
      }

      const historyTab = page.getByRole("tab", { name: "History" });
      await expect(historyTab).toBeVisible({ timeout: 10_000 });

      await historyTab.click();
      await expect(page).toHaveURL(/[?&]tab=history/);
      await expect(historyTab).toHaveAttribute("data-state", "active");
      await expect(page.getByRole("heading", { name: "Deployment History" })).toBeVisible();

      const historyRow = page
        .getByRole("button")
        .filter({ hasText: /ID:\s*/ })
        .first();
      await expect(historyRow).toBeVisible({ timeout: 10_000 });

      await historyRow.click();
      await expect(page).toHaveURL(/\/deployment-logs\//, { timeout: 30_000 });
    });

    await test.step("[Positive] Environment Variables tab loads the secrets panel (M12)", async () => {
      const envVarsTab = page.getByRole("tab", { name: "Environment Variables" });
      await expect(envVarsTab).toBeVisible({ timeout: 10_000 });
      await envVarsTab.click();
      await expect(page).toHaveURL(/[?&]tab=secrets/);

      const skeleton = page.getByTestId("secrets-tab-loading");
      await expect(skeleton).toBeHidden({ timeout: 30_000 });

      const activityButton = page.getByRole("button", { name: /^Activity$/ });
      const addVariablesButton = page.getByRole("button", { name: /^Add variables$/ });
      await expect(activityButton.or(addVariablesButton)).toBeVisible({ timeout: 10_000 });

      if (!(await activityButton.isVisible({ timeout: 1_000 }).catch(() => false))) return;

      await activityButton.click();
      const auditDialog = page.getByRole("dialog").filter({ hasText: /Activity|Audit|Recorded/i });
      await expect(auditDialog).toBeVisible({ timeout: 10_000 });
      await auditDialog
        .getByRole("button", { name: /Close|Cancel/ })
        .first()
        .click();
      await expect(auditDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Positive] Environment Variables empty state offers an Add variables action that opens the secret form modal", async () => {
      const envVarsTab = page.getByRole("tab", { name: "Environment Variables" });
      if (
        !(await envVarsTab.isVisible({ timeout: 5_000 }).catch(() => false))
      ) {
        return;
      }
      await envVarsTab.click();
      await expect(page.getByTestId("secrets-tab-loading")).toBeHidden({
        timeout: 30_000,
      });

      const addVariablesButton = page.getByRole("button", {
        name: /^Add variables$/,
      });
      if (!(await addVariablesButton.isVisible({ timeout: 2_000 }).catch(() => false))) {
        return;
      }

      await addVariablesButton.click();
      const formDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Add (?:environment )?(?:variables?|secrets?)|Secret|Key.*Value/i });
      await expect(formDialog).toBeVisible({ timeout: 10_000 });

      await formDialog
        .getByRole("button", { name: /^Cancel$/ })
        .click();
      await expect(formDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Positive] Configure button opens the Deployment Settings modal (M13)", async () => {
      if (hasNoDeployments) {
        return;
      }

      const configureButton = page.getByRole("button", { name: /^Configure$/ });
      await expect(configureButton).toBeVisible({ timeout: 10_000 });

      await configureButton.click();
      const settingsDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Deployment Settings|Deployment Type|Git based deployment/i })
        .first();
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
      await expect(settingsDialog.getByLabel(/Git based deployment/i)).toBeVisible();
      await expect(settingsDialog.getByLabel(/Blocks Cloud based deployment/i)).toBeVisible();

      await settingsDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(settingsDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Positive] Configure modal radios switch between Git based and Blocks Cloud based deployment", async () => {
      if (hasNoDeployments) return;

      const configureButton = page.getByRole("button", { name: /^Configure$/ });
      await expect(configureButton).toBeVisible({ timeout: 10_000 });
      await configureButton.click();

      const settingsDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Deployment Settings|Deployment Type/i })
        .first();
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 });

      const gitRadio = settingsDialog.getByLabel(/Git based deployment/i);
      const cloudRadio = settingsDialog.getByLabel(/Blocks Cloud based deployment/i);

      const gitChecked = await gitRadio.isChecked();
      await cloudRadio.click();
      await expect(cloudRadio).toBeChecked();
      await expect(gitRadio).not.toBeChecked();

      await gitRadio.click();
      await expect(gitRadio).toBeChecked();
      await expect(cloudRadio).not.toBeChecked();

      if (gitChecked) {
        await gitRadio.click();
      } else {
        await cloudRadio.click();
      }

      await settingsDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(settingsDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Negative] Delete deployment can be cancelled from the confirmation modal (M14)", async () => {
      if (hasNoDeployments) {
        return;
      }

      const deleteButton = page.getByTestId("delete-deployment-button");
      await expect(deleteButton).toBeVisible({ timeout: 10_000 });

      await deleteButton.click();
      const confirmDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Delete deployment\?|permanently destroys/i });
      await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
      await confirmDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(confirmDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Positive] Monitoring card exposes Manage Monitors and an alerts list (M15)", async () => {
      if (hasNoDeployments) {
        return;
      }

      const monitoringHeading = page.getByText("Monitoring", { exact: true }).first();
      await expect(monitoringHeading).toBeVisible({ timeout: 10_000 });
      await monitoringHeading.scrollIntoViewIfNeeded();

      const manageMonitors = page.getByRole("button", { name: /Manage Monitors/i });
      await expect(manageMonitors).toBeVisible({ timeout: 5_000 });

      const alertsTable = page.locator("table").filter({
        has: page.getByRole("columnheader", { name: /Severity|Status|Alert/i }),
      });
      await expect(alertsTable).toBeVisible({ timeout: 10_000 });
    });

    await test.step("[Positive] back button returns to Deployment Overview", async () => {
      await page.getByRole("button", { name: "Go back" }).click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
    });
  });
});
