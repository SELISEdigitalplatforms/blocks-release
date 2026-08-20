import fs from "fs"
import path from "path"

export type ReleaseProjectFixture = {
  projectName: string
  itemId: string
  dashboardUrl: string
  deploymentUrl: string
}

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/release-project.json")
export const RELEASE_SESSION_PATH = path.resolve(__dirname, "../fixtures/release-session.json")

export function readReleaseProject(): ReleaseProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as ReleaseProjectFixture
}

export function writeReleaseProject(fixture: ReleaseProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
}

export function clearReleaseProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH)
}

export function clearReleaseSession() {
  if (fs.existsSync(RELEASE_SESSION_PATH)) fs.unlinkSync(RELEASE_SESSION_PATH)
}

export function releaseSessionExists(): boolean {
  return fs.existsSync(RELEASE_SESSION_PATH)
}
