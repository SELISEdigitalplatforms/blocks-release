import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  formatDate,
  formatFullDate,
  parseDateString,
  compareDates,
  checkValidDate,
} from "./date.util";

describe("date.util", () => {
  // A fixed local date: 5 Mar 2023, 09:07
  const date = new Date(2023, 2, 5, 9, 7);

  describe("formatDate", () => {
    it("formats date with zero-padded parts and time", () => {
      expect(formatDate(date)).toBe("05/03/2023, 09:07");
    });

    it("omits the time when withoutTime is set", () => {
      expect(formatDate(date, true)).toBe("05/03/2023");
    });
  });

  describe("formatFullDate", () => {
    it("formats a human-readable date with month name and time", () => {
      expect(formatFullDate(date)).toBe("Mar 05, 2023 at 09:07");
    });

    it("omits the time when withoutTime is set", () => {
      expect(formatFullDate(date, true)).toBe("Mar 05, 2023");
    });
  });

  describe("parseDateString", () => {
    it("parses an ISO string into a Date", () => {
      const parsed = parseDateString("2023-03-05T00:00:00Z");
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getUTCFullYear()).toBe(2023);
    });
  });

  describe("compareDates", () => {
    it("returns a negative number when the first date is earlier", () => {
      expect(compareDates("2023-01-01", "2023-01-02")).toBeLessThan(0);
    });

    it("returns a positive number when the first date is later", () => {
      expect(compareDates("2023-01-03", "2023-01-02")).toBeGreaterThan(0);
    });

    it("returns zero for equal dates", () => {
      expect(compareDates("2023-01-02", "2023-01-02")).toBe(0);
    });
  });

  describe("checkValidDate", () => {
    it("returns true for a valid modern date", () => {
      expect(checkValidDate("2023-03-05")).toBe(true);
    });

    it("returns false for an invalid date string", () => {
      expect(checkValidDate("not-a-date")).toBe(false);
    });

    it("returns false for dates before 1900-01-01", () => {
      expect(checkValidDate("1800-06-15")).toBe(false);
    });
  });
});


describe("formatClockTime", () => {
  // Built from local parts so the expectation does not depend on the runner's
  // timezone - the function renders in the viewer's zone by design.
  const at = new Date(2026, 7, 4, 16, 27, 17, 552);

  it("keeps millisecond digits for a log-derived time", () => {
    expect(formatClockTime(at, true)).toBe("16:27:17.552");
  });

  it("drops them for a poller-derived time, which has no such precision", () => {
    expect(formatClockTime(at, false)).toBe("16:27:17");
  });

  it("zero-pads every field", () => {
    expect(formatClockTime(new Date(2026, 0, 1, 3, 4, 5, 6), true)).toBe("03:04:05.006");
  });
});
