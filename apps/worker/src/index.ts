import { Hono } from "hono";
import type { Env } from "./env";
import { signup } from "./routes/signup";
import { login } from "./routes/login";
import { birthdays } from "./routes/birthdays";
import { settings } from "./routes/settings";

const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/", signup);
app.route("/", login);
app.route("/", birthdays);
app.route("/", settings);

export { app };
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext) {},
};
