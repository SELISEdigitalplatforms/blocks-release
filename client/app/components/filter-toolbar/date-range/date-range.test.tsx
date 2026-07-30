import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { DateRange } from "./date-range";

describe("DateRange", () => {
  it("renders the label and the selected range summary", () => {
    renderWithProviders(
      <DateRange
        label="Created"
        value={{ from: new Date("2024-01-01"), to: new Date("2024-01-05") }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("opens the calendar and applies the current range", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <DateRange
        label="Created"
        value={{ from: new Date("2024-01-01") }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Created/ }));
    const apply = await screen.findByRole("button", { name: /Apply/i });
    fireEvent.click(apply);
    expect(onChange).toHaveBeenCalled();
  });

  it("resets the selected range", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <DateRange
        label="Created"
        value={{ from: new Date("2024-01-01") }}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Created/ }));
    const reset = await screen.findByRole("button", { name: /Reset/i });
    fireEvent.click(reset);
    expect(reset).toBeInTheDocument();
  });
});
