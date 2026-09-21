import { test, expect, type Page } from "../../support/test-base";
import {
  openReleaseDeployment,
  connectFirstRepository,
  hasLinkedRepository,
} from "../../support/release-helpers";
import { readReleaseProject } from "../../support/release-project";

/**
 * Env paste mode for the Environment Variables dialog (#199).
 *
 * Covers the new third entry mode (not the M12 tab-load regression in
 * deployment.spec.ts): mode radio, parse/carry across tabs, validation, and
 * a save round-trip when the repo has no secrets yet.
 *
 * When the shared project has no linked repository (GitHub OAuth is unavailable
 * for the e2e account), the suite stubs repos-list / repo-details / RepoSecret
 * on the preview API host so the Release UI under test still exercises Env
 * paste end-to-end against the deployed client bundle.
 *
 * Never clicks Deploy. When secrets already exist on a real repo, validation /
 * mode-switch steps Cancel without Save so pre-existing values are not replaced.
 */

const SAMPLE_ENV = [
  "E2E_APP_URL=",
  "E2E_API_BASE_URL=https://api.example.test",
  "E2E_X_BLOCKS_KEY=",
  "E2E_IDP_BASE_URL =https://iam.example.test",
].join("\n");

const FAKE_REPO_ID = "e2e-env-paste-repo";

const emptyMeta = (repoId: string) => ({
  repoId,
  secretId: null,
  hasSecrets: false,
  name: null,
  description: null,
  status: null,
  createdDate: null,
  createdBy: null,
  lastUpdatedDate: null,
  lastUpdatedBy: null,
  lastRotatedDate: null,
  lastRotatedBy: null,
  rotationCount: 0,
  deletedDate: null,
  deletedBy: null,
});

const activeMeta = (repoId: string) => ({
  ...emptyMeta(repoId),
  secretId: "secret-e2e-1",
  hasSecrets: true,
  name: "env",
  status: "active",
  createdDate: "2026-09-21T00:00:00Z",
  lastUpdatedDate: "2026-09-21T00:00:00Z",
  rotationCount: 1,
});

function okEnvelope<T>(data: T) {
  return {
    isSuccess: true,
    statusCode: 200,
    message: null,
    errors: null,
    data,
  };
}

async function installEnvPasteApiMocks(page: Page) {
  let hasSecrets = false;
  let stored: Record<string, string> = {};

  const fakeRepo = {
    itemId: FAKE_REPO_ID,
    repoName: "e2e/env-paste",
    branch: "main",
    repoUrl: "https://github.com/e2e/env-paste",
    defaultDeploymentUrl: "https://env-paste.example.test",
    customDeploymentUrl: "",
    deploymentType: "auto",
    lastDeploymentDate: null,
    deployedNamespace: null,
    lastDeploymentStatus: null,
    deploySettings: {},
  };

  await page.route("**/build/repos-list**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope([
          {
            sourceRepoId: "src-1",
            sourceReference: null,
            blocksUserId: null,
            projectId: null,
            projectName: null,
            repoName: fakeRepo.repoName,
            repoUrl: fakeRepo.repoUrl,
            defaultDeploymentUrl: fakeRepo.defaultDeploymentUrl,
            customDeploymentUrl: null,
            branch: "main",
            commit: null,
            lastDeploymentDate: null,
            lastDeploymentStatus: null,
            deployedNamespace: null,
            deploySettings: {},
            itemId: FAKE_REPO_ID,
            createdDate: "2026-09-21T00:00:00Z",
            lastUpdatedDate: "2026-09-21T00:00:00Z",
            createdBy: null,
            language: null,
            lastUpdatedBy: null,
            organizationIds: [],
            tags: [],
            deploymentType: "auto",
          },
        ]),
      ),
    });
  });

  await page.route("**/build/repo-details**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope({ repo: fakeRepo, build: [], totalCount: 0 }),
      ),
    });
  });

  await page.route("**/RepoSecret/get**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope(
          hasSecrets ? activeMeta(FAKE_REPO_ID) : emptyMeta(FAKE_REPO_ID),
        ),
      ),
    });
  });

  await page.route("**/RepoSecret/value**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope({
          repoId: FAKE_REPO_ID,
          secretId: "secret-e2e-1",
          secrets: stored,
        }),
      ),
    });
  });

  await page.route("**/RepoSecret/save**", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as {
      secrets?: Record<string, string>;
    };
    stored = { ...(body?.secrets ?? {}) };
    hasSecrets = Object.keys(stored).length > 0;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        okEnvelope({
          repoId: FAKE_REPO_ID,
          secretId: "secret-e2e-1",
          keyCount: Object.keys(stored).length,
          created: true,
        }),
      ),
    });
  });

  await page.route("**/RepoSecret/delete**", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    hasSecrets = false;
    stored = {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(okEnvelope(null)),
    });
  });
}

