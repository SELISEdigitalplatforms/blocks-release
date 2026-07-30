import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import usePopoverWidth from "./use-popover-width";

describe("usePopoverWidth", () => {
  it("returns a ref and an undefined initial width", () => {
    const { result } = renderHook(() => usePopoverWidth());
    const [ref, width] = result.current;
    expect(ref).toBeDefined();
    expect(width).toBeUndefined();
  });

  it("measures the width once the ref is attached", () => {
    const { result } = renderHook(() => usePopoverWidth());
    const [ref] = result.current;
    const button = document.createElement("button");
    Object.defineProperty(button, "offsetWidth", { value: 240 });
    (ref as { current: HTMLButtonElement | null }).current = button;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current[1]).toBe(240);
  });
});
