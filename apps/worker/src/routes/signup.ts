import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { hashPassword } from "../auth/password";
import { signSession } from "../auth/session";

// Cloudflare Workers extends SubtleCrypto with timingSafeEqual (not in lib.dom.d.ts).
type CfSubtle = SubtleCrypto & {
  timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
};

export const signup = new Hono<{ Bindings: Env }>();

signup.post("/api/signup", async (c) => {
  const { email, password, inviteCode } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || password.length < 6) {
    return c.json({ error: "invalid input" }, 400);
  }
  const enc = new TextEncoder();
  const provided = enc.encode(typeof inviteCode === "string" ? inviteCode : "");
  const expected = enc.encode(c.env.INVITE_CODE);
  const inviteOk = provided.length === expected.length && (crypto.subtle as CfSubtle).timingSafeEqual(provided, expected);
  if (!inviteOk) return c.json({ error: "bad invite code" }, 403);
  const normEmail = email.toLowerCase();
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(normEmail).first();
  if (existing) return c.json({ error: "email already used" }, 409);

  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const result = await c.env.DB
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .bind(normEmail, hash, now)
    .run();
  const userId = Number(result.meta.last_row_id);

  const token = await signSession({ userId }, c.env.JWT_SECRET);
  setCookie(c, "session", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.json({ id: userId, email: normEmail }, 201);
});
