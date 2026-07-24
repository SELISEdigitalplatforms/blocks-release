import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/layouts/oidc-layout/oidc-layout", () => ({
  useOIDCContext: () => ({ themeColor: "#124091" }),
}));

import { signinByEmail } from "./oidc-signin-form";

const textResponse = (body: string, ok = true, status = 200) =>
  ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    text: () => Promise.resolve(body),
  }) as Response;

const payload = {
  username: "jane",
  password: "secret",
  projectKey: "pk",
  clientId: "c1",
  redirectUri: "http://cb",
  scope: "openid",
  state: "s",
};

describe("signinByEmail", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed token response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      textResponse(JSON.stringify({ access_token: "tok" })),
    );
    const res = await signinByEmail(payload);
    expect(res.access_token).toBe("tok");
  });

  it("returns a synthetic token for an empty successful body", async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse(""));
    const res = await signinByEmail(payload);
    expect(res.access_token).toBe("authenticated");
  });

  it("throws the parsed error object when the response fails with json", async () => {
    vi.mocked(fetch).mockResolvedValue(
      textResponse(JSON.stringify({ error: "invalid_grant" }), false, 400),
    );
    await expect(signinByEmail(payload)).rejects.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("throws a generic error when the failure body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse("nope", false, 500));
    await expect(signinByEmail(payload)).rejects.toThrow(/HTTP 500/);
  });
});
