import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const setAuthenticated = vi.fn();

vi.mock("@/layouts/oidc-layout/oidc-layout", () => ({
  useOIDCContext: () => ({
    themeColor: "#124091",
    projectKey: "pk",
    clientId: "c1",
    redirectUri: "http://cb",
    state: "s",
    scope: "openid",
    nonce: "n",
  }),
}));
vi.mock("@/store/auth.store", () => ({
  useAuthStore: () => ({ setAuthenticated }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

import { OidcSigninForm } from "./oidc-signin-form";

const wrap = () =>
  render(
    <MemoryRouter initialEntries={["/oidc/login"]}>
      <OidcSigninForm />
    </MemoryRouter>,
  );

const fillAndSubmit = () => {
  fireEvent.change(screen.getByPlaceholderText("Enter your email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
    target: { value: "Password123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
};

describe("OidcSigninForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in and navigates to the permission screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ access_token: "tok" }),
      }),
    );
    wrap();
    fillAndSubmit();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("/oidc/permission"),
      ),
    );
    expect(setAuthenticated).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("routes to the MFA check when MFA is required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ enable_mfa: true, mfaId: "m1", mfaType: "totp" }),
      }),
    );
    wrap();
    fillAndSubmit();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("mfa-check"),
      ),
    );
    vi.unstubAllGlobals();
  });

  it("navigates to the error screen when sign-in fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () =>
          JSON.stringify({ error: "invalid_grant", error_description: "bad" }),
      }),
    );
    wrap();
    fillAndSubmit();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("/oidc/error"),
      ),
    );
    vi.unstubAllGlobals();
  });
});
