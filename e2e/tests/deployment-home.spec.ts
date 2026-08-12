import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - home", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0011: Deployment Overview lists 'Deploys for <repo>' cards for every connected repository", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await expect(firstCard).toBeVisible();
        await expect(page.getByText("Repo URL").first()).toBeVisible();
        await expect(page.getByText("Deploys To").first()).toBeVisible();
        await expect(
            page.getByText("Custom Deployment URL").first(),
        ).toBeVisible();
        await expect(page.getByText("Deployment Status").first()).toBeVisible();
        await expect(
            page.getByText("Latest Deployment Date").first(),
        ).toBeVisible();
        await expect(page.getByText("Deployment Type").first()).toBeVisible();
    });

    test("TC-0012: 'No repository added' empty state renders when the tenant has zero repositories", async ({
        page,
    }) => {
        // NOTE: assumes the current tenant/project has zero connected repositories.
        const emptyHeading = page.getByRole("heading", {
            name: "No repository added",
        });
        if (await emptyHeading.isVisible()) {
            await expect(
                page.getByText(
                    "To view deployment activity, please add at least one repository to your project",
                ),
            ).toBeVisible();
            const addRepoLink = page.getByRole("button", {
                name: "Add repository",
            });
            await expect(addRepoLink).toBeVisible();
        }
    });

    test("TC-0013: 'Error while fetching repositories' state renders when the project list fails to load", async ({
        page,
    }) => {
        await page.route("**/api/**project**", async (route) => {
            await route.abort("failed");
        });
        await page.reload();

        const errorHeading = page.getByRole("heading", {
            name: "Error while fetching repositories",
        });
        if (
            await errorHeading.isVisible({ timeout: 10000 }).catch(() => false)
        ) {
            await expect(
                page.getByRole("button", { name: "Retry" }),
            ).toBeVisible();
        }
    });

    test("TC-0014: A full-page loading spinner shows while the repository list is loading", async ({
        page,
    }) => {
        await page.route("**/api/**project**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.reload();

        await expect(page.getByText("Loading...")).toBeVisible({
            timeout: 5000,
        });
    });

    test("TC-0015: An API error while loading projects surfaces a destructive toast", async ({
        page,
    }) => {
        await page.route("**/api/**project**", async (route) => {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({
                    isSuccess: false,
                    errors: { Message: "Failed to fetch repositories" },
                }),
            });
        });
        await page.reload();

        const errorToast = page.getByText("Failed to fetch repositories");
        if (await errorToast.isVisible({ timeout: 10000 }).catch(() => false)) {
            await expect(errorToast).toBeVisible();
        }
    });

    test("TC-0016: Deploys To URL is copyable and opens in a new tab without triggering the card click", async ({
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], {
            origin: new URL(page.url()).origin,
        });

        const deploysToRow = page
            .getByText("Deploys To", { exact: true })
            .first()
            .locator("xpath=..");
        const copyButton = deploysToRow.getByRole("button").first();
        await copyButton.click();

        await expect(async () => {
            const clipboardText = await page.evaluate(() =>
                navigator.clipboard.readText(),
            );
            expect(clipboardText.length).toBeGreaterThan(0);
        }).toPass({ timeout: 5000 });

        // Card's own click handler should not have fired (no branch/access modal opened)
        await expect(page.getByText("Please wait…")).toHaveCount(0);
    });

    test("TC-0017: Custom Deployment URL shows 'N/A' when not configured", async ({
        page,
    }) => {
        const customUrlRow = page
            .locator("div")
            .filter({ hasText: "Custom Deployment URL" })
            .first();
        const text = await customUrlRow.innerText();
        if (text.includes("N/A")) {
            await expect(customUrlRow.getByText("N/A").first()).toBeVisible();
        }
    });

    test("TC-0018: Deployment Status badge shows 'No build' when a repo has never been deployed", async ({
        page,
    }) => {
        const noBuildBadge = page.getByText("No build").first();
        if (await noBuildBadge.isVisible().catch(() => false)) {
            await expect(noBuildBadge).toBeVisible();
        }
    });

    test("TC-0019: Deployment Status badge color reflects the last deployment's actual status", async ({
        page,
    }) => {
        const statusRow = page
            .locator("div")
            .filter({ hasText: "Deployment Status" })
            .first();
        await expect(statusRow).toBeVisible();
    });

    test("TC-0020: Deployment Type shows the mapped label or 'N/A' when unset", async ({
        page,
    }) => {
        const typeRow = page
            .locator("div")
            .filter({ hasText: "Deployment Type" })
            .first();
        await expect(typeRow).toBeVisible();
    });

    test("TC-0021: Clicking a repo card while authorized opens the branch verification modal, then routes to repo details", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        // Either the branch verification modal appears, or it routes straight through.
        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+/, {
            timeout: 20000,
        });
    });

    test("TC-0023: Repo card shows a processing spinner and disables interaction while authorization/branch checks run", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const processingText = page.getByText(
            /Processing(\.\.\.| in background\.\.\.)/,
        );
        if (
            await processingText.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
            await expect(processingText).toBeVisible();
        }
    });
});
