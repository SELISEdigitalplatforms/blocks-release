import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./search-input";

describe("SearchInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces the change callback", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Find" />);
    fireEvent.change(screen.getByPlaceholderText("Find"), {
      target: { value: "abc" },
    });
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("clears the value immediately", () => {
    const onChange = vi.fn();
    render(<SearchInput value="abc" onChange={onChange} />);
    // The clear button is the only button in the component.
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
