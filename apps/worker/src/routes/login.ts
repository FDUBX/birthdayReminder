import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifyPassword } from "../auth/password";
import { signSession } from "../auth/session";

export const login = new Hono<{ Bindings: Env }>();

login.post("/api/login", async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return c.json({ error: "invalid input" }, 400);
  }
  const user = await c.env.DB
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const token = await signSession({ userId: user.id }, c.env.JWT_SECRET);
  setCookie(c, "session", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.json({ id: user.id, email });
});
