import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showErrorToast } from "@/hooks/use-toast";
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

  describe("fallback branches", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("toasts the raw error code when the refresh error has no description", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "invalid_grant" }));

      expect(await refreshAccessToken("pk")).toBeNull();
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "invalid_grant" });
      // The failed response is not persisted over the existing storage.
      expect(
        JSON.parse(localStorage.getItem("oidc-auth-storage") as string),
      ).toEqual({ refresh_token: "r1" });
    });

    it("prefers the error description over the error code in the toast", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ error: "invalid_grant", error_description: "Token expired" }),
      );

      await refreshAccessToken("pk");
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Token expired" });
    });

    it("stores the token response but returns null when it has no access token", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ refresh_token: "r2" }));

      expect(await refreshAccessToken("pk")).toBeNull();
      expect(
        JSON.parse(localStorage.getItem("oidc-auth-storage") as string),
      ).toEqual({ refresh_token: "r2" });
    });

    it("sends the refresh token as a form-encoded POST with the project key", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ access_token: "t" }));

      await refreshAccessToken("pk");
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Blocks-Key": "pk",
      });
      expect((init?.body as URLSearchParams).toString()).toBe(
        "grant_type=refresh_token&refresh_token=r1",
      );
    });

    it("omits the Authorization header when stored auth has no access token", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ refresh_token: "r1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ oIDCClientCredential: {} }));

      await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("?ProjectKey=pk&ClientId=c1");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        "X-Blocks-Key": "pk",
      });
    });

    it("sends a bearer token when stored auth has an access token", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ access_token: "a1" }),
      );
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ oIDCClientCredential: {} }));

      await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer a1",
      );
    });

    it("ignores unparseable stored auth and still fetches without a token", async () => {
      localStorage.setItem("oidc-auth-storage", "{not json");
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ oIDCClientCredential: { clientId: "c9" } }),
      );

      const result = await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      expect(result.oIDCClientCredential.clientId).toBe("c9");
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.headers).not.toHaveProperty("Authorization");
    });

    it("does not retry a 401 when the token cannot be refreshed", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 401));

      await expect(
        getOidcCredential({ projectKey: "pk", clientId: "c1" }),
      ).rejects.toThrow("HTTP 401: Error");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(showErrorToast).toHaveBeenCalledWith({
        errors: "Failed to fetch OIDC credential. Please try again.",
      });
    });

    it("retries a 401 with the refreshed bearer token", async () => {
      localStorage.setItem(
        "oidc-auth-storage",
        JSON.stringify({ access_token: "old", refresh_token: "r1" }),
      );
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({}, false, 401))
        .mockResolvedValueOnce(jsonResponse({ access_token: "fresh" }))
        .mockResolvedValueOnce(jsonResponse({ oIDCClientCredential: {} }));

      await getOidcCredential({ projectKey: "pk", clientId: "c1" });
      const [, retryInit] = vi.mocked(fetch).mock.calls[2];
      expect((retryInit?.headers as Record<string, string>).Authorization).toBe(
        "Bearer fresh",
      );
    });

    it("defaults undefined acknowledgement fields to empty strings", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}));

      await userAcknowledgement({
        isAcknowledged: true,
        username: "joe",
        projectKey: "pk",
      } as never);
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(init?.body as string)).toEqual({
        clientId: "",
        state: "",
        nonce: "",
        redirectUri: "",
        scope: "",
        isAcknowledged: true,
        username: "joe",
      });
      expect((init?.headers as Record<string, string>)["X-Blocks-Key"]).toBe("pk");
    });

    it("toasts when acknowledgement fails", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 403));

      await expect(
        userAcknowledgement({
          isAcknowledged: true,
          username: "joe",
          projectKey: "pk",
        } as never),
      ).rejects.toThrow("HTTP 403: Error");
      expect(showErrorToast).toHaveBeenCalledWith({
        errors: "Failed to process permission. Please try again.",
      });
    });

    it("posts the full recover payload", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ isSuccess: true }));

      await accountRecover({ email: "a@b.c", projectKey: "pk" });
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({
        email: "a@b.c",
        projectKey: "pk",
      });
    });
  });
});
