import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/layouts/oidc-layout/oidc-layout", () => ({
  useOIDCContext: () => ({
    logoUrl: "",
    themeColor: "#124091",
    projectKey: "pk",
    userName: "jane",
    clientId: "c1",
    redirectUri: "http://cb",
    state: "s",
    scope: "openid",
    nonce: "n",
    isLoading: false,
  }),
}));
vi.mock("@blocks-idp/authentication/services/oidc-auth-flow.service", () => ({
  userAcknowledgement: vi.fn().mockResolvedValue({ redirectUrl: "" }),
}));

import { OIDCSignin } from "./oidc-signin";
import { OIDCPermissionScreen } from "./permission";
import { OIDCPermissionWrapper } from "./permission-wrapper";

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter initialEntries={["/oidc"]}>{ui}</MemoryRouter>);

describe("OIDC pages", () => {
  it("renders the sign-in card and form", () => {
    wrap(<OIDCSignin />);
    expect(screen.getByText("Blocks Cloud")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("renders the permission screen with allow/deny actions", () => {
    wrap(<OIDCPermissionScreen />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("renders the permission wrapper", () => {
    wrap(<OIDCPermissionWrapper />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
