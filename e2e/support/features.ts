/**
 * TypeScript mirror of features.mjs — keep both files in sync when adding features.
 */
export type ReleaseFeature = {
  id: string
  name: string
  enabled: boolean
  spec: string
}

export const RELEASE_FEATURES: ReleaseFeature[] = [
  {
    id: "overview",
    name: "Release – console & project overview",
    enabled: true,
    spec: "tests/release/release-overview.spec.ts",
  },
  {
    id: "deployment",
    name: "Release – deployment",
    enabled: true,
    spec: "tests/release/release-deployment.spec.ts",
  },
]
