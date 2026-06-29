export interface Birthday {
  id: number;
  name: string;
  birth_month: number; // 1-12
  birth_day: number;   // 1-31
  birth_year: number | null;
}

export interface Settings {
  reminder_days_before: number;
  notify_hour: number; // 0-23, local Europe/Paris
  timezone: string;    // "Europe/Paris"
}

export type NotificationKind = "today" | "reminder";

export interface PlannedNotification {
  birthday: Birthday;
  kind: NotificationKind;
  age: number | null;
  daysUntil: number;
}

export interface PushSubscriptionRecord {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}
