import { describe, expect, it } from "vitest";
import { parseMongoDBString } from "./string.util";

describe("parseMongoDBString", () => {
  it("unwraps ObjectId(...) helpers", () => {
    expect(parseMongoDBString('ObjectId("abc123")')).toBe('"abc123"');
  });

  it("unwraps ISODate(...) helpers", () => {
    expect(parseMongoDBString('ISODate("2023-01-01")')).toBe('"2023-01-01"');
  });

  it("flattens $date extended-JSON objects", () => {
    expect(parseMongoDBString('{ "$date": "2023-01-01" }')).toBe(
      '"2023-01-01"',
    );
  });

  it("unwraps NumberLong(...) helpers", () => {
    expect(parseMongoDBString("NumberLong(42)")).toBe("42");
  });

  it("leaves plain strings untouched", () => {
    expect(parseMongoDBString("hello world")).toBe("hello world");
  });
});
