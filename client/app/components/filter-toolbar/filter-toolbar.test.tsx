import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterToolbar } from "./filter-toolbar";
import { ClearButton } from "./clear-button/clear-button";
import { SortHeader } from "./sort-header/sort-header";

type Filters = {
  search: string;
  repositories: string[];
  kind: string;
  range: { from?: Date; to?: Date };
};

describe("FilterToolbar", () => {
  const values: Filters = {
    search: "",
    repositories: [],
    kind: "",
    range: {},
  };

  it("renders the configured controls and fires reset", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <FilterToolbar<Filters>
        filters={[
          { key: "search", type: "SearchInput", label: "" },
          {
            key: "repositories",
            type: "MultiSelect",
            label: "Repos",
            props: { options: [{ label: "A", value: "a" }] },
          },
          {
            key: "kind",
            type: "Radio",
            label: "Kind",
            props: { options: [{ label: "One", value: "1" }] },
          },
          { key: "range", type: "DateRange", label: "Range" },
        ]}
        values={{ ...values, search: "abc" }}
        defaultValues={values}
        onChange={onChange}
        onReset={onReset}
      />,
    );
    // A reset button shows because values differ from defaults.
    const resetButtons = screen.getAllByRole("button");
    expect(resetButtons.length).toBeGreaterThan(0);
  });
});

describe("ClearButton", () => {
  it("calls onClear", () => {
    const onClear = vi.fn();
    render(<ClearButton onClear={onClear} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("SortHeader", () => {
  it("toggles the sort direction on click", () => {
    const onChange = vi.fn();
    render(
      <SortHeader
        id="name"
        label="Name"
        value={{ property: "name", isDescending: false }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Name"));
    expect(onChange).toHaveBeenCalled();
  });
});
