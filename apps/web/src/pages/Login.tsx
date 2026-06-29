import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const nav = useNavigate(); const { setLoggedIn } = useAuth();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api.login(email, password); setLoggedIn(true); nav("/"); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Connexion</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Se connecter</button>
      <Link to="/signup">Créer un compte</Link>
    </form>
  );
}
