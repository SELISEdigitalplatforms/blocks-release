import { test, expect } from "../../support/test-base";
import {
  openReleaseDeployment,
  verifyAddRepositoryOpensOsTab,
} from "../../support/release-helpers";

/**
 * Deployment Overview → Repository Details → tabs (History, Env Variables,
 * Configure, Delete, Monitoring) as a single end-to-end pass.
 *
 * IMPORTANT: this test never triggers a real deployment (no "Deploy Now" /
 * "Deploy" confirm click) since that provisions real Blocks Cloud
 * infrastructure. Modal/dialog interactions are verified via Cancel only.
 *
 * One top-level `test` is used (rather than separate tests per section) so the
 * whole file can be invoked as a single test invocation.
 *
 * Auth: uses the shared project from suite.setup.spec.ts (one login per suite).
 */
test.describe("Deployment", () => {
  test("Deployment Overview and Repository Details", async ({ page }) => {
    // -------------------------------------------------------------------------
    // Section 1: Deployment Overview
    // -------------------------------------------------------------------------
    await openReleaseDeployment(page);

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

      const openedOsTab = await verifyAddRepositoryOpensOsTab(page);
      expect(openedOsTab).toBeTruthy();
    });

    await test.step("[Positive] repo card shows Repo URL, Deploys To and a Deployment Status badge", async () => {
      const linkedRepoCard = page.getByRole("button", { name: /Deploys for/ }).first();
      if (!(await linkedRepoCard.isVisible({ timeout: 8_000 }).catch(() => false))) return;

      await expect(linkedRepoCard).toContainText("Repo URL");
      await expect(linkedRepoCard).toContainText("Deploys To");
      await expect(linkedRepoCard).toContainText("Deployment Status");
    });

    // -------------------------------------------------------------------------
    // Section 2: Repository Details — only when a repo is already linked.
    // Best-effort GitHub linking is skipped here: OAuth is unavailable in CI /
    // shared e2e accounts and previously burned the full test timeout. Empty
    // state + "opens OS in a new tab" are covered above; repo-detail sections
    // below early-return when no card exists.
    // -------------------------------------------------------------------------
    if (!(await repoCard.isVisible().catch(() => false))) {
      return
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

    // -------------------------------------------------------------------------
    // Section 3: Repository Details — never-deployed branch
    // -------------------------------------------------------------------------
    await test.step("[Positive] never-deployed repo shows the empty state with Deploy Now", async () => {
      if (!hasNoDeployments) return;

      await expect(
        page.getByText("This repository has not been deployed yet. Click the deploy"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Deploy Now" })).toBeVisible();
    });

    await test.step("[Positive] Deploy Now opens the Configure Deployment modal with both deployment types", async () => {
      if (!hasNoDeployments) return;

      // Strict: Deploy Now must open the modal — without this click, the
      // downstream Cancel step has no dialog to act on.
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

    // -------------------------------------------------------------------------
    // Section 4: Repository Details — deployed branch (existing tests)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Section 5: Repository Details — M11+M16 History tab (strict)
    // -------------------------------------------------------------------------
    await test.step("[Positive] History tab lists paginated deploys and clicking a row opens its logs (M11+M16)", async () => {
      if (hasNoDeployments) {
        // Repository has no deployments yet — History is only rendered after
        // a successful build. Exit gracefully instead of marking the whole
        // test as skipped.
        return;
      }

      // Strict assertion: every deployed repository is expected to expose the
      // History tab.
      const historyTab = page.getByRole("tab", { name: "History" });
      await expect(historyTab).toBeVisible({ timeout: 10_000 });

      await historyTab.click();
      await expect(page).toHaveURL(/[?&]tab=history/);
      await expect(historyTab).toHaveAttribute("data-state", "active");
      await expect(page.getByRole("heading", { name: "Deployment History" })).toBeVisible();

      // The History tab shows a server-paged build table. Each row is rendered
      // as a role="button" by DeploymentObservability; rows that share the
      // latest-build slot surface the status pill via NotificationListener
      // instead of the inline Badge. Either way every row carries an "ID:"
      // label.
      const historyRow = page
        .getByRole("button")
        .filter({ hasText: /ID:\s*/ })
        .first();
      await expect(historyRow).toBeVisible({ timeout: 10_000 });

      // Click the row body (not an action chip inside it) to exercise the
      // row-level navigation into the deployment logs page.
      await historyRow.click();
      await expect(page).toHaveURL(/\/deployment-logs\//, { timeout: 30_000 });
    });

    // -------------------------------------------------------------------------
    // Section 6: Repository Details — M12 Environment Variables tab (strict)
    // -------------------------------------------------------------------------
    await test.step("[Positive] Environment Variables tab loads the secrets panel (M12)", async () => {
      // The "Never deployed" repo layout still exposes the Environment
      // Variables tab (the server keys the variables on the repository
      // alone), so this test runs regardless of deploy state.
      const envVarsTab = page.getByRole("tab", { name: "Environment Variables" });
      await expect(envVarsTab).toBeVisible({ timeout: 10_000 });
      await envVarsTab.click();
      await expect(page).toHaveURL(/[?&]tab=secrets/);

      // The lazy-loaded panel swaps in from a skeleton. The strict assertion
      // is on the panel having finished loading — the populated card
      // (Activity + variable list) or the empty state ("Add variables")
      // must replace the skeleton, never an undefined mid-state.
      const skeleton = page.getByTestId("secrets-tab-loading");
      await expect(skeleton).toBeHidden({ timeout: 30_000 });

      // Strict: exactly one of the two loaded states must be present —
      // Activity (variables exist) OR the empty-state primary action.
      const activityButton = page.getByRole("button", { name: /^Activity$/ });
      const addVariablesButton = page.getByRole("button", { name: /^Add variables$/ });
      await expect(activityButton.or(addVariablesButton)).toBeVisible({ timeout: 10_000 });

      // Activity panel is only opened when there is at least one variable
      // to audit. Exercise the open/close flow strictly when present.
      if (!(await activityButton.isVisible({ timeout: 1_000 }).catch(() => false))) return;

      await activityButton.click();
      const auditDialog = page.getByRole("dialog").filter({ hasText: /Activity|Audit|Recorded/i });
      await expect(auditDialog).toBeVisible({ timeout: 10_000 });
      // Activity is read-only — closing must not mutate state.
      await auditDialog
        .getByRole("button", { name: /Close|Cancel/ })
        .first()
        .click();
      await expect(auditDialog).toBeHidden({ timeout: 5_000 });
    });

    // -------------------------------------------------------------------------
    // Section 7: Repository Details — M13 Configure (Deployment Settings) modal
    // -------------------------------------------------------------------------
    await test.step("[Positive] Configure button opens the Deployment Settings modal (M13)", async () => {
      if (hasNoDeployments) {
        // Repository has no deployments yet — Configure is only rendered
        // after a successful build. Exit gracefully.
        return;
      }

      // Configure is rendered in the top bar alongside Deploy/Delete for
      // every deployed repository; strict assertion that it is present.
      const configureButton = page.getByRole("button", { name: /^Configure$/ });
      await expect(configureButton).toBeVisible({ timeout: 10_000 });

      await configureButton.click();
      const settingsDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Deployment Settings|Deployment Type|Git based deployment/i })
        .first();
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
      // Both deployment type radio buttons should be present.
      await expect(settingsDialog.getByLabel(/Git based deployment/i)).toBeVisible();
      await expect(settingsDialog.getByLabel(/Blocks Cloud based deployment/i)).toBeVisible();

      // Cancel without saving — saving would mutate tenant settings.
      await settingsDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(settingsDialog).toBeHidden({ timeout: 5_000 });
    });

    // -------------------------------------------------------------------------
    // Section 8: Repository Details — M14 Delete deployment cancel
    // -------------------------------------------------------------------------
    await test.step("[Negative] Delete deployment can be cancelled from the confirmation modal (M14)", async () => {
      if (hasNoDeployments) {
        // Repository has no deployments yet — Delete is only rendered
        // after a successful build. Exit gracefully.
        return;
      }

      // The Delete control is rendered for every deployed repository (it is
      // the destructive teardown control beside Configure/Deploy). Strict
      // assertion.
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

    // -------------------------------------------------------------------------
    // Section 9: Repository Details — M15 Monitoring card
    // -------------------------------------------------------------------------
    await test.step("[Positive] Monitoring card exposes Manage Monitors and an alerts list (M15)", async () => {
      if (hasNoDeployments) {
        // Repository has no deployments yet — Monitoring is only rendered
        // after a successful build. Exit gracefully.
        return;
      }

      // Monitoring is rendered for every deployed repository's details page.
      // Strict assertion that the card and its controls are present.
      const monitoringHeading = page.getByText("Monitoring", { exact: true }).first();
      await expect(monitoringHeading).toBeVisible({ timeout: 10_000 });
      await monitoringHeading.scrollIntoViewIfNeeded();

      // Manage Monitors opens the dedicated monitor app in a new tab — verify
      // the control is rendered. Do NOT click it: navigating away would leave
      // the storage state on a foreign origin.
      const manageMonitors = page.getByRole("button", { name: /Manage Monitors/i });
      await expect(manageMonitors).toBeVisible({ timeout: 5_000 });

      // The alerts table is rendered as a real <table> for monitoring data;
      // assert its presence rather than tolerating either branch.
      const alertsTable = page.locator("table").filter({
        has: page.getByRole("columnheader", { name: /Severity|Status|Alert/i }),
      });
      await expect(alertsTable).toBeVisible({ timeout: 10_000 });
    });

    // -------------------------------------------------------------------------
    // Section 10: Back to Deployment Overview
    // -------------------------------------------------------------------------
    await test.step("[Positive] back button returns to Deployment Overview", async () => {
      await page.getByRole("button", { name: "Go back" }).click();
      await expect(page.getByRole("heading", { name: "Deployment Overview" })).toBeVisible();
    });
  });
});
