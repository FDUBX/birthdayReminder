import { describe, it, expect } from "vitest";
import {
  ageFromYear,
  isLeap,
  addDays,
  birthdayOnDate,
  parisToday,
  parisHour,
} from "../src/dates";

describe("ageFromYear", () => {
  it("returns age when birth year is known", () => {
    expect(ageFromYear(1990, 2026)).toBe(36);
  });
  it("returns null when birth year is null", () => {
    expect(ageFromYear(null, 2026)).toBeNull();
  });
});

describe("isLeap", () => {
  it("2024 is a leap year", () => expect(isLeap(2024)).toBe(true));
  it("2025 is not a leap year", () => expect(isLeap(2025)).toBe(false));
  it("2000 is a leap year (divisible by 400)", () => expect(isLeap(2000)).toBe(true));
  it("1900 is not a leap year (divisible by 100, not 400)", () => expect(isLeap(1900)).toBe(false));
});

describe("addDays", () => {
  it("crosses month boundary", () => {
    expect(addDays({ year: 2026, month: 1, day: 28 }, 5)).toEqual({ year: 2026, month: 2, day: 2 });
  });
  it("crosses year boundary", () => {
    expect(addDays({ year: 2025, month: 12, day: 30 }, 3)).toEqual({ year: 2026, month: 1, day: 2 });
  });
  it("stays within month", () => {
    expect(addDays({ year: 2026, month: 3, day: 10 }, 5)).toEqual({ year: 2026, month: 3, day: 15 });
  });
});

describe("birthdayOnDate", () => {
  it("exact match", () => {
    expect(birthdayOnDate(3, 15, { year: 2026, month: 3, day: 15 })).toBe(true);
  });
  it("no match on wrong day", () => {
    expect(birthdayOnDate(3, 15, { year: 2026, month: 3, day: 16 })).toBe(false);
  });
  it("Feb 29 maps to Feb 28 in non-leap year 2026", () => {
    expect(birthdayOnDate(2, 29, { year: 2026, month: 2, day: 28 })).toBe(true);
  });
  it("Feb 29 does NOT match Feb 29 in non-leap year", () => {
    // 2026 is not leap, so Feb 29 doesn't exist — Feb 28 is the fallback
    expect(birthdayOnDate(2, 29, { year: 2026, month: 2, day: 29 })).toBe(false);
  });
  it("Feb 29 matches Feb 29 in leap year 2024", () => {
    expect(birthdayOnDate(2, 29, { year: 2024, month: 2, day: 29 })).toBe(true);
  });
});

describe("parisToday and parisHour", () => {
  it("UTC 2026-07-01T23:30:00Z → Paris date 2026-07-02, hour 1", () => {
    const now = new Date("2026-07-01T23:30:00Z");
    expect(parisToday(now)).toEqual({ year: 2026, month: 7, day: 2 });
    expect(parisHour(now)).toBe(1);
  });
  it("UTC 2026-01-01T23:30:00Z → Paris date 2026-01-02, hour 0", () => {
    // Europe/Paris in January is UTC+1, so 23:30 UTC = 00:30 Paris next day
    const now = new Date("2026-01-01T23:30:00Z");
    expect(parisToday(now)).toEqual({ year: 2026, month: 1, day: 2 });
    expect(parisHour(now)).toBe(0);
  });
});
