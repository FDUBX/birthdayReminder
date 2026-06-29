import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { enablePush } from "../sw-push";
import IosInstallHint from "../components/IosInstallHint";
export default function Settings() {
    const [s, setS] = useState(null);
    const [pushMsg, setPushMsg] = useState("");
    useEffect(() => { void api.getSettings().then(setS); }, []);
    if (!s)
        return _jsx("p", { children: "Chargement\u2026" });
    async function save() {
        await api.updateSettings({ reminder_days_before: s.reminder_days_before, notify_hour: s.notify_hour });
    }
    async function onEnablePush() {
        const r = await enablePush();
        setPushMsg(r.ok ? "Notifications activées ✅" : `Échec : ${r.reason}`);
    }
    return (_jsxs("main", { style: { maxWidth: 480, margin: "1rem auto", padding: "0 1rem" }, children: [_jsxs("header", { style: { display: "flex", justifyContent: "space-between" }, children: [_jsx("h1", { children: "R\u00E9glages" }), _jsx(Link, { to: "/", children: "\u2190" })] }), _jsx(IosInstallHint, {}), _jsxs("label", { style: { display: "block", margin: "8px 0" }, children: ["Rappel (jours avant) :", _jsx("input", { type: "number", min: 0, max: 60, value: s.reminder_days_before, onChange: (e) => setS({ ...s, reminder_days_before: Number(e.target.value) }) })] }), _jsxs("label", { style: { display: "block", margin: "8px 0" }, children: ["Heure de notification :", _jsx("input", { type: "number", min: 0, max: 23, value: s.notify_hour, onChange: (e) => setS({ ...s, notify_hour: Number(e.target.value) }) })] }), _jsx("button", { onClick: save, children: "Enregistrer" }), _jsx("hr", {}), _jsx("button", { onClick: onEnablePush, children: "Activer les notifications sur cet appareil" }), pushMsg && _jsx("p", { children: pushMsg })] }));
}
