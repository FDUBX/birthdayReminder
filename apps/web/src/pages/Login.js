import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const nav = useNavigate();
    const { setLoggedIn } = useAuth();
    async function submit(e) {
        e.preventDefault();
        setError("");
        try {
            await api.login(email, password);
            setLoggedIn(true);
            nav("/");
        }
        catch (err) {
            setError(err.message);
        }
    }
    return (_jsxs("form", { onSubmit: submit, style: { maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }, children: [_jsx("h1", { children: "Connexion" }), _jsx("input", { type: "email", placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value), required: true }), _jsx("input", { type: "password", placeholder: "Mot de passe", value: password, onChange: (e) => setPassword(e.target.value), required: true }), error && _jsx("p", { style: { color: "crimson" }, children: error }), _jsx("button", { type: "submit", children: "Se connecter" }), _jsx(Link, { to: "/signup", children: "Cr\u00E9er un compte" })] }));
}
