import { describe, expect, it } from "vitest";
import { ErrorTransformer } from "./error-transform";

describe("ErrorTransformer", () => {
  it("returns a generic error for non-object input", () => {
    expect(ErrorTransformer("boom")).toEqual({
      non_field_error: "Something went wrong",
    });
  });

  it("returns a generic error when there is no detail", () => {
    expect(ErrorTransformer({ errors: {} })).toEqual({
      non_field_error: "Something went wrong",
    });
  });

  it("maps a string detail to non_field_error", () => {
    expect(ErrorTransformer({ errors: { detail: "Invalid" } })).toEqual({
      non_field_error: "Invalid",
    });
  });

  it("maps a validation array to field errors", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [
          { loc: ["body", "user_name"], msg: "field required", type: "value_error" },
        ],
      },
    });
    expect(result).toEqual({ user_name: "User name is required" });
  });

  it("keeps a non-required message verbatim", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [{ loc: ["body", "email"], msg: "invalid email", type: "value_error" }],
      },
    });
    expect(result).toEqual({ email: "invalid email" });
  });

  it("merges multiple messages for the same field into an array", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [
          { loc: ["body", "email"], msg: "too short", type: "value_error" },
          { loc: ["body", "email"], msg: "invalid", type: "value_error" },
        ],
      },
    });
    expect(result).toEqual({ email: ["too short", "invalid"] });
  });

  it("collects three messages for the same field", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [
          { loc: ["body", "email"], msg: "a", type: "value_error" },
          { loc: ["body", "email"], msg: "b", type: "value_error" },
          { loc: ["body", "email"], msg: "c", type: "value_error" },
        ],
      },
    });
    expect(result).toEqual({ email: ["a", "b", "c"] });
  });

  it("handles bare string items in the array", () => {
    const result = ErrorTransformer({
      errors: { detail: ["oops", "again", "third"] as unknown as never },
    });
    expect(result).toEqual({ non_field_error: ["oops", "again", "third"] });
  });

  it("skips invalid entries with a missing loc", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [{ loc: "bad", msg: "x", type: "y" } as unknown as never],
      },
    });
    expect(result).toEqual({});
  });

  it("skips entries whose loc has only structural parts", () => {
    const result = ErrorTransformer({
      errors: {
        detail: [{ loc: ["body"], msg: "x", type: "value_error" }],
      },
    });
    expect(result).toEqual({});
  });
});
