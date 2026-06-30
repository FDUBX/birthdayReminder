import { describe, it, expect } from "vitest";
import {
  ageFromYear,
  isLeap,
  addDays,
  birthdayOnDate,
  parisToday,
  parisHour,
  daysUntilNextBirthday,
  currentAge,
} from "../src/dates";

describe("currentAge", () => {
  const today = { year: 2026, month: 6, day: 30 };
  it("subtracts one when this year's birthday has not happened yet", () => {
    expect(currentAge(1986, 12, 22, today)).toBe(39); // born Dec, today June
  });
  it("does not subtract when this year's birthday already passed", () => {
    expect(currentAge(1987, 4, 15, today)).toBe(39); // born April, today June
  });
  it("counts the full year on the birthday itself", () => {
    expect(currentAge(2000, 6, 30, today)).toBe(26);
  });
  it("returns null when birth year is unknown", () => {
    expect(currentAge(null, 6, 30, today)).toBeNull();
  });
  it("treats a Feb 29 birthday as reached on Feb 28 of a non-leap year", () => {
    expect(currentAge(1992, 2, 29, { year: 2026, month: 2, day: 28 })).toBe(34);
  });
});

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

describe("daysUntilNextBirthday", () => {
  it("birthday in 5 days: today 2026-03-10, birthday 3/15 → 5", () => {
    expect(daysUntilNextBirthday(3, 15, { year: 2026, month: 3, day: 10 })).toBe(5);
  });
  it("birthday today: today 2026-03-15, birthday 3/15 → 0", () => {
    expect(daysUntilNextBirthday(3, 15, { year: 2026, month: 3, day: 15 })).toBe(0);
  });
  it("birthday passed: today 2026-03-20, birthday 3/15 → wraps ~360", () => {
    const days = daysUntilNextBirthday(3, 15, { year: 2026, month: 3, day: 20 });
    expect(days).toBeGreaterThan(300);
    expect(days).toBeLessThanOrEqual(366);
  });
  it("Feb29 birthday, today 2026-02-27 (non-leap) → 1 (celebrated Feb28)", () => {
    expect(daysUntilNextBirthday(2, 29, { year: 2026, month: 2, day: 27 })).toBe(1);
  });
});
