async function j(res) {
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
    return res.status === 204 ? undefined : res.json();
}
const opts = (method, body) => ({
    method, credentials: "include",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
});
export const api = {
    signup: async (email, password, inviteCode) => j(await fetch("/api/signup", opts("POST", { email, password, inviteCode }))),
    login: async (email, password) => j(await fetch("/api/login", opts("POST", { email, password }))),
    listBirthdays: async () => j(await fetch("/api/birthdays", opts("GET"))),
    createBirthday: async (b) => j(await fetch("/api/birthdays", opts("POST", b))),
    updateBirthday: async (id, b) => j(await fetch(`/api/birthdays/${id}`, opts("PUT", b))),
    deleteBirthday: async (id) => j(await fetch(`/api/birthdays/${id}`, opts("DELETE"))),
    getSettings: async () => j(await fetch("/api/settings", opts("GET"))),
    updateSettings: async (s) => j(await fetch("/api/settings", opts("PUT", s))),
    pushPublicKey: async () => j(await fetch("/api/push/public-key", opts("GET"))),
    subscribePush: async (sub) => j(await fetch("/api/push/subscribe", opts("POST", sub))),
    unsubscribePush: async (endpoint) => j(await fetch("/api/push/unsubscribe", opts("POST", { endpoint }))),
};
