import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const origin = process.env.RELEASE_UI_BASE_URL || "http://127.0.0.1:4000";
const outputDir = process.env.RELEASE_UI_OUTPUT_DIR || path.resolve("test-results/console-ui");
fs.mkdirSync(outputDir, { recursive: true });
const user = {
  sub: "review-user",
  name: "Review User",
  firstName: "Review",
  lastName: "User",
  email: "review@example.test",
  tenant_id: "root",
  service_access: [],
};
const project = {
  itemId: "demo",
  tenantId: "tenant-demo",
  tenantGroupId: "group-demo",
  name: "Release Workspace",
  environment: "dev",
  createdBy: "review-user",
  createdDate: "2026-10-01T09:00:00Z",
  lastUpdatedDate: "2026-10-14T10:00:00Z",
  applications: [
    { domain: "release.example.test", cookieDomain: "example.test", isDomainVerified: true },
  ],
  organizationIds: [],
  tags: [],
  isDisabled: false,
};
const staging = { ...project, itemId: "staging", tenantId: "tenant-staging", environment: "stg" };
const groups = [
  {
    tenantGroupId: "group-demo",
    projects: [project, staging],
    nonSharedProject: [project, staging],
    isShared: false,
  },
];
const repos = Array.from({ length: 7 }, (_, i) => ({
  itemId: `repo-${i}`,
  repoName: `release-api-${i + 1}`,
  repoUrl: "https://github.com/example/release",
  defaultDeploymentUrl: `release-${i + 1}.example.test`,
  customDeploymentUrl: "",
  lastDeploymentDate: "2026-10-14T10:00:00Z",
}));
const env = {
  BLOCKS_X_BLOCKS_KEY: "root",
  BLOCKS_OS_BASE_URL: "/review-api",
  BLOCKS_IAM_BASE_URL: "/review-api",
  BLOCKS_IDP_BASE_URL: "/review-api",
  BLOCKS_LOGIC_BASE_URL: "/review-api",
  BLOCKS_IDENTIFIER_BASE_URL: "/review-api",
  BLOCKS_RELEASE_BASE_URL: origin,
  BLOCKS_RELEASE_SWAGGER_URL: "/review-api/swagger.json",
  BLOCKS_APP_URL: origin,
  BLOCKS_LOGIC_SIGNALR_HUB_URL: "/review-api/hub",
};
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => {
  if (e.message !== "The connection was stopped during negotiation.") errors.push(e.message);
  if (e.message !== "The connection was stopped during negotiation.")
    console.error("PAGE ERROR", e.message);
});
// The existing StrictMode notification teardown may reject a fixture negotiation.
page.on("console", (m) => {
  if (
    m.type() === "error" &&
    !m.text().includes("NotificationHub") &&
    !m.text().includes("stopped during negotiation")
  )
    console.error("CONSOLE", m.text());
});
await page.addInitScript(
  ({ user, project, staging, env }) => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { isAuthenticated: true, user }, version: 0 }),
    );
    localStorage.setItem(
      "project-storage",
      JSON.stringify({ state: { projects: [project, staging] }, version: 0 }),
    );
    window.__BLOCKS_ENV__ = env;
    // Avoid the existing StrictMode theme transition race in this fixture check.
    document.startViewTransition = undefined;
  },
  { user, project, staging, env },
);
let impersonated = false;
await page.routeWebSocket(/.*/, (ws) =>
  ws.onMessage((msg) => {
    if (typeof msg === "string" && msg.includes("protocol")) ws.send("{}\u001e");
  }),
);
await page.route("**/*", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    p = url.pathname.toLowerCase();
  if (p === "/runtime-config.js")
    return route.fulfill({
      contentType: "application/javascript",
      body: `window.__BLOCKS_ENV__=${JSON.stringify(env)};`,
    });
  if (
    ["fetch", "xhr"].includes(req.resourceType()) &&
    !p.includes("/node_modules/") &&
    !p.startsWith("/app/") &&
    !p.startsWith("/@")
  ) {
    let body = { data: [], items: [], totalCount: 0, isSuccess: true };
    if (p.endsWith("/auth/me")) body = user;
    else if (p.includes("/impersonation/status"))
      body = {
        impersonated,
        originalTenantId: "root",
        impersonatedTenantId: impersonated ? "tenant-demo" : null,
      };
    else if (p.endsWith("/impersonate")) {
      impersonated = true;
      body = { cookie_set: true, impersonation_mode: true };
    } else if (p.includes("/impersonation/stop")) {
      impersonated = false;
      body = { cookie_set: true, impersonation_mode: false };
    } else if (p.endsWith("/project/gets")) body = groups;
    else if (p.endsWith("/project/get")) body = { data: project };
    else if (p.includes("getreposlist")) body = { data: repos, isSuccess: true };
    else if (p.endsWith("/iam/me") || p.includes("/iam/users/"))
      body = { ...user, itemId: user.sub, organizations: [] };
    else if (p.includes("swagger"))
      body = {
        openapi: "3.0.0",
        paths: {
          "/api/Deployment/GetReposList": {
            get: { summary: "Get repositories", tags: ["Deployment"] },
          },
        },
      };
    else if (p.includes("/negotiate"))
      body = {
        negotiateVersion: 1,
        connectionId: "review",
        connectionToken: "review",
        availableTransports: [{ transport: "WebSockets", transferFormats: ["Text", "Binary"] }],
      };

    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
try {
  await page.goto(origin + "/app/console");
  await page.getByRole("heading", { name: "Your projects", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('14px "DM Sans"')));
  await page
    .getByRole("searchbox", { name: "Search projects, environments, and commands" })
    .click();
  await page.getByRole("dialog", { name: "Run a command" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("dialog", { name: "Run a command" }).count(), 0);
  await page.keyboard.press("Meta+k");
  await page.getByRole("dialog", { name: "Run a command" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("dialog", { name: "Run a command" }).count(), 0);
  await page.screenshot({ path: path.join(outputDir, "console-actual.png") });
  impersonated = true;
  await page.goto(origin + "/app/demo/dashboard");
  await page.getByRole("heading", { name: "Release Workspace", exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".dashboard-overview-hero")
      .evaluate((el) => getComputedStyle(el).borderRadius),
    "16px",
  );
  await page.getByRole("table", { name: "Domains", exact: true }).waitFor();
  await page.getByRole("table", { name: "Repositories", exact: true }).waitFor();
  await page.getByText("Core APIs", { exact: true }).waitFor();
  await page.getByText("Get repositories", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("navigation", { name: "Breadcrumb", exact: true })
      .locator("[aria-current=page]")
      .innerText(),
    "Overview",
  );
  await page.getByRole("button", { name: "Bootstrap", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ has: page.getByText("Bootstrap with an AI agent", { exact: true }) })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("dialog", { name: "Run a command" }).count(), 0);
  await page
    .getByRole("navigation", { name: "Repositories pagination" })
    .getByRole("button", { name: "Go to next page" })
    .click();
  await page.getByText("release-api-6", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(outputDir, "overview-actual.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await page
    .getByRole("dialog", { name: "Sidebar", exact: true })
    .getByRole("button", { name: "Open command menu" })
    .click();
  await page.getByRole("dialog", { name: "Run a command" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("dialog", { name: "Run a command" }).count(), 0);
  await page.screenshot({
    path: path.join(outputDir, "overview-mobile-actual.png"),
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(outputDir, "overview-dark-actual.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real ConsolePage search click, Cmd+K, real overview, breadcrumbs, Bootstrap, Domains, Repositories pagination, Core APIs, mobile layout/palette, dark theme",
  );
} catch (e) {
  await page.screenshot({ path: path.join(outputDir, "actual-failure.png") });
  console.error("BODY", await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
