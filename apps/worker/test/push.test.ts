import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { signSession } from "../src/auth/session";

let sessionCookie: string;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB
    .prepare("INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (1, 'owner@example.com', 'x', ?)")
    .bind(new Date().toISOString())
    .run();
  const token = await signSession({ userId: 1 }, "test-secret");
  sessionCookie = `session=${token}`;
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

describe("GET /api/push/public-key", () => {
  it("returns 200 with publicKey without auth", async () => {
    const res = await app.request("/api/push/public-key", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { publicKey: string };
    expect(body.publicKey).toBe("test-public");
  });
});

describe("POST /api/push/subscribe", () => {
  it("returns 201 and creates a subscription", async () => {
    const res = await app.request(
      "/api/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "KEY", auth: "AUTH" } }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 401 without cookie", async () => {
    const res = await app.request(
      "/api/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "KEY", auth: "AUTH" } }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 with invalid body", async () => {
    const res = await app.request(
      "/api/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ endpoint: "https://push.example/abc" }), // missing keys
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("posting same endpoint twice results in only 1 row (ON CONFLICT)", async () => {
    const payload = { endpoint: "https://push.example/abc", keys: { p256dh: "KEY", auth: "AUTH" } };
    await app.request(
      "/api/push/subscribe",
      { method: "POST", headers: { "Content-Type": "application/json", Cookie: sessionCookie }, body: JSON.stringify(payload) },
      env,
    );
    await app.request(
      "/api/push/subscribe",
      { method: "POST", headers: { "Content-Type": "application/json", Cookie: sessionCookie }, body: JSON.stringify(payload) },
      env,
    );
    const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?").bind("https://push.example/abc").all();
    expect(results).toHaveLength(1);
  });
});

describe("POST /api/push/unsubscribe", () => {
  it("returns 204 and removes the subscription", async () => {
    // First subscribe
    await app.request(
      "/api/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "KEY", auth: "AUTH" } }),
      },
      env,
    );

    // Then unsubscribe
    const res = await app.request(
      "/api/push/unsubscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ endpoint: "https://push.example/abc" }),
      },
      env,
    );
    expect(res.status).toBe(204);

    // Verify row gone
    const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?").bind("https://push.example/abc").all();
    expect(results).toHaveLength(0);
  });
});
