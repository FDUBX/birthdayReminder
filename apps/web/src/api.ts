import type { Birthday, Settings } from "@bday/shared";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`;
    // Session expired mid-use: clear the client flag and bounce to login.
    // Only when we believed we were logged in — preserves the server error
    // message for fresh login/signup attempts (which legitimately 401).
    if (res.status === 401 && localStorage.getItem("loggedIn") === "1") {
      localStorage.removeItem("loggedIn");
      location.href = "/login";
    }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
const opts = (method: string, body?: unknown): RequestInit => ({
  method, credentials: "include",
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  signup: async (email: string, password: string, inviteCode: string) =>
    j<{ id: number }>(await fetch("/api/signup", opts("POST", { email, password, inviteCode }))),
  login: async (email: string, password: string) =>
    j<{ id: number }>(await fetch("/api/login", opts("POST", { email, password }))),
  listBirthdays: async () => j<Birthday[]>(await fetch("/api/birthdays", opts("GET"))),
  createBirthday: async (b: Omit<Birthday, "id">) => j<{ id: number }>(await fetch("/api/birthdays", opts("POST", b))),
  updateBirthday: async (id: number, b: Omit<Birthday, "id">) => j<{ id: number }>(await fetch(`/api/birthdays/${id}`, opts("PUT", b))),
  deleteBirthday: async (id: number) => j<void>(await fetch(`/api/birthdays/${id}`, opts("DELETE"))),
  getSettings: async () => j<Settings>(await fetch("/api/settings", opts("GET"))),
  updateSettings: async (s: Pick<Settings, "reminder_days_before" | "notify_hour">) =>
    j<{ ok: true }>(await fetch("/api/settings", opts("PUT", s))),
  pushPublicKey: async () => j<{ publicKey: string }>(await fetch("/api/push/public-key", opts("GET"))),
  subscribePush: async (sub: PushSubscriptionJSON) => j<{ ok: true }>(await fetch("/api/push/subscribe", opts("POST", sub))),
  unsubscribePush: async (endpoint: string) => j<void>(await fetch("/api/push/unsubscribe", opts("POST", { endpoint }))),
};
