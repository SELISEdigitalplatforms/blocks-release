import { describe, expect, it } from "vitest";
import {
  branches,
  buildSteps,
  DEPLOYMENT_OPTIONS,
  deployments,
  deploySteps,
  FRAMEWORK_OPTIONS,
  providers,
  PROVIDER_OPTIONS,
  REGION_OPTIONS,
  repositories,
  SPECIFICATION_OPTIONS,
} from "./git-dummy";

describe("git-dummy fixtures", () => {
  it("exposes the option collections", () => {
    expect(repositories.length).toBeGreaterThan(0);
    expect(branches[0].value).toBe("main");
    expect(providers.find((p) => p.id === "github")?.active).toBe(true);
    expect(FRAMEWORK_OPTIONS.some((o) => o.value === "react")).toBe(true);
    expect(PROVIDER_OPTIONS.length).toBeGreaterThan(0);
    expect(REGION_OPTIONS.length).toBeGreaterThan(0);
    expect(DEPLOYMENT_OPTIONS.length).toBe(2);
    expect(SPECIFICATION_OPTIONS.length).toBeGreaterThan(0);
  });

  it("exposes step and deployment fixtures", () => {
    expect(Array.isArray(buildSteps)).toBe(true);
    expect(Array.isArray(deploySteps)).toBe(true);
    expect(deployments[0].id).toBe("1");
  });
});
