import { describe, expect, it } from "vitest";
import { getErrorMessage, handleErrorMessages, isErrorWithErrors } from "./error";

describe("getErrorMessage", () => {
  it("returns a default for empty error", () => {
    expect(getErrorMessage({})).toBe("Something went wrong.");
  });

  it("returns a default for a null error", () => {
    expect(getErrorMessage(null as unknown as Record<string, string>)).toBe(
      "Something went wrong.",
    );
  });

  it("prefers a mapped message when the key is present", () => {
    expect(getErrorMessage({ email: "raw" }, { email: "Mapped" })).toEqual([
      "Mapped",
    ]);
  });

  it("collects string values", () => {
    expect(getErrorMessage({ a: "one", b: "two" })).toEqual(["one", "two"]);
  });

  it("joins array values", () => {
    expect(getErrorMessage({ a: ["one", "two"] })).toEqual(["one, two"]);
  });

  it("ignores empty arrays", () => {
    expect(getErrorMessage({ a: [] })).toBe("Something went wrong.");
  });
});

describe("isErrorWithErrors", () => {
  it("returns true for an object with an errors object", () => {
    expect(isErrorWithErrors({ errors: {} })).toBe(true);
  });

  it("returns false for a plain object", () => {
    expect(isErrorWithErrors({})).toBe(false);
  });

  it("returns false for null", () => {
    expect(isErrorWithErrors(null)).toBe(false);
  });
});

describe("handleErrorMessages", () => {
  it("passes strings through", () => {
    expect(handleErrorMessages("boom")).toBe("boom");
  });

  it("delegates object errors to getErrorMessage", () => {
    expect(handleErrorMessages({ a: "one" })).toEqual(["one"]);
  });

  it("applies custom messages for object errors", () => {
    expect(handleErrorMessages({ a: "one" }, { a: "Custom" })).toEqual([
      "Custom",
    ]);
  });

  it("returns a fallback for arrays", () => {
    expect(handleErrorMessages([1, 2])).toBe("An unexpected error occurred.");
  });

  it("returns a fallback for null", () => {
    expect(handleErrorMessages(null)).toBe("An unexpected error occurred.");
  });
});
