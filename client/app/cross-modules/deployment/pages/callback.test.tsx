import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import RedirectCallbackUrl from "./callback";

describe("RedirectCallbackUrl", () => {
  beforeEach(() => localStorage.clear());

  it("redirects to the stored destination", () => {
    localStorage.setItem("destination", "/app/deployment/configure");
    render(
      <MemoryRouter initialEntries={["/app/deployment/callback?code=abc"]}>
        <Routes>
          <Route path="/app/deployment/callback" element={<RedirectCallbackUrl />} />
          <Route
            path="/app/deployment/configure"
            element={<div>configure page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("configure page")).toBeInTheDocument();
  });

  it("redirects to the default configure url when no destination is stored", () => {
    render(
      <MemoryRouter initialEntries={["/app/deployment/callback"]}>
        <Routes>
          <Route path="/app/deployment/callback" element={<RedirectCallbackUrl />} />
          <Route
            path="/app/deployment/configure"
            element={<div>configure page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("configure page")).toBeInTheDocument();
  });
});
