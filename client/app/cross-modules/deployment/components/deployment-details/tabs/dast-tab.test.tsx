import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DASTTab from "./dast-tab";

describe("DASTTab", () => {
  it("renders the metrics overview and vulnerabilities", () => {
    renderWithProviders(<DASTTab />, { nuqs: true });
    expect(screen.getByText("Overview of metrics")).toBeInTheDocument();
    expect(screen.getByText("View in DefectDojo")).toBeInTheDocument();
    expect(screen.getByText("SQL Injection")).toBeInTheDocument();
  });

  it("filters the vulnerabilities via the search field", () => {
    renderWithProviders(<DASTTab />, { nuqs: true });
    const search = screen.getByPlaceholderText("Search vulnerabilities...");
    fireEvent.change(search, { target: { value: "SQL" } });
    expect(search).toHaveValue("SQL");
    expect(screen.getByText("SQL Injection")).toBeInTheDocument();
    expect(screen.queryByText("Hidden File Found")).not.toBeInTheDocument();
  });

  it("navigates the pagination controls", () => {
    renderWithProviders(<DASTTab />, { nuqs: true });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Jump directly to a specific page, then step back.
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});
