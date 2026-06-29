import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthState { loggedIn: boolean; setLoggedIn: (v: boolean) => void; }
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // session is an httpOnly cookie; we track a client flag set after login/signup.
  const [loggedIn, setLoggedIn] = useState<boolean>(() => localStorage.getItem("loggedIn") === "1");
  const set = (v: boolean) => { v ? localStorage.setItem("loggedIn", "1") : localStorage.removeItem("loggedIn"); setLoggedIn(v); };
  return <Ctx.Provider value={{ loggedIn, setLoggedIn: set }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
