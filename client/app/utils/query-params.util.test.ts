import { describe, expect, it, beforeEach } from "vitest";
import { clearQueryString } from "./query-params.util";

describe("clearQueryString", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/page?a=1&b=2&c=3");
  });

  it("clears all query params by default", () => {
    clearQueryString();
    expect(window.location.search).toBe("");
  });

  it("keeps only the params listed in `except`", () => {
    clearQueryString({ except: ["b"] });
    expect(window.location.search).toBe("?b=2");
  });

  it("ignores `except` keys that are not present", () => {
    clearQueryString({ except: ["missing"] });
    expect(window.location.search).toBe("");
  });
});
