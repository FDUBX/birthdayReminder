import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const settings = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

settings.use("/api/settings", requireAuth);

settings.get("/api/settings", async (c) => {
  const row = await c.env.DB
    .prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1")
    .first();
  return c.json(row);
});

settings.put("/api/settings", async (c) => {
  const { reminder_days_before, notify_hour } = await c.req.json().catch(() => ({}));
  if (typeof reminder_days_before !== "number" || reminder_days_before < 0 || reminder_days_before > 60) {
    return c.json({ error: "invalid reminder_days_before" }, 400);
  }
  if (typeof notify_hour !== "number" || notify_hour < 0 || notify_hour > 23) {
    return c.json({ error: "invalid notify_hour" }, 400);
  }
  await c.env.DB
    .prepare("UPDATE settings SET reminder_days_before = ?, notify_hour = ? WHERE id = 1")
    .bind(reminder_days_before, notify_hour)
    .run();
  return c.json({ ok: true });
});
