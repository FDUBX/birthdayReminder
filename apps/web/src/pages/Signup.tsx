import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cake } from "../components/icons";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { setLoggedIn } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.signup(email, password, inviteCode);
      setLoggedIn(true);
      nav("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-header__icon">
            <Cake size={36} />
          </div>
          <h1>Bienvenue !</h1>
          <p>Crée ton compte pour commencer</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label className="label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-password">Mot de passe</label>
            <input
              id="signup-password"
              className="input"
              type="password"
              placeholder="6 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-invite">Code d'invitation</label>
            <input
              id="signup-invite"
              className="input"
              placeholder="CODE-XXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-msg" role="alert">{error}</p>}
          <button type="submit" className="btn btn--block" disabled={loading}>
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        <p className="auth-footer">
          Déjà un compte ?{" "}
          <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
