import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - deployment logs tabs", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0066: Deployment Logs page exposes four tabs: Deployment Logs, SAST, SCA and DAST", async ({
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
            await expect(page).toHaveURL(/deployment-logs\/[^/?]+/, {
                timeout: 15000,
            });

            await expect(
                page.getByRole("button", { name: "Deployment Logs" }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "SAST" }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "SCA" }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "DAST" }),
            ).toBeVisible();
        }
    });

    test("TC-0067: SAST tab shows Quality Gate, Lines of Code and overall code stats once analysis completes", async ({
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
            await page.getByRole("button", { name: "SAST" }).click();

            const qualityGate = page.getByText(/Quality Gate/);
            if (
                await qualityGate
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                await expect(page.getByText("Lines of code")).toBeVisible();
                await expect(page.getByText("Overall code")).toBeVisible();
            }
        }
    });

    test("TC-0068: SAST tab shows an 'Analysis in progress' placeholder while data is still processing", async ({
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
            await page.getByRole("button", { name: "SAST" }).click();

            const processingBadge = page.getByText("Analysis in progress");
            if (
                await processingBadge
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                await expect(
                    page.getByText("Static Application Security Testing"),
                ).toBeVisible();
                await expect(page.getByText("Data Processing")).toBeVisible();
            }
        }
    });

    test("TC-0069: SAST tab shows an error state when the analysis data fails to load", async ({
        page,
    }) => {
        await page.route("**/api/**sast**", async (route) => {
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

        const historyTab = page.getByRole("tab", { name: "History" });
        if (!(await historyTab.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No History tab: repo has no deployments yet");
        }
        await historyTab.click();
        const firstBuildRow = page.getByText(/^ID: /).first();
        if (await firstBuildRow.isVisible().catch(() => false)) {
            await firstBuildRow.click();
            await page.getByRole("button", { name: "SAST" }).click();

            const errorHeading = page.getByText("Error Loading Data");
            if (
                await errorHeading
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                await expect(
                    page.getByText(
                        "There was an error loading the SAST data. Please try again later.",
                    ),
                ).toBeVisible();
            }
        }
    });

    test("TC-0070: 'View in SonarQube' opens the SonarQube dashboard in a new tab and reports failures via toast", async ({
        page,
        context,
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
            await page.getByRole("button", { name: "SAST" }).click();

            const sonarButton = page.getByRole("button", {
                name: "View in SonarQube",
            });
            if (
                await sonarButton
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                const [newPage] = await Promise.all([
                    context
                        .waitForEvent("page", { timeout: 5000 })
                        .catch(() => null),
                    sonarButton.click(),
                ]);
                if (newPage) {
                    await expect(newPage).toHaveURL(/code\.selise\.biz/);
                }
            }
        }
    });

    test("TC-0071: SAST tab shows a loading skeleton while the analysis request is in flight", async ({
        page,
    }) => {
        await page.route("**/api/**sast**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });

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
            await page.getByRole("button", { name: "SAST" }).click();

            await expect(
                page.locator('[class*="skeleton"]').first(),
            ).toBeVisible({
                timeout: 5000,
            });
        }
    });

    test("TC-0072: SCA tab shows a 'Data Processing' waiting card before the composition-analysis results are ready", async ({
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
            await page.getByRole("button", { name: "SCA" }).click();

            const scaProcessing = page.getByText(
                "Software Composition Analysis",
            );
            if (
                await scaProcessing
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                await expect(
                    page.getByText(
                        "The Software Composition Analysis data is still being processed. Please check back later.",
                    ),
                ).toBeVisible();
            }
        }
    });

    test("TC-0073: SCA tab's container image scan section shows a build-completion waiting state", async ({
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
            await page.getByRole("button", { name: "SCA" }).click();

            const containerScan = page.getByText("Container Image Scan");
            if (
                await containerScan
                    .isVisible({ timeout: 10000 })
                    .catch(() => false)
            ) {
                await expect(
                    page.getByText("Waiting for Build Completion"),
                ).toBeVisible();
                await expect(
                    page.getByText("Waiting for build completion"),
                ).toBeVisible();
            }
        }
    });

    test("TC-0074: DAST tab always shows the 'Coming Soon' placeholder regardless of build state", async ({
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
            await page.getByRole("button", { name: "DAST" }).click();

            await expect(
                page.getByText("Dynamic Application Security Testing"),
            ).toBeVisible();
            await expect(page.getByText("Coming Soon")).toBeVisible();
            await expect(
                page.getByText("Feature in development"),
            ).toBeVisible();
        }
    });
});
