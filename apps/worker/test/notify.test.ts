/**
 * notify.test.ts — tests for runNotifications orchestration.
 *
 * Mock strategy: vi.mock("../src/push/send") — replaces sendPush with a spy
 * that internally calls fetch(sub.endpoint) and maps the response status to
 * { dead: status === 404 || status === 410 }. This lets us:
 *   1. Assert fetch call count (hour gate / planning logic)
 *   2. Assert purge behaviour (dead sub removed from DB)
 * without depending on real VAPID crypto, since the test VAPID keys
 * ("test-public" / "test-private") are not valid base64url-encoded keys.
 */
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runNotifications } from "../src/cron/notify";

// Mock the send module before importing anything that depends on it.
vi.mock("../src/push/send", () => ({
  sendPush: vi.fn(async (sub: { endpoint: string }) => {
    const res = await fetch(sub.endpoint);
    const dead = res.status === 404 || res.status === 410;
    return { dead };
  }),
}));

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB
    .prepare("INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (1, 'owner@example.com', 'x', ?)")
    .bind(new Date().toISOString())
    .run();
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM birthdays").run();
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
  await env.DB
    .prepare("UPDATE settings SET reminder_days_before = 7, notify_hour = 8 WHERE id = 1")
    .run();
  vi.restoreAllMocks();
});

describe("runNotifications", () => {
  it("does NOT call fetch when Paris hour != notify_hour (gate)", async () => {
    // Insert a birthday that would be "today" on 2026-03-15
    await env.DB
      .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, 3, 15, 1990, 1, ?, ?)")
      .bind("Marie", new Date().toISOString(), new Date().toISOString())
      .run();
    await env.DB
      .prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push.example/sub1', 'KEY', 'AUTH', ?)")
      .bind(new Date().toISOString())
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    // 2026-03-15T06:00:00Z = Paris 07:00 (UTC+1 in March), settings notify_hour=8
    const now = new Date("2026-03-15T06:00:00Z");
    await runNotifications(env as unknown as Parameters<typeof runNotifications>[0], now);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls fetch once for a 'today' birthday at notify_hour with 1 subscription", async () => {
    await env.DB
      .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, 3, 15, 1990, 1, ?, ?)")
      .bind("Marie", new Date().toISOString(), new Date().toISOString())
      .run();
    await env.DB
      .prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push.example/sub1', 'KEY', 'AUTH', ?)")
      .bind(new Date().toISOString())
      .run();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    // 2026-03-15T07:00:00Z = Paris 08:00 (UTC+1 in March)
    const now = new Date("2026-03-15T07:00:00Z");
    await runNotifications(env as unknown as Parameters<typeof runNotifications>[0], now);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("https://push.example/sub1");
  });

  it("purges dead subscription (410) from DB", async () => {
    await env.DB
      .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, 3, 15, 1990, 1, ?, ?)")
      .bind("Marie", new Date().toISOString(), new Date().toISOString())
      .run();
    await env.DB
      .prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push.example/gone', 'KEY', 'AUTH', ?)")
      .bind(new Date().toISOString())
      .run();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));

    const now = new Date("2026-03-15T07:00:00Z");
    await runNotifications(env as unknown as Parameters<typeof runNotifications>[0], now);

    const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions").all();
    expect(results).toHaveLength(0);
  });
});
