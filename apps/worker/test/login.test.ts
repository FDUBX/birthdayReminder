import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { hashPassword } from "../src/auth/password";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  const hash = await hashPassword("hunter2");
  await env.DB
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .bind("alice@example.com", hash, new Date().toISOString())
    .run();
});

describe("POST /api/login", () => {
  it("returns 200 + set-cookie for valid credentials", async () => {
    const res = await app.request(
      "/api/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "hunter2" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; email: string };
    expect(body.email).toBe("alice@example.com");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("returns 401 for wrong password", async () => {
    const res = await app.request(
      "/api/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "wrongpass" }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for unknown email", async () => {
    const res = await app.request(
      "/api/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "hunter2" }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });
});
