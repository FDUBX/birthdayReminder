import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("schema", () => {
  it("seeds the settings singleton", async () => {
    const row = await env.DB
      .prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1")
      .first();
    expect(row).toEqual({ reminder_days_before: 7, notify_hour: 8, timezone: "Europe/Paris" });
  });
});
