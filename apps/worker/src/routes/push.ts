import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const push = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

push.get("/api/push/public-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

push.use("/api/push/subscribe", requireAuth);
push.use("/api/push/unsubscribe", requireAuth);

push.post("/api/push/subscribe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return c.json({ error: "invalid subscription" }, 400);
  }
  await c.env.DB
    .prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id`)
    .bind(c.get("userId"), endpoint, p256dh, auth, new Date().toISOString()).run();
  return c.json({ ok: true }, 201);
});

push.post("/api/push/unsubscribe", async (c) => {
  const { endpoint } = await c.req.json().catch(() => ({}));
  if (typeof endpoint !== "string") return c.json({ error: "invalid input" }, 400);
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
  return c.body(null, 204);
});
