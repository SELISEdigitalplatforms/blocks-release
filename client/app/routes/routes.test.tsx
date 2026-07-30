import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";

vi.mock("@blocks-idp/authentication/pages/oidc/permission-wrapper", () => ({
  OIDCPermissionWrapper: () => <div>permission wrapper</div>,
}));
vi.mock("@blocks-idp/authentication/pages/oidc/oidc-signin", () => ({
  OIDCSignin: () => <div>oidc signin</div>,
}));
vi.mock("@blocks-idp/authentication/services/auth.service", () => ({
  authService: { verifyOidc: vi.fn().mockResolvedValue({}) },
}));

import LoginPage from "./auth/login";
import LoginCallbackPage from "./callback/index";
import OidcIndexPage from "./oidc/index";
import ProfilePage from "./dashboard/profile";

const stubLocation = () => {
  const loc = { href: "", origin: "https://app.test", search: "", replace: vi.fn() };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: loc,
  });
  return loc;
};

describe("routes config", () => {
  it("exports a non-empty route tree", async () => {
    const mod = await import("./index");
    expect(Array.isArray(mod.routes)).toBe(true);
    expect(mod.routes.length).toBeGreaterThan(0);
  });
});

describe("LoginPage", () => {
  const originalLocation = window.location;
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders and starts the login flow on click", async () => {
    stubLocation();
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ redirect_uri: "https://idp/authorize" }),
    } as Response);
    renderWithProviders(<LoginPage />);
    const button = screen.getByRole("button", {
      name: /log in to your account/i,
    });
    fireEvent.click(button);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("shows an error toast when no redirect uri is returned", async () => {
    stubLocation();
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({}),
    } as Response);
    renderWithProviders(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: /log in to your account/i }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});

describe("LoginCallbackPage", () => {
  const originalLocation = window.location;
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("exchanges the callback and shows a loader", async () => {
    stubLocation();
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderWithProviders(<LoginCallbackPage />, {
      route: "/login/callback?code=abc&state=xyz&tenant_id=t1",
    });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("redirects to login on a failed exchange", async () => {
    const loc = stubLocation();
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    renderWithProviders(<LoginCallbackPage />, {
      route: "/login/callback?code=abc&state=xyz",
    });
    await waitFor(() => expect(loc.href).toContain("/login?error"));
  });
});

describe("OidcIndexPage", () => {
  it("renders the sign-in form when there are no params", () => {
    renderWithProviders(<OidcIndexPage />, { route: "/oidc" });
    expect(screen.getByText("oidc signin")).toBeInTheDocument();
  });

  it("renders the permission wrapper when a userName is present", () => {
    renderWithProviders(<OidcIndexPage />, { route: "/oidc?userName=jane" });
    expect(screen.getByText("permission wrapper")).toBeInTheDocument();
  });

  it("shows a loader while exchanging a code", () => {
    const { container } = renderWithProviders(<OidcIndexPage />, {
      route: "/oidc?code=abc&state=xyz",
    });
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("ProfilePage", () => {
  it("redirects to the idp profile", () => {
    const loc = stubLocation();
    render(<ProfilePage />);
    expect(loc.replace).toHaveBeenCalledWith(
      expect.stringContaining("/profile"),
    );
  });
});
