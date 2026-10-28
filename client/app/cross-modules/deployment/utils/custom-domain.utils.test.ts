import { describe, expect, it } from "vitest";
import { hasCustomDomain, isCustomDomainOnly } from "./custom-domain.utils";

describe("hasCustomDomain", () => {
  it("is true for a set custom domain", () => {
    expect(hasCustomDomain({ customDeploymentUrl: "app.example.com" })).toBe(true);
  });

  it.each([undefined, null, "", "   ", "N/A"])("is false for %p", (url) => {
    expect(hasCustomDomain({ customDeploymentUrl: url })).toBe(false);
  });

  it("is false with no target", () => {
    expect(hasCustomDomain(undefined)).toBe(false);
  });
});

describe("isCustomDomainOnly", () => {
  it("is true when the flag is on and a custom domain is set", () => {
    expect(
      isCustomDomainOnly({ customDeploymentUrl: "app.example.com", isCustomDomainOnly: true }),
    ).toBe(true);
  });

  it("is false when the flag is off or missing, as on older records", () => {
    expect(isCustomDomainOnly({ customDeploymentUrl: "app.example.com", isCustomDomainOnly: false })).toBe(false);
    expect(isCustomDomainOnly({ customDeploymentUrl: "app.example.com" })).toBe(false);
  });

  it("is false when the flag is on but no custom domain is set, so the default is still deployed", () => {
    expect(isCustomDomainOnly({ customDeploymentUrl: null, isCustomDomainOnly: true })).toBe(false);
  });
});
