import { Hono } from "hono";
import type { Env } from "./env";
import { signup } from "./routes/signup";
import { login } from "./routes/login";
import { birthdays } from "./routes/birthdays";
import { settings } from "./routes/settings";
import { push } from "./routes/push";
import { runNotifications } from "./cron/notify";
import { runBackup } from "./cron/backup";
import { parisHour } from "@bday/shared";

const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/", signup);
app.route("/", login);
app.route("/", birthdays);
app.route("/", settings);
app.route("/", push);

export { app };
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const now = new Date();
    ctx.waitUntil(runNotifications(env, now));
    if (parisHour(now) === 3) ctx.waitUntil(runBackup(env, now));
  },
};
