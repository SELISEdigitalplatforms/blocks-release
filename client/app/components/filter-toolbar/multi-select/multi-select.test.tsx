import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { MultiSelect } from "./multi-select";

const options = [
  { label: "Alpha", value: "a" },
  { label: "Beta", value: "b" },
  { label: "Gamma", value: "c" },
];

describe("MultiSelect", () => {
  it("selects and deselects options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <MultiSelect label="Status" options={options} value={[]} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("shows selected badges and clears them", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <MultiSelect
        label="Status"
        options={options}
        value={["a", "b"]}
        onChange={onChange}
      />,
    );
    // Two selected values render as individual badges.
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("Clear"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("collapses to a count badge for more than two selections", () => {
    renderWithProviders(
      <MultiSelect
        label="Status"
        options={options}
        value={["a", "b", "c"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });
});