async function openRepoDetails(
  page: Page,
): Promise<"real" | "mocked" | "none"> {
  await openReleaseDeployment(page);

  if (!(await hasLinkedRepository(page))) {
    await connectFirstRepository(page);
  }

  const repoCard = page
    .getByRole("button")
    .filter({ hasText: "Deploys for" })
    .first();
  if (await repoCard.isVisible().catch(() => false)) {
    await repoCard.click();
    await expect(page).toHaveURL(/\/deployment\/repo\//, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /Repository Details/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    return "real";
  }

  const fixture = readReleaseProject();
  const itemId = fixture?.itemId;
  if (!itemId) return "none";

  await installEnvPasteApiMocks(page);
  const target = new URL(page.url());
  target.pathname = `/app/${itemId}/deployment/repo/${FAKE_REPO_ID}`;
  target.search = "tab=secrets";
  await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /Repository Details/i }).first(),
  ).toBeVisible({ timeout: 30_000 });
  return "mocked";
}

async function openEnvironmentVariablesTab(page: Page) {
  const envVarsTab = page.getByRole("tab", { name: "Environment Variables" });
  await expect(envVarsTab).toBeVisible({ timeout: 10_000 });
  if (!(await page.url()).includes("tab=secrets")) {
    await envVarsTab.click();
  }
  await expect(page).toHaveURL(/[?&]tab=secrets/);

  const skeleton = page
    .getByTestId("repo-secrets-loading")
    .or(page.getByTestId("secrets-tab-loading"));
  await expect(skeleton).toBeHidden({ timeout: 30_000 });
}

async function openSecretsDialog(page: Page) {
  const addVariables = page.getByRole("button", { name: /^Add variables$/ });
  const editButton = page.getByRole("button", { name: /^Edit$/ });

  if (await addVariables.isVisible().catch(() => false)) {
    await addVariables.click();
    const dialog = page.getByRole("dialog", {
      name: /Add environment variables/i,
    });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return { dialog, isEmpty: true as const };
  }

  await expect(editButton).toBeVisible({ timeout: 10_000 });
  await editButton.click();
  const dialog = page.getByRole("dialog", {
    name: /Edit environment variables/i,
  });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return { dialog, isEmpty: false as const };
}

