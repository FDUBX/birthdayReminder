import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runBackup } from "../src/cron/backup";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB
    .prepare("INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (1, 'owner@example.com', 'x', ?)")
    .bind(new Date().toISOString())
    .run();
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM birthdays").run();
});

describe("runBackup", () => {
  it("writes a JSON backup to R2 with the correct key and content", async () => {
    await env.DB
      .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, 3, 15, 1990, 1, ?, ?)")
      .bind("Anna", new Date().toISOString(), new Date().toISOString())
      .run();

    const now = new Date("2026-03-15T07:00:00Z");
    await runBackup(env as unknown as Parameters<typeof runBackup>[0], now);

    const object = await env.BACKUPS.get("backups/2026-03-15.json");
    expect(object).not.toBeNull();

    const text = await object!.text();
    const parsed = JSON.parse(text) as { birthdays: Array<{ name: string }> };
    expect(parsed.birthdays[0]?.name).toBe("Anna");
  });
});
