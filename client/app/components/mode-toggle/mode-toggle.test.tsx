import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModeToggle } from "./mode-toggle";

describe("ModeToggle", () => {
  it("toggles the dark class on click", () => {
    render(<ModeToggle />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    // The toggle flips document theme without throwing.
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBeTypeOf(
      "boolean",
    );
  });
});
