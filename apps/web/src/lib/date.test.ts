import { describe, it, expect } from "vitest";
import { getKathmanduTodayStart, getNepalDate } from "./date";

describe("getNepalDate", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getNepalDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid date string", () => {
    const result = getNepalDate();
    const parsed = new Date(result);
    expect(parsed.toString()).not.toBe("Invalid Date");
  });
});

describe("getKathmanduTodayStart", () => {
  it("returns a Date object", () => {
    const result = getKathmanduTodayStart();
    expect(result).toBeInstanceOf(Date);
  });

  it("returns midnight (00:00:00) in UTC+5:45", () => {
    const result = getKathmanduTodayStart();
    // UTC+5:45 midnight = previous day 18:15 UTC
    const hours = result.getUTCHours();
    expect(hours).toBe(18);
    expect(result.getUTCMinutes()).toBe(15);
    expect(result.getUTCSeconds()).toBe(0);
  });
});
