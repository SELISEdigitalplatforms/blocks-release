import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";
import { authService } from "./auth.service";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("AuthService", () => {
  beforeEach(() => {
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("signinByEmail posts a password grant to the token endpoint", async () => {
    await authService.signinByEmail({ username: "jane", password: "secret" });
    const [url, body, headers, opts] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe(AUTH_ENDPOINTS.TOKEN);
    expect((body as URLSearchParams).get("grant_type")).toBe("password");
    expect((body as URLSearchParams).get("username")).toBe("jane");
    expect((body as URLSearchParams).get("password")).toBe("secret");
    expect(headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(opts).toMatchObject({ skipTokenRotation: true });
  });

  it("verifyOidc posts an authorization_code grant with an absolute url", async () => {
    await authService.verifyOidc({ code: "abc", state: "xyz" });
    const [url, body, , opts] = vi.mocked(http.post).mock.calls[0];
    expect(String(url)).toContain(AUTH_ENDPOINTS.TOKEN);
    expect((body as URLSearchParams).get("grant_type")).toBe(
      "authorization_code",
    );
    expect((body as URLSearchParams).get("code")).toBe("abc");
    expect((body as URLSearchParams).get("state")).toBe("xyz");
    expect(opts).toMatchObject({ absoluteUrl: true });
  });

  it("logout posts to the logout endpoint", async () => {
    await authService.logout();
    expect(http.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.LOGOUT, {});
  });
});
