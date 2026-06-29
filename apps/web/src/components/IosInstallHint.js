import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isIos, isStandalone } from "../sw-push";
export default function IosInstallHint() {
    if (!isIos() || isStandalone())
        return null;
    return (_jsxs("div", { style: { background: "#fff6e5", border: "1px solid #f0c36d", padding: 12, borderRadius: 8, margin: "12px 0" }, children: [_jsx("strong", { children: "iPhone / iPad :" }), " pour recevoir les notifications, ajoute d'abord cette app \u00E0 l'\u00E9cran d'accueil (bouton ", _jsx("em", { children: "Partager" }), " \u2192 ", _jsx("em", { children: "Sur l'\u00E9cran d'accueil" }), "), puis rouvre-la depuis l'ic\u00F4ne et active les notifications."] }));
}
