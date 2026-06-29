import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
function toDateInput(b) {
    if (!b)
        return "";
    const y = b.birth_year ?? 2000;
    return `${y.toString().padStart(4, "0")}-${String(b.birth_month).padStart(2, "0")}-${String(b.birth_day).padStart(2, "0")}`;
}
export default function BirthdayForm({ initial, onSubmit, onCancel }) {
    const [name, setName] = useState(initial?.name ?? "");
    const [date, setDate] = useState(toDateInput(initial));
    const [unknownYear, setUnknownYear] = useState(initial ? initial.birth_year === null : false);
    function submit(e) {
        e.preventDefault();
        const parts = date.split("-");
        const y = Number(parts[0] ?? "0");
        const m = Number(parts[1] ?? "0");
        const d = Number(parts[2] ?? "0");
        onSubmit({ name: name.trim(), birth_month: m, birth_day: d, birth_year: unknownYear ? null : y });
    }
    return (_jsxs("form", { onSubmit: submit, style: { display: "grid", gap: 8 }, children: [_jsx("input", { placeholder: "Nom", value: name, onChange: (e) => setName(e.target.value), required: true }), _jsxs("label", { children: ["Date ", _jsx("input", { "aria-label": "Date", type: "date", value: date, onChange: (e) => setDate(e.target.value), required: true })] }), _jsxs("label", { children: [_jsx("input", { "aria-label": "Ann\u00E9e inconnue", type: "checkbox", checked: unknownYear, onChange: (e) => setUnknownYear(e.target.checked) }), " Ann\u00E9e inconnue"] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "submit", children: "Enregistrer" }), _jsx("button", { type: "button", onClick: onCancel, children: "Annuler" })] })] }));
}
