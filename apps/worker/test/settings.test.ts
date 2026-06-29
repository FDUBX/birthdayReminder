import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { signSession } from "../src/auth/session";

let sessionCookie: string;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  // seed user for auth
  await env.DB
    .prepare("INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (1, 'owner@example.com', 'x', ?)")
    .bind(new Date().toISOString())
    .run();
  const token = await signSession({ userId: 1 }, "test-secret");
  sessionCookie = `session=${token}`;
});

beforeEach(async () => {
  // reset settings to seeded defaults
  await env.DB
    .prepare("UPDATE settings SET reminder_days_before = 7, notify_hour = 8 WHERE id = 1")
    .run();
});

describe("GET /api/settings", () => {
  it("returns seeded defaults { reminder_days_before: 7, notify_hour: 8, timezone: 'Europe/Paris' }", async () => {
    const res = await app.request(
      "/api/settings",
      { headers: { Cookie: sessionCookie } },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ reminder_days_before: 7, notify_hour: 8, timezone: "Europe/Paris" });
  });
});

describe("PUT /api/settings", () => {
  it("updates reminder_days_before and notify_hour", async () => {
    const putRes = await app.request(
      "/api/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ reminder_days_before: 3, notify_hour: 9 }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const body = await putRes.json();
    expect(body).toEqual({ ok: true });

    const getRes = await app.request(
      "/api/settings",
      { headers: { Cookie: sessionCookie } },
      env,
    );
    const updated = await getRes.json() as { reminder_days_before: number; notify_hour: number };
    expect(updated.reminder_days_before).toBe(3);
    expect(updated.notify_hour).toBe(9);
  });

  it("returns 400 when notify_hour is 25", async () => {
    const res = await app.request(
      "/api/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ reminder_days_before: 3, notify_hour: 25 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without cookie", async () => {
    const res = await app.request(
      "/api/settings",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminder_days_before: 3, notify_hour: 9 }) },
      env,
    );
    expect(res.status).toBe(401);
  });
});
