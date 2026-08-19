import { test } from "@playwright/test"
import { deleteCreatedProject } from "../support/create-and-delete-project"
import { clearReleaseProject, readReleaseProject } from "../support/release-project"

test.describe("release teardown", () => {
  test("delete shared release project", async ({ page }) => {
    const fixture = readReleaseProject()
    if (!fixture?.projectName) return

    await deleteCreatedProject(page, fixture.projectName).catch(() => {})
    clearReleaseProject()
  })
})