test.describe("Env paste mode (#199)", () => {
  test("Env mode parse, carry, validate, and optional save", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const mode = await openRepoDetails(page);
    test.skip(mode === "none", "No project fixture and no linked repository");

    await openEnvironmentVariablesTab(page);
    const { dialog, isEmpty } = await openSecretsDialog(page);

    const envRadio = dialog.getByRole("radio", { name: "Env" });
    const kvRadio = dialog.getByRole("radio", { name: "Key / value" });
    const jsonRadio = dialog.getByRole("radio", { name: "Paste JSON" });
    const envTextarea = dialog.getByRole("textbox", {
      name: "Environment variables as env",
    });
    const saveButton = dialog.getByRole("button", {
      name: /^Save variables$/,
    });
    const cancelButton = dialog.getByRole("button", { name: /^Cancel$/ });

    await test.step("[Positive] Env radio sits beside Key / value and Paste JSON (H1)", async () => {
      await expect(
        dialog.getByRole("radiogroup", { name: "Entry mode" }),
      ).toBeVisible();
      await expect(kvRadio).toBeVisible();
      await expect(jsonRadio).toBeVisible();
      await expect(envRadio).toBeVisible();
    });

    await test.step("[Positive] Env tab accepts .env paste; Key / value carries keys (H2/H3)", async () => {
      await envRadio.click();
      await expect(envRadio).toHaveAttribute("aria-checked", "true");
      await expect(envTextarea).toBeVisible();

      await envTextarea.fill(SAMPLE_ENV);
      await kvRadio.click();

      await expect(kvRadio).toHaveAttribute("aria-checked", "true");
      await expect(dialog.getByPlaceholder("API_KEY")).toHaveCount(4);
      for (const value of [
        "E2E_APP_URL",
        "E2E_API_BASE_URL",
        "E2E_X_BLOCKS_KEY",
        "E2E_IDP_BASE_URL",
        "https://api.example.test",
        "https://iam.example.test",
      ]) {
        await expect(dialog.locator(`input[value="${value}"]`)).toBeVisible();
      }
    });

    await test.step("[Positive] Env → Paste JSON carries the same map (H3/H4)", async () => {
      await envRadio.click();
      await expect(envTextarea).toBeVisible();
      await jsonRadio.click();
      await expect(jsonRadio).toHaveAttribute("aria-checked", "true");

      const jsonBox = dialog.getByRole("textbox");
      const jsonText = await jsonBox.inputValue();
      expect(jsonText).toContain('"E2E_APP_URL"');
      expect(jsonText).toContain('"E2E_API_BASE_URL"');
      expect(jsonText).toContain("https://api.example.test");
      expect(jsonText).toContain('"E2E_IDP_BASE_URL"');
    });

    await test.step("[Negative] malformed Env line blocks save (C2)", async () => {
      await envRadio.click();
      await envTextarea.fill("E2E_APP_URL=https://a.test\nNOT_A_VARIABLE");
      await saveButton.click();
      await expect(
        dialog.getByText("Line 2: expected KEY=VALUE."),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
    });

    await test.step("[Negative] invalid Env key blocks save (C3)", async () => {
      await envTextarea.fill("1BAD=x");
      await saveButton.click();
      await expect(
        dialog.getByText(
          'Line 1, key "1BAD": Start with a letter or underscore; letters, digits and underscore only.',
        ),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
    });

    await test.step("[Negative] duplicate Env keys block save (C3)", async () => {
      await envTextarea.fill("A=1\nA=2");
      await saveButton.click();
      await expect(
        dialog.getByText('Line 2: key "A" was already set on line 1.'),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
    });

    await test.step("[Negative] empty Env paste blocks save (C1)", async () => {
      await envTextarea.fill("");
      await saveButton.click();
      await expect(
        dialog.getByText("Paste .env-formatted text, e.g. KEY=value."),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
    });

    if (!isEmpty && mode === "real") {
      await test.step("[Positive] Cancel leaves existing secrets untouched", async () => {
        await cancelButton.click();
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      });
      return;
    }

    await test.step("[Positive] valid Env paste saves and closes the dialog (H5)", async () => {
      await envTextarea.fill(SAMPLE_ENV);
      await saveButton.click();
      await expect(
        page.getByText("Environment variables saved successfully"),
      ).toBeVisible({ timeout: 30_000 });
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    });

    await test.step("[Positive] Edit → Env round-trips the saved lines (H4)", async () => {
      const editButton = page.getByRole("button", { name: /^Edit$/ });
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();
      const editDialog = page.getByRole("dialog", {
        name: /Edit environment variables/i,
      });
      await expect(editDialog).toBeVisible({ timeout: 30_000 });
      await editDialog.getByRole("radio", { name: "Env" }).click();
      const roundTrip = editDialog.getByRole("textbox", {
        name: "Environment variables as env",
      });
      const text = await roundTrip.inputValue();
      expect(text).toContain("E2E_APP_URL=");
      expect(text).toContain("E2E_API_BASE_URL=https://api.example.test");
      expect(text).toContain("E2E_IDP_BASE_URL=https://iam.example.test");
      await editDialog.getByRole("button", { name: /^Cancel$/ }).click();
      await expect(editDialog).toBeHidden({ timeout: 5_000 });
    });

    await test.step("[Positive] Delete cleans up secrets created by this test", async () => {
      const deleteButton = page.getByRole("button", { name: /^Delete$/ });
      await expect(deleteButton).toBeVisible({ timeout: 10_000 });
      await deleteButton.click();
      const confirm = page.getByRole("dialog", {
        name: /Delete environment variables/i,
      });
      await expect(confirm).toBeVisible({ timeout: 10_000 });
      await confirm.getByRole("button", { name: /^Delete$/ }).click();
      await expect(
        page.getByText("Environment variables deleted"),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: /^Add variables$/ }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
