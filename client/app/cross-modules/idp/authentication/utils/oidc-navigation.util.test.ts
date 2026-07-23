import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  buildNavigationUrl,
  redirectToLogin,
} from "./oidc-navigation.util";

const setLocation = (url: string) => {
  window.history.replaceState(null, "", url);
};

describe("buildNavigationUrl", () => {
  beforeEach(() => {
    setLocation("/");
  });

  it("preserves existing query params", () => {
    setLocation("/current?foo=bar&baz=qux");
    const result = buildNavigationUrl("/target");
    expect(result.startsWith("/target?")).toBe(true);
    expect(result).toContain("foo=bar");
    expect(result).toContain("baz=qux");
  });

  it("derives brandColor from a leading hex color fragment", () => {
    setLocation("/current#AABBCC");
    const result = buildNavigationUrl("/target");
    expect(result).toContain("brandColor=%2523AABBCC");
  });

  it("merges extra key/value pairs from the hash fragment", () => {
    setLocation("/current#AABBCC&lang=en");
    const result = buildNavigationUrl("/target");
    expect(result).toContain("brandColor=%2523AABBCC");
    expect(result).toContain("lang=en");
  });

  it("treats a non-color hash as url-encoded params", () => {
    setLocation("/current#lang=fr&theme=dark");
    const result = buildNavigationUrl("/target");
    expect(result).toContain("lang=fr");
    expect(result).toContain("theme=dark");
  });

  it("encodes a #-prefixed brandColor query param", () => {
    setLocation("/current?brandColor=%23112233");
    const result = buildNavigationUrl("/target");
    // URLSearchParams decodes %23 to '#', the util re-encodes it to %23, and
    // URLSearchParams.toString() then encodes the '%' again -> %2523.
    expect(result).toContain("brandColor=%2523112233");
  });

  it("does not override an existing brandColor with the hash color", () => {
    setLocation("/current?brandColor=existing#AABBCC");
    const result = buildNavigationUrl("/target");
    expect(result).toContain("brandColor=existing");
    expect(result).not.toContain("AABBCC");
  });
});

describe("redirectToLogin", () => {
  let hrefSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setLocation("/");
    // Intercept the navigation assignment (jsdom does not implement it).
    hrefSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new Proxy(window.location, {
        set(target, prop, val) {
          if (prop === "href") {
            hrefSpy(val);
            return true;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (target as any)[prop] = val;
          return true;
        },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates to /oidc/login preserving existing params", () => {
    window.history.replaceState(null, "", "/current?returnUrl=/home");
    redirectToLogin();
    expect(hrefSpy).toHaveBeenCalledTimes(1);
    const target = hrefSpy.mock.calls[0][0] as string;
    expect(target.startsWith("/oidc/login?")).toBe(true);
    expect(target).toContain("returnUrl");
  });

  it("derives brandColor from a leading hex color fragment", () => {
    window.history.replaceState(null, "", "/current#AABBCC&lang=en");
    redirectToLogin();
    const target = hrefSpy.mock.calls[0][0] as string;
    expect(target).toContain("brandColor=%2523AABBCC");
    expect(target).toContain("lang=en");
  });

  it("treats a non-color hash as url-encoded params", () => {
    window.history.replaceState(null, "", "/current#theme=dark");
    redirectToLogin();
    const target = hrefSpy.mock.calls[0][0] as string;
    expect(target).toContain("theme=dark");
  });
});
