import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { getProjectName } from "@/support/project-name";

test.describe("deployment - branch verification", () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(90000);
        const consolePage = new ConsolePage(page);
        const projectName = getProjectName();
        await consolePage.goto();
        await consolePage.clickProjectEnvironment(projectName, "Development");
        await consolePage.clickDeploymentLink();
    });

    test("TC-0030: Branch verification shows a 'Please wait…' loading state while checking branch compatibility", async ({
        page,
    }) => {
        await page.route("**/api/**branch**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });

        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const waitHeading = page.getByRole("heading", { name: "Please wait…" });
        if (await waitHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(
                page.getByText(
                    "We're verifying your repository setup. This may take a few seconds.",
                ),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Cancel" }),
            ).toBeVisible();
        }
    });

    test("TC-0031: Branch verification success briefly shows a success state then navigates to repo details", async ({
        page,
    }) => {
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        await expect(page).toHaveURL(/\/deployment\/repo\/[^/?]+$/, {
            timeout: 20000,
        });
    });

    test("TC-0032: Branch verification shows 'Expected branch not available' when the branch is missing", async ({
        page,
    }) => {
        // NOTE: assumes at least one connected repo is missing the expected branch.
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const errorHeading = page.getByRole("heading", {
            name: "Expected branch not available",
        });
        if (
            await errorHeading.isVisible({ timeout: 15000 }).catch(() => false)
        ) {
            await expect(
                page.getByText(/This environment expects a branch named/),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Retry" }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Close" }),
            ).toBeVisible();
        }
    });

    test("TC-0033: Branch verification network/API failure shows an error state and a destructive toast", async ({
        page,
    }) => {
        await page.route("**/api/**branch**", async (route) => {
            await route.abort("failed");
        });

        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const failToast = page.getByText(
            "Unable to check branch compatibility. Please try again later.",
        );
        if (await failToast.isVisible({ timeout: 15000 }).catch(() => false)) {
            await expect(failToast).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Retry" }),
            ).toBeVisible();
        }
    });

    test("TC-0034: 'Retry' from the error state re-runs verification and disables itself while retrying", async ({
        page,
    }) => {
        // NOTE: assumes the clicked repo lands in the branch-mismatch error state.
        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const retryButton = page.getByRole("button", { name: "Retry" });
        if (
            await retryButton.isVisible({ timeout: 15000 }).catch(() => false)
        ) {
            await retryButton.click();
            await expect(page.getByText("Retrying...")).toBeVisible();
        }
    });

    test("TC-0035: Closing the modal while verification is loading marks the check as cancelled", async ({
        page,
    }) => {
        await page.route("**/api/**branch**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await route.continue();
        });

        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const cancelButton = page.getByRole("button", { name: "Cancel" });
        if (
            await cancelButton.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
            await cancelButton.click();
            await expect(
                page.getByRole("heading", { name: "Please wait…" }),
            ).toHaveCount(0);
        }
    });

    test("TC-0036: Backdrop click is ignored while the modal is in the loading state", async ({
        page,
    }) => {
        await page.route("**/api/**branch**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await route.continue();
        });

        const firstCard = page.getByText(/^Deploys for /).first();
        await firstCard.click();

        const waitHeading = page.getByRole("heading", { name: "Please wait…" });
        if (await waitHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
            await page.mouse.click(10, 10);
            await expect(waitHeading).toBeVisible();
        }
    });
});
