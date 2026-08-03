import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountRecover,
  getOidcCredential,
  refreshAccessToken,
  userAcknowledgement,
} from "./oidc-auth-flow.service";

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
}));

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
  }) as Response;

describe("oidc-auth-flow.service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("refreshAccessToken", () => {
    it("returns null when there is no storage", async () => {
      expect(await refreshAccessToken("pk")).toBeNull();
    });

    it("returns null when there is no refresh token", async () => {
      localStorage.setItem("oidc-auth-storage", JSON.stringify({}));
      expect(await refreshAccessToken("pk")).toBeNull();
    });

    it("stores and returns the new access token on success", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ access_token: "new-token" }),
      );
      expect(await refreshAccessToken("pk")).toBe("new-token");
      expect(
        JSON.parse(localStorage.getItem("oidc-auth-storage") as string)
          .access_token,
      ).toBe("new-token");
    });

    it("returns null when the token response contains an error", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ error: "invalid_grant", error_description: "bad" }),
      );
      expect(await refreshAccessToken("pk")).toBeNull();
    });

    it("navigates back after a network failure", async () => {
      vi.useFakeTimers();
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 500));
      const goSpy = vi.spyOn(window.history, "go").mockImplementation(() => {});
      const result = await refreshAccessToken("pk");
      expect(result).toBeNull();
      vi.advanceTimersByTime(2000);
      expect(goSpy).toHaveBeenCalledWith(-2);
      vi.useRealTimers();
    });
  });

  describe("getOidcCredential", () => {
    it("returns the credential on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ oIDCClientCredential: { clientId: "c1" } }),
      );
      const result = await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      expect(result.oIDCClientCredential.clientId).toBe("c1");
    });

    it("retries with a refreshed token after a 401", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ access_token: "old", refresh_token: "r1" }),
      );
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({}, false, 401))
        .mockResolvedValueOnce(jsonResponse({ access_token: "fresh" }))
        .mockResolvedValueOnce(jsonResponse({ oIDCClientCredential: {} }));
      const result = await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      expect(result.oIDCClientCredential).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("throws when the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 500));
      await expect(
        getOidcCredential({ projectKey: "pk", clientId: "c1" }),
      ).rejects.toThrow();
    });
  });

  describe("userAcknowledgement", () => {
    const payload = {
      clientId: "c1",
      state: "s",
      nonce: "n",
      scope: "openid",
      redirectUri: "http://cb",
      isAcknowledged: true,
      username: "jane",
      projectKey: "pk",
    };

    it("returns the redirect url on success", async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ redirectUrl: "http://done" }),
      );
      const result = await userAcknowledgement(payload);
      expect(result.redirectUrl).toBe("http://done");
    });

    it("throws when the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 400));
      await expect(userAcknowledgement(payload)).rejects.toThrow();
    });
  });

  describe("accountRecover", () => {
    it("returns the recovery result on success", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ isSuccess: true }));
      const result = await accountRecover({ email: "a@b.c", projectKey: "pk" });
      expect(result.isSuccess).toBe(true);
    });

    it("throws when the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 500));
      await expect(
        accountRecover({ email: "a@b.c", projectKey: "pk" }),
      ).rejects.toThrow();
    });
  });
});
