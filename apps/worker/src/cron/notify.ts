import { planNotifications, parisHour } from "@bday/shared";
import type { Birthday, Settings, PlannedNotification } from "@bday/shared";
import type { Env } from "../env";
import { sendPush, type PushTarget } from "../push/send";

function messageFor(n: PlannedNotification): { title: string; body: string } {
  if (n.kind === "today") {
    const age = n.age !== null ? ` (${n.age} ans)` : "";
    return { title: "🎂 Anniversaire aujourd'hui", body: `C'est l'anniversaire de ${n.birthday.name}${age} !` };
  }
  return { title: "Rappel anniversaire", body: `Dans ${n.daysUntil} jours : anniversaire de ${n.birthday.name}` };
}

export async function runNotifications(env: Env, now: Date): Promise<void> {
  const settings = await env.DB
    .prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1")
    .first<Settings>();
  if (!settings) return;
  if (parisHour(now) !== settings.notify_hour) return;

  const { results } = await env.DB
    .prepare("SELECT id, name, birth_month, birth_day, birth_year FROM birthdays")
    .all<Birthday>();
  const planned = planNotifications(results, settings, now);
  if (planned.length === 0) return;

  const { results: subs } = await env.DB
    .prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions")
    .all<PushTarget & { id: number }>();
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };

  for (const n of planned) {
    const msg = messageFor(n);
    for (const sub of subs) {
      try {
        const { dead } = await sendPush(sub, msg, vapid);
        if (dead) await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
      } catch (err) {
        // A flaky endpoint must not abort notifications to the remaining subscriptions.
        console.error("push send failed for subscription", sub.id, err);
      }
    }
  }
}
