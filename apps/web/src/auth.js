import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from "react";
const Ctx = createContext(null);
export function AuthProvider({ children }) {
    // session is an httpOnly cookie; we track a client flag set after login/signup.
    const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("loggedIn") === "1");
    const set = (v) => { v ? localStorage.setItem("loggedIn", "1") : localStorage.removeItem("loggedIn"); setLoggedIn(v); };
    return _jsx(Ctx.Provider, { value: { loggedIn, setLoggedIn: set }, children: children });
}
export function useAuth() {
    const v = useContext(Ctx);
    if (!v)
        throw new Error("useAuth must be used within AuthProvider");
    return v;
}
