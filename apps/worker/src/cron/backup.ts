import type { Env } from "../env";

export async function runBackup(env: Env, now: Date): Promise<void> {
  const [users, birthdays, subscriptions, settings] = await Promise.all([
    env.DB.prepare("SELECT id, email, password_hash, created_at FROM users").all(),
    env.DB.prepare("SELECT * FROM birthdays").all(),
    env.DB.prepare("SELECT * FROM push_subscriptions").all(),
    env.DB.prepare("SELECT * FROM settings").all(),
  ]);
  const dump = {
    generated_at: now.toISOString(),
    users: users.results,
    birthdays: birthdays.results,
    subscriptions: subscriptions.results,
    settings: settings.results,
  };
  const date = now.toISOString().slice(0, 10);
  await env.BACKUPS.put(`backups/${date}.json`, JSON.stringify(dump), {
    httpMetadata: { contentType: "application/json" },
  });
}
