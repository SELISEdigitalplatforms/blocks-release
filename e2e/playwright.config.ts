import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.e2e") })

const baseURL = process.env.E2E_BASE_URL

if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is not set. Copy e2e/.env.e2e.example to e2e/.env.e2e and set E2E_BASE_URL to your named domain.",
  )
}

const autoStartServer = process.env.E2E_NO_WEBSERVER !== "1"
// Always attach — release-setup writes this file before [release] starts.
// Do not gate on existsSync at config load (file may be missing or empty then).
const releaseSessionPath = "fixtures/release-session.json"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    launchOptions: {
      slowMo: process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : 0,
    },
  },
  ...(autoStartServer
    ? {
        webServer: {
          command: "bash run.sh -b",
          cwd: path.resolve(__dirname, ".."),
          url: baseURL,
          reuseExistingServer: true,
          ignoreHTTPSErrors: true,
          timeout: 600_000,
          stdout: "pipe" as const,
          stderr: "pipe" as const,
          env: {
            FrontendRuntime__BLOCKS_RELEASE_BASE_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    {
      name: "release-setup",
      testMatch: /release\.setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup",
      testMatch: /auth[\\/]login\.spec\.ts/,
      dependencies: ["release-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "release",
      // Match the numbered feature suites (01-overview, 02-deployment). The
      // suite/ folder holds setup/teardown which is anchored by their own
      // project names, so a path-based ignore is not needed here.
      testMatch: /[\\/]tests[\\/](01-overview|02-deployment)[\\/].*\.spec\.ts/,
      // release-setup (project fixture) → setup (fresh session) → release → teardown
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: releaseSessionPath,
      },
    },
    {
      name: "release-teardown",
      testMatch: /release\.teardown\.spec\.ts/,
      dependencies: ["release"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: releaseSessionPath,
      },
    },
  ],
})
