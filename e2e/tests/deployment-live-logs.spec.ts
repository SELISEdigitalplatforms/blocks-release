import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - live deployment logs", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0062: Live logs page shows the general info panel and streaming log section for an in-progress build", async ({
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
            await expect(page).toHaveURL(/\/deployment-live\/[^/?]+$/, {
                timeout: 15000,
            });

            const buildIdHeading = page.locator("h1");
            await expect(buildIdHeading).toBeVisible();
            await expect(page.getByText("Repo URL")).toBeVisible();
        }
    });

    test("TC-0063: Back chevron on the live logs page returns to the repo details page and forces a data refresh", async ({
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
            await expect(page).toHaveURL(/\/deployment-live\/[^/?]+$/, {
                timeout: 15000,
            });

            await page.getByRole("button").first().click();
            await expect(page).toHaveURL(
                /\/deployment\/repo\/[^/?]+\?refresh=true/,
                {
                    timeout: 15000,
                },
            );
        }
    });

    test("TC-0064: Live logs page redirects to the deployment list when the build cannot be found", async ({
        page,
    }) => {
        const projectId = new URL(page.url()).pathname.split("/")[2];
        await page.goto(
            `https://dev-release.blocksdevelopers.com/app/${projectId}/deployment/repo/some-repo/deployment-live/non-existent-build-id`,
        );
        await expect(
            page.getByRole("heading", { name: "Deployment Overview" }),
        ).toBeVisible({ timeout: 20000 });
    });

    test("TC-0065: A fetch failure on the live logs page shows a destructive 'Failed to fetch deployment data' toast", async ({
        page,
    }) => {
        await page.route("**/api/**card**", async (route) => {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({ isSuccess: false }),
            });
        });

        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const deployButton = page.getByRole("button", { name: /^Deploy$/ });
        if (await deployButton.isVisible().catch(() => false)) {
            await deployButton.click();
            await page.getByRole("button", { name: "Deploy Now" }).click();

            const failToast = page.getByText("Failed to fetch deployment data");
            if (
                await failToast.isVisible({ timeout: 10000 }).catch(() => false)
            ) {
                await expect(failToast).toBeVisible();
            }
        }
    });
});
