import { describe, expect, it } from "vitest";
import { deepEqual } from "./equal.util";

describe("deepEqual", () => {
  it("returns true for identical primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(deepEqual(1, 2)).toBe(false);
  });

  it("returns false when one side is null", () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it("returns true for deeply equal nested objects", () => {
    const a = { x: 1, y: { z: [1, 2, 3] } };
    const b = { x: 1, y: { z: [1, 2, 3] } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("returns false when a nested value differs", () => {
    const a = { x: 1, y: { z: [1, 2, 3] } };
    const b = { x: 1, y: { z: [1, 2, 4] } };
    expect(deepEqual(a, b)).toBe(false);
  });

  it("returns false when key counts differ", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("returns false when keys differ", () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });
});
