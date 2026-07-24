import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { AlertsList, formatSeconds } from "./alerts-list";

describe("formatSeconds", () => {
  it("formats seconds", () => {
    expect(formatSeconds(45)).toBe("45s");
  });
  it("formats minutes", () => {
    expect(formatSeconds(120)).toBe("2min");
  });
  it("formats hours", () => {
    expect(formatSeconds(7200)).toContain("h");
  });
});

describe("AlertsList", () => {
  it("renders the loading skeleton", () => {
    const { container } = renderWithProviders(
      <AlertsList data={[]} isLoading={true} />,
      { nuqs: true },
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders an empty table", () => {
    renderWithProviders(<AlertsList data={[]} isLoading={false} />, {
      nuqs: true,
    });
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
