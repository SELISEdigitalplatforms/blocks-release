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

describe("buildNavigationUrl precedence", () => {
  beforeEach(() => {
    setLocation("/");
  });

  it("keeps query params over same-named params after a hash color", () => {
    setLocation("/current?lang=de#AABBCC&lang=en&theme=dark");
    const result = buildNavigationUrl("/target");
    const params = new URLSearchParams(result.split("?")[1]);
    expect(params.getAll("lang")).toEqual(["de"]);
    expect(params.get("theme")).toBe("dark");
    expect(params.get("brandColor")).toBe("%23AABBCC");
  });

  it("ignores trailing hash text after a color that is not amp-delimited", () => {
    setLocation("/current#AABBCCtheme=dark");
    const result = buildNavigationUrl("/target");
    expect(result).toBe("/target?brandColor=%2523AABBCC");
  });

  it("keeps query params over same-named params in a plain hash", () => {
    setLocation("/current?theme=light#theme=dark&lang=fr");
    const params = new URLSearchParams(buildNavigationUrl("/target").split("?")[1]);
    expect(params.getAll("theme")).toEqual(["light"]);
    expect(params.get("lang")).toBe("fr");
  });

  it("replaces a whitespace-only brandColor with the hash color", () => {
    setLocation("/current?brandColor=%20#112233");
    const params = new URLSearchParams(buildNavigationUrl("/target").split("?")[1]);
    expect(params.get("brandColor")).toBe("%23112233");
  });

  it("recovers a blank brandColor from the raw url when no hash color exists", () => {
    setLocation("/current?brandColor=%20&x=1");
    const params = new URLSearchParams(buildNavigationUrl("/target").split("?")[1]);
    // The raw match decodes back to the same whitespace value, which is kept as-is.
    expect(params.get("brandColor")).toBe(" ");
    expect(params.get("x")).toBe("1");
  });

  it("leaves brandColor absent when the url has none", () => {
    setLocation("/current?x=1");
    expect(buildNavigationUrl("/target")).toBe("/target?x=1");
  });
});

describe("redirectToLogin precedence", () => {
  let hrefSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setLocation("/");
    hrefSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new Proxy(window.location, {
        set(target, prop, val) {
          if (prop === "href") {
            hrefSpy(val);
            return true;
          }
          return Reflect.set(target, prop, val);
        },
      }),
    });
  });

  const target = () => {
    redirectToLogin();
    expect(hrefSpy).toHaveBeenCalledTimes(1);
    const url = hrefSpy.mock.calls[0][0] as string;
    expect(url.startsWith("/oidc/login?")).toBe(true);
    return new URLSearchParams(url.split("?")[1]);
  };

  it("does not override an existing brandColor with the hash color", () => {
    window.history.replaceState(null, "", "/current?brandColor=abc#AABBCC");
    expect(target().get("brandColor")).toBe("abc");
  });

  it("skips hash parts without a value or already present in the query", () => {
    window.history.replaceState(
      null,
      "",
      "/current?returnUrl=/home#AABBCC&flag&returnUrl=/other&lang=en",
    );
    const params = target();
    expect(params.has("flag")).toBe(false);
    expect(params.getAll("returnUrl")).toEqual(["/home"]);
    expect(params.get("lang")).toBe("en");
  });

  it("keeps query params over same-named params in a plain hash", () => {
    window.history.replaceState(null, "", "/current?theme=light#theme=dark&lang=fr");
    const params = target();
    expect(params.getAll("theme")).toEqual(["light"]);
    expect(params.get("lang")).toBe("fr");
  });

  it("encodes a #-prefixed brandColor from the query string", () => {
    window.history.replaceState(null, "", "/current?brandColor=%23112233");
    redirectToLogin();
    expect(hrefSpy).toHaveBeenCalledWith("/oidc/login?brandColor=%2523112233");
  });

  it("navigates with an empty query when there are no params", () => {
    window.history.replaceState(null, "", "/current");
    redirectToLogin();
    expect(hrefSpy).toHaveBeenCalledWith("/oidc/login?");
  });
});
