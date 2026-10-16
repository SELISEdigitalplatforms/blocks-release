import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSpinner from "./loader-spinner";
import { LogoLoader } from "./logo-loader";

describe("LoadingSpinner", () => {
  it("renders the app-kit logo loader as a status", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});

describe("LogoLoader", () => {
  it("renders the Blocks mark at the requested height with an accessible label", () => {
    const { container } = render(<LogoLoader size={44} label="Loading logs" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading logs");
    expect(container.querySelector("svg")).toHaveAttribute("height", "44");
  });
});
