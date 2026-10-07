import { fireEvent, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
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

  it("shows the empty state when the search matches nothing", () => {
    renderWithProviders(<DASTTab />, { nuqs: true });
    fireEvent.change(screen.getByPlaceholderText("Search vulnerabilities..."), {
      target: { value: "no-such-vulnerability" },
    });
    expect(screen.getByText("No vulnerabilities found.")).toBeInTheDocument();
    expect(screen.queryByText("SQL Injection")).not.toBeInTheDocument();
  });

  it("searches by CWE when the CWE filter is selected in the URL", () => {
    renderWithProviders(
      <NuqsTestingAdapter searchParams="?selected-filter=cwe&cwe=89&name=ignored">
        <DASTTab />
      </NuqsTestingAdapter>,
    );
    const search = screen.getByPlaceholderText("Search vulnerabilities...");
    // The input reflects the CWE term, not the name term.
    expect(search).toHaveValue("89");
    expect(screen.getByText("SQL Injection")).toBeInTheDocument();
    expect(screen.queryByText("Hidden File Found")).not.toBeInTheDocument();

    // Typing updates the CWE term and filters on the CWE column.
    fireEvent.change(search, { target: { value: "855" } });
    expect(search).toHaveValue("855");
    expect(screen.getByText("Cross-Domain Misconfiguration")).toBeInTheDocument();
    expect(screen.queryByText("SQL Injection")).not.toBeInTheDocument();
  });

  it("reflects the current page from the URL in the pagination summary", () => {
    renderWithProviders(
      <NuqsTestingAdapter searchParams="?page=4">
        <DASTTab />
      </NuqsTestingAdapter>,
    );
    expect(screen.getByText(/Showing 41-\s*50 of 193 entries/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });
});
