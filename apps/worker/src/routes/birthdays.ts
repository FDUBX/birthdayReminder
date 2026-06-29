import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const birthdays = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

birthdays.use("/api/birthdays/*", requireAuth);
birthdays.use("/api/birthdays", requireAuth);

interface BodyShape {
  name: unknown;
  birth_month: unknown;
  birth_day: unknown;
  birth_year?: unknown;
}

function validate(b: BodyShape): { name: string; month: number; day: number; year: number | null } | null {
  const { name, birth_month, birth_day, birth_year } = b;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof birth_month !== "number" || birth_month < 1 || birth_month > 12) return null;
  if (typeof birth_day !== "number" || birth_day < 1 || birth_day > 31) return null;
  const year = birth_year === null || birth_year === undefined ? null : Number(birth_year);
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return null;
  return { name: name.trim(), month: birth_month, day: birth_day, year };
}

birthdays.get("/api/birthdays", async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT id, name, birth_month, birth_day, birth_year FROM birthdays ORDER BY birth_month, birth_day")
    .all();
  return c.json(results);
});

birthdays.post("/api/birthdays", async (c) => {
  const v = validate(await c.req.json().catch(() => ({})));
  if (!v) return c.json({ error: "invalid input" }, 400);
  const now = new Date().toISOString();
  const res = await c.env.DB
    .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(v.name, v.month, v.day, v.year, c.get("userId"), now, now)
    .run();
  return c.json({ id: Number(res.meta.last_row_id) }, 201);
});

birthdays.put("/api/birthdays/:id", async (c) => {
  const v = validate(await c.req.json().catch(() => ({})));
  if (!v) return c.json({ error: "invalid input" }, 400);
  const id = Number(c.req.param("id"));
  const res = await c.env.DB
    .prepare("UPDATE birthdays SET name = ?, birth_month = ?, birth_day = ?, birth_year = ?, updated_at = ? WHERE id = ?")
    .bind(v.name, v.month, v.day, v.year, new Date().toISOString(), id)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ id });
});

birthdays.delete("/api/birthdays/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const res = await c.env.DB.prepare("DELETE FROM birthdays WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
