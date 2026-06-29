import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
export default function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");
    const nav = useNavigate();
    const { setLoggedIn } = useAuth();
    async function submit(e) {
        e.preventDefault();
        setError("");
        try {
            await api.signup(email, password, inviteCode);
            setLoggedIn(true);
            nav("/");
        }
        catch (err) {
            setError(err.message);
        }
    }
    return (_jsxs("form", { onSubmit: submit, style: { maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }, children: [_jsx("h1", { children: "Cr\u00E9er un compte" }), _jsx("input", { type: "email", placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value), required: true }), _jsx("input", { type: "password", placeholder: "Mot de passe (6+ caract\u00E8res)", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6 }), _jsx("input", { placeholder: "Code d'invitation", value: inviteCode, onChange: (e) => setInviteCode(e.target.value), required: true }), error && _jsx("p", { style: { color: "crimson" }, children: error }), _jsx("button", { type: "submit", children: "Cr\u00E9er" }), _jsx(Link, { to: "/login", children: "J'ai d\u00E9j\u00E0 un compte" })] }));
}
