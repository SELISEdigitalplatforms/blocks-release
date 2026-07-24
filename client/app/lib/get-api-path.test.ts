import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiPath, getApiUrl } from "./get-api-path";

type MutableWindow = typeof window & { __BLOCKS_ENV__?: Record<string, string> };

describe("get-api-path", () => {
  afterEach(() => {
    (window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com",
    };
    vi.unstubAllEnvs();
  });

  it("getApiPath always returns /api", () => {
    expect(getApiPath("anything")).toBe("/api");
  });

  it("getApiUrl builds a url from the runtime base url", () => {
    (window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_API_BASE_URL: "https://api.example.com",
    };
    expect(getApiUrl("svc", "users")).toBe("https://api.example.com/api/users");
  });
});
