export function ageFromYear(birthYear: number | null, targetYear: number): number | null {
  if (birthYear === null) return null;
  return targetYear - birthYear;
}

export interface CalDate { year: number; month: number; day: number; }

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function addDays(date: CalDate, days: number): CalDate {
  const dt = new Date(Date.UTC(date.year, date.month - 1, date.day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function birthdayOnDate(birthMonth: number, birthDay: number, target: CalDate): boolean {
  if (birthMonth === 2 && birthDay === 29 && !isLeap(target.year)) {
    return target.month === 2 && target.day === 28;
  }
  return birthMonth === target.month && birthDay === target.day;
}

const TZ = "Europe/Paris";

export function parisToday(now: Date): CalDate {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const parts = s.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return { year, month, day };
}

export function parisHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour");
  if (hour === undefined) throw new Error("parisHour: no hour part from Intl");
  return Number(hour.value);
}

export function daysUntilNextBirthday(birthMonth: number, birthDay: number, today: CalDate): number {
  // Returns 0 if it's today (incl. Feb29→Feb28 rule in non-leap years).
  // Otherwise returns days until the next occurrence.
  for (let i = 0; i < 366; i++) {
    const d = addDays(today, i);
    if (birthdayOnDate(birthMonth, birthDay, d)) return i;
  }
  return 366; // unreachable
}
