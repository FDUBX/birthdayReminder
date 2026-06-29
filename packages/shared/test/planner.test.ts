import { describe, it, expect } from "vitest";
import { planNotifications } from "../src/planner";
import type { Birthday, Settings } from "../src/types";

const settings: Settings = {
  reminder_days_before: 7,
  notify_hour: 8,
  timezone: "Europe/Paris",
};

// now = 2026-03-15T07:00:00Z → Paris time 2026-03-15 08:00 (UTC+1)
const now = new Date("2026-03-15T07:00:00Z");

const birthdayToday: Birthday = {
  id: 1,
  name: "Alice",
  birth_month: 3,
  birth_day: 15,
  birth_year: 1990,
};

// 7 days from 2026-03-15 = 2026-03-22
const birthdayReminder: Birthday = {
  id: 2,
  name: "Bob",
  birth_month: 3,
  birth_day: 22,
  birth_year: null,
};

const birthdayNoMatch: Birthday = {
  id: 3,
  name: "Carol",
  birth_month: 6,
  birth_day: 10,
  birth_year: 2000,
};

describe("planNotifications", () => {
  it("birthday today with year → kind 'today', age 36, daysUntil 0", () => {
    const result = planNotifications([birthdayToday], settings, now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      birthday: birthdayToday,
      kind: "today",
      age: 36,
      daysUntil: 0,
    });
  });

  it("birthday 7 days away (no year) → kind 'reminder', age null, daysUntil 7", () => {
    const result = planNotifications([birthdayReminder], settings, now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      birthday: birthdayReminder,
      kind: "reminder",
      age: null,
      daysUntil: 7,
    });
  });

  it("both together emit [today, reminder] in order", () => {
    const result = planNotifications([birthdayToday, birthdayReminder], settings, now);
    expect(result).toHaveLength(2);
    expect(result[0]!.kind).toBe("today");
    expect(result[1]!.kind).toBe("reminder");
  });

  it("nothing matches → empty array", () => {
    const result = planNotifications([birthdayNoMatch], settings, now);
    expect(result).toHaveLength(0);
  });
});
