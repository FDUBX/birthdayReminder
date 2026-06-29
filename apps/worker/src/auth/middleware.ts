import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifySession } from "./session";

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: { userId: number };
}>(async (c, next) => {
  const token = getCookie(c, "session");
  const session = token ? await verifySession(token, c.env.JWT_SECRET) : null;
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.userId);
  await next();
});
