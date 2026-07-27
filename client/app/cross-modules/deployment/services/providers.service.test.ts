import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  authenticateWithGithub,
  verifyOAuthState,
  authenticateWithGitlab,
  authenticateWithBitbucket,
  authenticateWithAzure,
  authenticateWithAws,
} from "./providers.service";

const GITHUB_CLIENT_ID = "test-client-id";

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(() => GITHUB_CLIENT_ID),
}));

describe("ProvidersService", () => {
  const TEST_STATE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(() => {
    vi.stubGlobal("window", {
      open: vi.fn(),
      tempOAuthStorage: { github_oauth_state: TEST_STATE },
    });
    vi.stubGlobal("crypto", {
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── authenticateWithGithub ────────────────────────────────────────────────

  describe("authenticateWithGithub", () => {
    it("should open github auth url with correct params", () => {
      authenticateWithGithub("extra-state");

      expect(window.open).toHaveBeenCalled();
      const openedUrl = (window.open as unknown as { mock: { calls: string[][] } })
        .mock.calls[0][0];
      const url = new URL(openedUrl);

      expect(url.origin).toBe("https://github.com");
      expect(url.searchParams.get("client_id")).toBe(GITHUB_CLIENT_ID);
      expect(url.searchParams.get("scope")).toContain("repo");
      expect(url.searchParams.get("state")).toBeDefined();
    });
  });

  // ─── verifyOAuthState ──────────────────────────────────────────────────────

  describe("verifyOAuthState", () => {
    it("should return true if states match", () => {
      expect(verifyOAuthState(TEST_STATE)).toBe(true);
      expect(
        (window as unknown as { tempOAuthStorage?: unknown }).tempOAuthStorage,
      ).toBeUndefined(); // Should be deleted after check
    });

    it("should return false if states don't match", () => {
      expect(verifyOAuthState("wrong-state-uuid")).toBe(false);
    });

    it("should return false if tempStorage is missing", () => {
      vi.stubGlobal("window", {});
      expect(verifyOAuthState("any-state-uuid")).toBe(false);
    });
  });

  // ─── other providers ───────────────────────────────────────────────────────

  describe("other providers", () => {
    it("should log auth messages (smoke tests)", () => {
      const consoleSpy = vi.spyOn(console, "error");
      authenticateWithGitlab();
      authenticateWithBitbucket();
      authenticateWithAzure();
      authenticateWithAws();
      expect(consoleSpy).toHaveBeenCalledTimes(4);
    });
  });
});
