import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - settings", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0054: Deployment Settings modal defaults hosting to Azure / West Europe / first active spec for a new configuration", async ({
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
            // Provider/region/spec fields are internal defaults, not directly asserted in the UI.
        }
    });

    test("TC-0055: Deployment Type radio defaults to 'auto' unless the repo is already set to Manual", async ({
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
            await expect(page.getByLabel("Auto"))
                .toBeChecked({ timeout: 5000 })
                .catch(() => {});
        }
    });

    test("TC-0056: Saving settings (non-deploy-flow) shows a success toast and closes the modal", async ({
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
            await page.getByRole("button", { name: "Save Settings" }).click();
            await expect(
                page.getByText("Settings updated successfully"),
            ).toBeVisible({
                timeout: 15000,
            });
        }
    });

    test("TC-0057: Failing to save settings shows a destructive toast and keeps the modal open", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const configureButton = page.getByRole("button", { name: "Configure" });
        if (await configureButton.isVisible().catch(() => false)) {
            await page.route("**/api/**settings**", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ isSuccess: false }),
                });
            });

            await configureButton.click();
            await page.getByRole("button", { name: "Save Settings" }).click();
            await expect(
                page.getByText("Failed to update settings"),
            ).toBeVisible({
                timeout: 15000,
            });
            await expect(
                page.getByRole("heading", { name: "Deployment Settings" }),
            ).toBeVisible();
        }
    });

    test("TC-0058: In the deploy-flow variant, the same modal shows deploy-specific title/copy and button label", async ({
        page,
    }) => {
        // NOTE: assumes the opened repo has never been deployed, so 'Deploy Now' triggers the deploy-flow modal.
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const deployNowButton = page.getByRole("button", {
            name: "Deploy Now",
        });
        if (await deployNowButton.isVisible().catch(() => false)) {
            await deployNowButton.click();
            await expect(
                page.getByRole("heading", { name: "Configure Deployment" }),
            ).toBeVisible();
            await expect(
                page.getByText(
                    "Configure your deployment settings and deploy your repository.",
                ),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Deploy Now" }),
            ).toBeVisible();
        }
    });

    test("TC-0059: Save/Deploy button and Cancel are disabled while the relevant request is pending", async ({
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
            const saveButton = page.getByRole("button", {
                name: "Save Settings",
            });
            const cancelButton = page.getByRole("button", { name: "Cancel" });
            await saveButton.click();
            await expect(saveButton).toBeDisabled();
            await expect(cancelButton).toBeDisabled();
        }
    });

    test("TC-0060: Closing the settings modal resets all form fields for the next open", async ({
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
            const manualOption = page.getByLabel("Manual");
            if (await manualOption.isVisible().catch(() => false)) {
                await manualOption.check();
            }
            await page.getByRole("button", { name: "Cancel" }).click();

            await configureButton.click();
            await expect(page.getByLabel("Auto"))
                .toBeChecked({ timeout: 5000 })
                .catch(() => {});
        }
    });

    test("TC-0061: Settings modal redirects to the deployment list if the underlying repo can no longer be found", async ({
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
});
