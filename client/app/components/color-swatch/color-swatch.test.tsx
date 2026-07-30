import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatch, validHexaColorReg } from "./color-swatch";

describe("ColorSwatch", () => {
  it("renders the current value uppercased", () => {
    render(<ColorSwatch value="#abcdef" />);
    expect(screen.getByDisplayValue("#ABCDEF")).toBeInTheDocument();
  });

  it("sanitizes text input and calls onChange", () => {
    const onChange = vi.fn();
    render(<ColorSwatch value="#000000" onChange={onChange} />);
    const textInput = screen.getByPlaceholderText("#FFFFFF");
    fireEvent.change(textInput, { target: { value: "#12zzAB" } });
    expect(onChange).toHaveBeenCalledWith("#12AB");
  });

  it("propagates color picker changes and opens the picker on click", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorSwatch value="#ffffff" onChange={onChange} hasError />,
    );
    const colorInput = container.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: "#abcdef" } });
    expect(onChange).toHaveBeenCalledWith("#ABCDEF");
    const swatch = container.querySelector('[title="Pick a color"]');
    fireEvent.click(swatch as Element);
  });

  it("exposes a hex color validator", () => {
    expect(validHexaColorReg.test("#fff")).toBe(true);
    expect(validHexaColorReg.test("nope")).toBe(false);
  });
});
