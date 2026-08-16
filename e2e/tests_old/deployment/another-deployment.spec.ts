import { test, expect } from "@/support/test-base";
import { ConsolePage } from "@/pages/release/console.page";
import { OSCreateProjectPage } from "@/pages/os/create-project.page";
import { OSProjectPage } from "@/pages/os/project.page";
import { DeploymentPage } from "@/pages/release/deployment.page";
import testData from "@/constants/test-data.constant";

test.describe.skip("Deployment with GitHub repo added after project creation", () => {
  let consolePage: ConsolePage;
  let osCreateProjectPage: OSCreateProjectPage;
  let osProjectPage: OSProjectPage;
  let deploymentPage: DeploymentPage;
  let projectName: string;

  test.beforeAll(() => {
    // Generate a unique project name using timestamp
    projectName = `E2E Test ${Date.now()}`;
  });

  test.beforeEach(async ({ page }) => {
    consolePage = new ConsolePage(page);
    osCreateProjectPage = new OSCreateProjectPage(page);
    osProjectPage = new OSProjectPage(page);
    deploymentPage = new DeploymentPage(page);
  });

  test("should create a project without repo", async ({ page }) => {
    await consolePage.goto();
    await consolePage.clickAddProject();

    // Wait for navigation to OS app's create project page
    const osBaseUrl = process.env.E2E_OS_BASE_URL;
    if (!osBaseUrl) {
      throw new Error("E2E_OS_BASE_URL is not set in .env.e2e");
    }
    await page.waitForURL(`${osBaseUrl}/app/create-project`, {
      timeout: 60000,
    });
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    // Wait for project name textbox to be visible
    await page
      .getByRole("textbox", { name: "Enter your project name" })
      .waitFor({ state: "visible" });

    await osCreateProjectPage.fillProjectName(projectName);
    await osCreateProjectPage.checkConfirmationCheckboxes();
    await osCreateProjectPage.clickContinue();
    await osCreateProjectPage.clickContinue(); // Skip adding repo
    await osCreateProjectPage.checkEnvironment(
      testData.ENVIRONMENTS.DEVELOPMENT,
    );
    await osCreateProjectPage.checkEnvironment(testData.ENVIRONMENTS.TESTING);
    await osCreateProjectPage.clickSubmit();
  });

  test("should add a GitHub repo to the project", async ({ page }) => {
    await osProjectPage.clickRepositoriesLink();
    await osProjectPage.clickAddButton();
    await osProjectPage.selectRepository(
      testData.TEST_REPO_OWNER,
      testData.TEST_REPO_NAME,
    );
    await osProjectPage.clickAdd();
  });

  test("should deploy the project", async ({ page }) => {
    await consolePage.clickSELISEBlocksApps();
    await consolePage.clickReleaseLink();
    await deploymentPage.clickDeploymentLink();
    await deploymentPage.clickDeploysForRepo(testData.TEST_REPO_NAME);
    await deploymentPage.clickDeployNow();
    await deploymentPage.expectSuccessfullyDeployedToast();
  });

  test.afterAll(async ({ browser }) => {
    // Delete the project after all tests
    const context = await browser.newContext({
      storageState: "fixtures/auth.json",
    });
    const page = await context.newPage();
    const consolePage = new ConsolePage(page);
    await consolePage.goto();
    await consolePage.clickProjectSettings(projectName);
    await consolePage.clickEnvironment(testData.ENVIRONMENTS.DEVELOPMENT);
    await consolePage.clickDeleteButton();
    await consolePage.confirmDelete();
    await consolePage.expectSuccessfullyDeletedToast();
    await context.close();
  });
});
