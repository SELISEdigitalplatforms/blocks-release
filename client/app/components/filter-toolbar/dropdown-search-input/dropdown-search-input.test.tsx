import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { DropdownSearchInput } from "./dropdown-search-input";

const options = [
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
];

describe("DropdownSearchInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces value changes", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderWithProviders(
      <DropdownSearchInput
        value={{ selected: "name", value: "" }}
        onChange={onChange}
        options={options}
        placeholder="Find"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Find"), {
      target: { value: "jane" },
    });
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "jane" });
  });

  it("clears the value immediately", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DropdownSearchInput
        value={{ selected: "name", value: "jane" }}
        onChange={onChange}
        options={options}
      />,
    );
    const clear = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg")) as HTMLElement;
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "" });
  });

  it("changes the selected filter option", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <DropdownSearchInput
        value={{ selected: "name", value: "" }}
        onChange={onChange}
        options={options}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Email" }));
    expect(onChange).toHaveBeenCalledWith({ selected: "email", value: "" });
  });
});
