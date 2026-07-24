import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userAcknowledgement } from "@blocks-idp/authentication/services/oidc-auth-flow.service";

let context = {
  userName: "jane",
  themeColor: "#124091",
  state: "s",
  nonce: "n",
  scope: "openid",
  redirectUri: "https://cb.example.com/callback",
  clientId: "c1",
  projectKey: "pk",
};

vi.mock("@/layouts/oidc-layout/oidc-layout", () => ({
  useOIDCContext: () => context,
}));
vi.mock("@blocks-idp/authentication/services/oidc-auth-flow.service", () => ({
  userAcknowledgement: vi.fn(),
}));

import { OIDCPermissionScreen } from "./permission";

const wrap = () =>
  render(
    <MemoryRouter initialEntries={["/oidc/permission"]}>
      <OIDCPermissionScreen />
    </MemoryRouter>,
  );

describe("OIDCPermissionScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context = {
      userName: "jane",
      themeColor: "#124091",
      state: "s",
      nonce: "n",
      scope: "openid",
      redirectUri: "https://cb.example.com/callback",
      clientId: "c1",
      projectKey: "pk",
    };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, href: "" },
    });
  });

  it("renders the acknowledgement copy and the user name", () => {
    wrap();
    expect(screen.getByText("jane")).toBeInTheDocument();
    expect(screen.getByText("This portal would like to:")).toBeInTheDocument();
  });

  it("redirects with an access_denied error on Deny", () => {
    wrap();
    fireEvent.click(screen.getByRole("button", { name: /Deny/i }));
    expect(window.location.href).toContain("error=access_denied");
    expect(window.location.href).toContain("state=s");
  });

  it("acknowledges and redirects on Allow", async () => {
    vi.mocked(userAcknowledgement).mockResolvedValue({
      redirectUrl: "https://cb.example.com/done",
    } as never);
    wrap();
    fireEvent.click(screen.getByRole("button", { name: /Allow/i }));
    await waitFor(() => expect(userAcknowledgement).toHaveBeenCalled());
    await waitFor(() =>
      expect(window.location.href).toBe("https://cb.example.com/done"),
    );
  });
});
