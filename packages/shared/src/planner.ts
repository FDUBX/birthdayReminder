import type { Birthday, Settings, PlannedNotification } from "./types";
import { parisToday, addDays, birthdayOnDate, ageFromYear } from "./dates";

export function planNotifications(birthdays: Birthday[], settings: Settings, now: Date): PlannedNotification[] {
  const today = parisToday(now);
  const reminderTarget = addDays(today, settings.reminder_days_before);
  const out: PlannedNotification[] = [];
  for (const b of birthdays) {
    if (birthdayOnDate(b.birth_month, b.birth_day, today)) {
      out.push({ birthday: b, kind: "today", age: ageFromYear(b.birth_year, today.year), daysUntil: 0 });
    } else if (settings.reminder_days_before > 0 && birthdayOnDate(b.birth_month, b.birth_day, reminderTarget)) {
      out.push({ birthday: b, kind: "reminder", age: null, daysUntil: settings.reminder_days_before });
    }
  }
  return out;
}
