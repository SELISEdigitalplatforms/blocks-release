import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./index";

describe("Logo", () => {
  it("renders a provided src image", () => {
    render(<Logo src="/custom.svg" alt="Custom" />);
    const img = screen.getByAltText("Custom") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/custom.svg");
  });

  it("falls back to the themed logo when no src is given", () => {
    render(<Logo />);
    const img = screen.getByAltText("SELISE Logo") as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/Logo_(Light|Dark)\.svg/);
  });
});
