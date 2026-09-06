/**
 * Release E2E feature list — edit `enabled` and order here.
 * Run: npm run test:features
 *
 * Env: E2E_FEATURES=overview,deployment  or  E2E_FEATURES=all
 */

/** @type {{ id: string, name: string, enabled: boolean, spec: string }[]} */
export const RELEASE_FEATURES = [
  {
    id: "overview",
    name: "Release – console & project overview",
    enabled: true,
    spec: "tests/01-overview/overview.spec.ts",
  },
  {
    id: "deployment",
    name: "Release – deployment",
    enabled: true,
    spec: "tests/02-deployment/deployment.spec.ts",
  },
];

export function resolveEnabledFeatures() {
  const override = process.env.E2E_FEATURES?.trim();

  if (!override || override === "all") {
    return RELEASE_FEATURES.filter((feature) => feature.enabled);
  }

  const ids = override
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  /** @type {typeof RELEASE_FEATURES} */
  const selected = [];

  for (const id of ids) {
    const feature = RELEASE_FEATURES.find((entry) => entry.id === id);
    if (!feature) {
      throw new Error(
        `Unknown E2E feature "${id}". Valid ids: ${RELEASE_FEATURES.map((f) => f.id).join(", ")}`,
      );
    }
    selected.push(feature);
  }

  return selected;
}
