import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { signSession } from "../src/auth/session";

let sessionCookie: string;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  // seed user with id=1
  await env.DB
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'owner@example.com', 'x', ?)")
    .bind(new Date().toISOString())
    .run();
  const token = await signSession({ userId: 1 }, "test-secret");
  sessionCookie = `session=${token}`;
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM birthdays").run();
});

describe("GET /api/birthdays (unauthenticated)", () => {
  it("returns 401 without cookie", async () => {
    const res = await app.request("/api/birthdays", {}, env);
    expect(res.status).toBe(401);
  });
});

describe("birthdays CRUD (authenticated)", () => {
  it("POST creates a birthday and GET lists it", async () => {
    const createRes = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Grandma", birth_month: 4, birth_day: 15, birth_year: 1942 }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { id: number };
    expect(created.id).toBeTypeOf("number");

    const listRes = await app.request(
      "/api/birthdays",
      { headers: { Cookie: sessionCookie } },
      env,
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json() as Array<{ name: string; birth_month: number; birth_day: number; birth_year: number }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Grandma");
    expect(list[0]?.birth_month).toBe(4);
  });

  it("PUT updates a birthday", async () => {
    const createRes = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Grandma", birth_month: 4, birth_day: 15 }),
      },
      env,
    );
    const { id } = await createRes.json() as { id: number };

    const updateRes = await app.request(
      `/api/birthdays/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Grandma Updated", birth_month: 5, birth_day: 20 }),
      },
      env,
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json() as { id: number };
    expect(updated.id).toBe(id);
  });

  it("DELETE removes a birthday", async () => {
    const createRes = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Grandma", birth_month: 4, birth_day: 15 }),
      },
      env,
    );
    const { id } = await createRes.json() as { id: number };

    const delRes = await app.request(
      `/api/birthdays/${id}`,
      { method: "DELETE", headers: { Cookie: sessionCookie } },
      env,
    );
    expect(delRes.status).toBe(204);
  });

  it("PUT non-existent returns 404", async () => {
    const res = await app.request(
      "/api/birthdays/99999",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Nobody", birth_month: 1, birth_day: 1 }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("POST with invalid month 13 returns 400", async () => {
    const res = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Bad", birth_month: 13, birth_day: 1 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("POST with impossible day for month returns 400", async () => {
    const res = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "X", birth_month: 2, birth_day: 30 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("POST with Feb 29 and no year returns 201", async () => {
    const res = await app.request(
      "/api/birthdays",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        body: JSON.stringify({ name: "Leap", birth_month: 2, birth_day: 29 }),
      },
      env,
    );
    expect(res.status).toBe(201);
  });
});
