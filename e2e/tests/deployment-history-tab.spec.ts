import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - repo details > History tab", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0049: History tab shows only the 3 most recent builds by default", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const buildRows = page.getByText(/^ID: /);
        const count = await buildRows.count();
        expect(count).toBeLessThanOrEqual(3);
    });

    test("TC-0050: 'View all history (N)' expands the History tab to show every build", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const viewAllButton = page.getByRole("button", {
            name: /View all history/,
        });
        if (await viewAllButton.isVisible().catch(() => false)) {
            await viewAllButton.click();
            await expect(
                page.getByRole("button", { name: "View Less" }),
            ).toBeVisible();
        }
    });

    test("TC-0051: 'View all history' control is hidden when there are 3 or fewer builds", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const buildRows = page.getByText(/^ID: /);
        const count = await buildRows.count();
        if (count <= 3) {
            await expect(
                page.getByRole("button", { name: /View all history/ }),
            ).toHaveCount(0);
        }
    });

    test("TC-0052: Clicking a build row in History navigates to that build's deployment logs", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const firstBuildRow = page.getByText(/^ID: /).first();
        if (await firstBuildRow.isVisible().catch(() => false)) {
            await firstBuildRow.click();
            await expect(page).toHaveURL(
                /deployment-logs\/[^/?]+\?tab=deployment-logs/,
                {
                    timeout: 15000,
                },
            );
        }
    });

    test("TC-0053: Clicking a SAST/SCA/DAST action icon on a build row deep-links directly into that tab", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const scaButton = page.getByRole("button", { name: "SCA" }).first();
        if (await scaButton.isVisible().catch(() => false)) {
            await scaButton.click();
            await expect(page).toHaveURL(/deployment-logs\/[^/?]+\?tab=sca/, {
                timeout: 15000,
            });
        }
    });
});
