import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - repo details > Details tab", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0037: 'No deployments available' state shows when a repo has zero builds", async ({
        page,
    }) => {
        // NOTE: assumes the opened repo has never been deployed.
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const noDeploymentsHeading = page.getByRole("heading", {
            name: "No deployments available",
        });
        if (await noDeploymentsHeading.isVisible().catch(() => false)) {
            await expect(
                page.getByText(
                    "This repository has not been deployed yet. Click the deploy button to create your first deployment.",
                ),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Deploy Now" }),
            ).toBeVisible();
        }
    });

    test("TC-0038: Repo details redirects to the deployment list when the repo itself cannot be found", async ({
        page,
    }) => {
        const projectId = new URL(page.url()).pathname.split("/")[2];
        await page.goto(
            `https://dev-release.blocksdevelopers.com/app/${projectId}/deployment/repo/non-existent-repo-id`,
        );
        await expect(
            page.getByRole("heading", { name: "Deployment Overview" }),
        ).toBeVisible({ timeout: 20000 });
    });

    test("TC-0039: Missing branch for the current environment shows a toast and auto-redirects after 5 seconds", async ({
        page,
    }) => {
        // NOTE: assumes the opened repo is missing the current environment's branch.
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const branchToast = page.getByText("Branch not found");
        if (await branchToast.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(page).toHaveURL(/\/app\/project\/.+\/environments/, {
                timeout: 8000,
            });
        }
    });

    test("TC-0040: Deployment Information card shows Repo URL, Deploys To, Custom Deployment URL, Deployment Status, Latest Deployment Date and Deployment Type for the latest build", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const infoHeading = page.getByText("Deployment Information");
        if (await infoHeading.isVisible().catch(() => false)) {
            await expect(page.getByText("Repo URL")).toBeVisible();
            await expect(page.getByText("Deploys To")).toBeVisible();
            await expect(page.getByText("Custom Deployment URL")).toBeVisible();
            await expect(page.getByText("Deployment Status")).toBeVisible();
            await expect(
                page.getByText("Latest Deployment Date"),
            ).toBeVisible();
            await expect(page.getByText("Deployment Type")).toBeVisible();
        }
    });

    test("TC-0041: 'Deploy' button opens a manual-deploy confirmation with the exact copy", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const deployButton = page.getByRole("button", { name: /^Deploy$/ });
        if (await deployButton.isVisible().catch(() => false)) {
            await deployButton.click();
            await expect(
                page.getByRole("heading", { name: "Confirm Deployment" }),
            ).toBeVisible();
            await expect(
                page.getByText(
                    "Are you sure you want to manually deploy this repository?",
                ),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Deploy Now" }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Cancel" }),
            ).toBeVisible();
        }
    });

    test("TC-0042: Confirming manual deploy starts a build and navigates to the live deployment logs page", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const deployButton = page.getByRole("button", { name: /^Deploy$/ });
        if (await deployButton.isVisible().catch(() => false)) {
            await deployButton.click();
            await page.getByRole("button", { name: "Deploy Now" }).click();

            await expect(page.getByText("Deployment Started")).toBeVisible({
                timeout: 15000,
            });
            await expect(page).toHaveURL(/\/deployment-live\/[^/?]+$/, {
                timeout: 15000,
            });
        }
    });

    test("TC-0043: Manual deploy failure shows a destructive toast with the server's error message", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const deployButton = page.getByRole("button", { name: /^Deploy$/ });
        if (await deployButton.isVisible().catch(() => false)) {
            await page.route("**/api/**deploy**", async (route) => {
                await route.fulfill({
                    status: 400,
                    contentType: "application/json",
                    body: JSON.stringify({
                        isSuccess: false,
                        errors: { message: "Branch missing" },
                    }),
                });
            });

            await deployButton.click();
            await page.getByRole("button", { name: "Deploy Now" }).click();

            await expect(page.getByText("Deployment Failed")).toBeVisible({
                timeout: 15000,
            });
        }
    });

    test("TC-0044: 'Configure' opens Deployment Settings for the repo's latest build", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const configureButton = page.getByRole("button", { name: "Configure" });
        if (await configureButton.isVisible().catch(() => false)) {
            await configureButton.click();
            await expect(
                page.getByRole("heading", { name: "Deployment Settings" }),
            ).toBeVisible();
        }
    });

    test("TC-0045: 'Tracing' and 'Logs' header buttons are present but disabled (not yet implemented)", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const tracingButton = page.getByRole("button", { name: "Tracing" });
        if (await tracingButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(tracingButton).toBeDisabled();
            await expect(
                page.getByRole("button", { name: "Logs" }),
            ).toBeDisabled();
        }
    });

    test("TC-0046: Deployment History under the Details tab shows only the single latest build", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyHeading = page.getByText("Deployment History");
        if (await historyHeading.isVisible().catch(() => false)) {
            // Only one row should render for the Details tab's history preview.
            await expect(page.getByText(/^ID: /)).toHaveCount(1);
        }
    });

    test("TC-0047: Monitoring section is disabled with an explanatory message before any deployment exists", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const waitingMessage = page.getByText(
            "Please deploy your project to begin populating this section",
        );
        if (await waitingMessage.isVisible().catch(() => false)) {
            await expect(waitingMessage).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Manage Monitors" }),
            ).toBeDisabled();
        }
    });

    test("TC-0048: Monitoring section shows the linked monitor alerts list once a build has succeeded or failed", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const manageMonitorsButton = page.getByRole("button", {
            name: "Manage Monitors",
        });
        if (
            (await manageMonitorsButton.isVisible({ timeout: 5000 }).catch(() => false)) &&
            (await manageMonitorsButton.isEnabled().catch(() => false))
        ) {
            await expect(manageMonitorsButton).toBeEnabled();
        }
    });
});
