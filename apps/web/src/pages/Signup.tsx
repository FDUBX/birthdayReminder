import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Signup() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(""); const nav = useNavigate(); const { setLoggedIn } = useAuth();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api.signup(email, password, inviteCode); setLoggedIn(true); nav("/"); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Créer un compte</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe (6+ caractères)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <input placeholder="Code d'invitation" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Créer</button>
      <Link to="/login">J'ai déjà un compte</Link>
    </form>
  );
}
