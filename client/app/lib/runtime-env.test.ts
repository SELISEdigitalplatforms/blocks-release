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
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setRuntimeEnv({ BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com" });
  });

  it("uses the preview page origin over the runtime secret and build-time value", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://preview-release.example.test:8443" },
      __BLOCKS_ENV__: { BLOCKS_API_BASE_URL: "https://shared-api.example.test" },
    });
    vi.stubEnv("BLOCKS_API_BASE_URL", "https://build-api.example.test");

    expect(getRuntimeEnv("BLOCKS_API_BASE_URL")).toBe(
      "https://preview-release.example.test:8443",
    );
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL", { stripPort: true })).toBe(
      "https://preview-release.example.test:8443",
    );
  });

  it("uses the page origin when the runtime value is a placeholder", () => {
    setRuntimeEnv({ BLOCKS_API_BASE_URL: "__BLOCKS_API_BASE_URL__" });
    vi.stubEnv("BLOCKS_API_BASE_URL", "https://fallback.example.com");
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL")).toBe(window.location.origin);
  });

  it("preserves the configured URL for server-side callers", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("BLOCKS_API_BASE_URL", "https://backend.example.test");
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL")).toBe(
      "https://backend.example.test",
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

  it("keeps the page origin when asked to strip the API port", () => {
    setRuntimeEnv({ BLOCKS_API_BASE_URL: "https://localhost:5000" });
    expect(getRuntimeEnv("BLOCKS_API_BASE_URL", { stripPort: true })).toBe(
      window.location.origin,
    );
  });
});
