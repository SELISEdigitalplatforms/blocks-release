import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { OidcLayout } from "./oidc-layout";

describe("OidcLayout", () => {
  it("resolves the loading state and renders the child outlet", async () => {
    render(
      <MemoryRouter initialEntries={["/oidc?x-blocks-key=pk"]}>
        <Routes>
          <Route path="/oidc" element={<OidcLayout />}>
            <Route index element={<div>child content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(
      () => expect(screen.getByText("child content")).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByAltText("OIDC Logo")).toBeInTheDocument();
  });
});
