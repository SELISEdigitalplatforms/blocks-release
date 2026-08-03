import { describe, expect, it } from "vitest";
import { formatSize } from "./size.util";

describe("formatSize", () => {
  it("keeps small byte values in bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("promotes 1024 bytes to KB", () => {
    expect(formatSize(1024)).toBe("1 KB");
  });

  it("promotes through multiple units", () => {
    expect(formatSize(1024 ** 3)).toBe("1 GB");
  });

  it("respects the input unit", () => {
    expect(formatSize(1, "MB")).toBe("1 MB");
    expect(formatSize(1024, "KB")).toBe("1 MB");
  });

  it("honours the decimals argument", () => {
    expect(formatSize(1536, "B", 1)).toBe("1.5 KB");
    expect(formatSize(1536, "B", 0)).toBe("2 KB");
  });

  it("caps at TB, the largest unit", () => {
    expect(formatSize(5, "TB")).toBe("5 TB");
  });
});
