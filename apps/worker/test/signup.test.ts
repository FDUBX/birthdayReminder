import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("POST /api/signup", () => {
  it("returns 201 + set-cookie when invite code is valid", async () => {
    const res = await app.request(
      "/api/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "hunter2", inviteCode: "FAMILY2026" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number; email: string };
    expect(body.email).toBe("alice@example.com");
    expect(body.id).toBeTypeOf("number");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("returns 403 when invite code is wrong", async () => {
    const res = await app.request(
      "/api/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "hunter2", inviteCode: "WRONG" }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when email is already taken", async () => {
    const body = JSON.stringify({ email: "alice@example.com", password: "hunter2", inviteCode: "FAMILY2026" });
    await app.request("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body }, env);
    const res = await app.request("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body }, env);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is too short", async () => {
    const res = await app.request(
      "/api/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", password: "abc", inviteCode: "FAMILY2026" }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});
