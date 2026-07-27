import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeEnv } from "./runtime-env";

type MutableWindow = typeof window & {
  __BLOCKS_ENV__?: Record<string, string>;
};

const setRuntimeEnv = (value: Record<string, string> | undefined) => {
  (window as MutableWindow).__BLOCKS_ENV__ = value;
};

describe("getRuntimeEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setRuntimeEnv({ BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com" });
  });

  it("reads a value from window.__BLOCKS_ENV__", () => {
    setRuntimeEnv({ BLOCKS_API_BASE_URL: "https://api.example.com" });
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL")).toBe("https://api.example.com");
  });

  it("falls back to import.meta.env when the runtime value is a placeholder", () => {
    setRuntimeEnv({ BLOCKS_API_BASE_URL: "__BLOCKS_API_BASE_URL__" });
    vi.stubEnv("BLOCKS_API_BASE_URL", "https://fallback.example.com");
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL")).toBe(
      "https://fallback.example.com",
    );
  });

  it("returns an empty string when neither source has a value", () => {
    setRuntimeEnv({});
    vi.stubEnv("BLOCKS_OS_URL", "");
    expect(getRuntimeEnv("BLOCKS_OS_URL")).toBe("");
  });

  it("ensures a trailing slash when requested", () => {
    setRuntimeEnv({ BLOCKS_APP_URL: "https://app.example.com" });
    expect(
      getRuntimeEnv("BLOCKS_APP_URL", { ensureTrailingSlash: true }),
    ).toBe("https://app.example.com/");
  });

  it("does not double a trailing slash", () => {
    setRuntimeEnv({ BLOCKS_APP_URL: "https://app.example.com/" });
    expect(
      getRuntimeEnv("BLOCKS_APP_URL", { ensureTrailingSlash: true }),
    ).toBe("https://app.example.com/");
  });

  it("does not strip the port on localhost", () => {
    setRuntimeEnv({ BLOCKS_API_BASE_URL: "https://localhost:5000" });
    // In the jsdom test env import.meta.env.DEV is true, so port is preserved.
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL", { stripPort: true })).toBe(
      "https://localhost:5000",
    );
  });
});
