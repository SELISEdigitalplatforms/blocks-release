import { test, expect } from "@playwright/test";

test("test", async ({ page }) => {
  await page.goto("https://release.seliseblocks.com/login");
  await page.getByRole("button", { name: "Log in to your account" }).click();
  await page.getByRole("textbox", { name: "Work Email" }).click();
  await page.getByRole("textbox", { name: "Work Email" }).fill("");
  await page.getByRole("textbox", { name: "Work Email" }).click({
    modifiers: ["ControlOrMeta"],
  });
  await page
    .getByRole("textbox", { name: "Work Email" })
    .fill("testing-release-prod@yopmail.com");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill("2wsxXSW@11");
  await page.getByRole("button", { name: "Login" }).click();
  await page.goto("https://release.seliseblocks.com/app/console");
  await page.getByText("Add Project").click();
  await page.goto("https://os.seliseblocks.com/app/create-project");
  await page.getByRole("textbox", { name: "Enter your project name" }).click();
  await page
    .getByRole("textbox", { name: "Enter your project name" })
    .fill("E2E Test 1");
  await page
    .getByRole("checkbox", { name: "I confirm that I will use" })
    .click();
  await page
    .getByRole("checkbox", { name: "I accept the Terms of services" })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Add repository" }).click();
  const page1Promise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "GitHub icon Continue with" }).click();
  const page1 = await page1Promise;
  await page1
    .getByRole("textbox", { name: "Username or email address" })
    .fill("zaber.ahmed@selisegroup.com");
  await page1
    .getByRole("textbox", { name: "Username or email address" })
    .press("Tab");
  await page1.getByRole("main").click();
  await page1.getByRole("textbox", { name: "Password" }).click();
  await page1
    .getByRole("textbox", { name: "Password" })
    .fill("1234mygitmypass");
  await page1.getByRole("button", { name: "Sign in", exact: true }).click();
  await page1.goto(
    "https://github.com/login/oauth/authorize?client_id=Ov23liLOJT9InkHNICxc&scope=repo+user%3Aemail+read%3Auser+read%3Arepo_hook&state=be98803d1797766712b1f7e0c773dbe18675791e103e46c6ce1636bf707e2ee7",
  );
  await page1.getByRole("button", { name: "Authorize" }).click();
  await page.getByText("Select a repository").click();
  await page.getByRole("textbox", { name: "Search repositories..." }).click();
  await page.getByText("Select a repository").click();
  await page
    .getByRole("textbox", { name: "Search repositories..." })
    .fill("demo");
  await page.getByRole("textbox", { name: "Search repositories..." }).click();
  await page.getByText("Select a repository").click();
  await page
    .getByRole("textbox", { name: "Search repositories..." })
    .fill("deployment");
  await page.getByText("zaber-ahmed-selise/").click();
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: "Development dev" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^Development$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "SELISE Blocks apps" }).click();
  await page.getByRole("link", { name: "Release Release" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^OverviewDeployment$/ })
    .click();
  await page.getByRole("link", { name: "Deployment" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^Deploys for deployment_test$/ })
    .click();
  await page.getByRole("button", { name: "Deploy Now" }).click();
  await page.getByRole("button", { name: "Deploy Now" }).click();
  await page.getByRole("listitem").click();
  await page.getByText("Deployment Started").click();
  await page.getByText("Your deployment has been").click();
  await page.getByText("Deployment logsClone").click();
  await page.getByText("Build", { exact: true }).click();
  await page.locator(".lucide.lucide-chevron-right").click();
  await page.getByText("Deploy", { exact: true }).click();
  await page.getByRole("listitem").click();
  await page.getByRole("listitem").getByText("Deployment Status").click();
  await page.getByText("Successfully deployed").click();
  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByRole("link", { name: "Deployment" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^Deploys for deployment_test$/ })
    .click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.locator(".lucide.lucide-chevron-right").click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Back to console" }).click();
});
