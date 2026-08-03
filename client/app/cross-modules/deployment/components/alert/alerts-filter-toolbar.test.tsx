import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { AlertsFilterToolbar } from "./alerts-filter-toolbar";

const repositories = [
  { value: "r1", label: "acme/app" },
  { value: "r2", label: "acme/api" },
];

describe("AlertsFilterToolbar", () => {
  it("renders the search and repository filters", () => {
    renderWithProviders(
      <AlertsFilterToolbar repositories={repositories} />,
      { nuqs: true },
    );
    expect(screen.getAllByText("Repositories").length).toBeGreaterThan(0);
  });

  it("updates the search value", () => {
    renderWithProviders(
      <AlertsFilterToolbar repositories={repositories} />,
      { nuqs: true },
    );
    const search = screen.getAllByPlaceholderText("Search...")[0];
    fireEvent.change(search, { target: { value: "health" } });
    expect(search).toHaveValue("health");
  });
});
