import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ageFromYear } from "@bday/shared";
import { api } from "../api";
import BirthdayForm from "../components/BirthdayForm";
const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
export default function Birthdays() {
    const [list, setList] = useState([]);
    const [editing, setEditing] = useState(null);
    const year = new Date().getFullYear();
    async function reload() { setList(await api.listBirthdays()); }
    useEffect(() => { void reload(); }, []);
    async function save(b) {
        if (editing === "new")
            await api.createBirthday(b);
        else if (editing)
            await api.updateBirthday(editing.id, b);
        setEditing(null);
        await reload();
    }
    async function remove(id) { await api.deleteBirthday(id); await reload(); }
    return (_jsxs("main", { style: { maxWidth: 480, margin: "1rem auto", padding: "0 1rem" }, children: [_jsxs("header", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("h1", { children: "Anniversaires" }), _jsx(Link, { to: "/settings", children: "\u2699\uFE0F" })] }), editing ? (_jsx(BirthdayForm, { initial: editing === "new" ? undefined : editing, onSubmit: save, onCancel: () => setEditing(null) })) : (_jsx("button", { onClick: () => setEditing("new"), children: "+ Ajouter" })), _jsx("ul", { style: { listStyle: "none", padding: 0 }, children: list.map((b) => {
                    const age = ageFromYear(b.birth_year, year);
                    const monthLabel = MONTHS[b.birth_month - 1] ?? "";
                    return (_jsxs("li", { style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }, children: [_jsxs("span", { children: [b.name, " \u2014 ", b.birth_day, " ", monthLabel, age !== null ? ` (${age} ans)` : ""] }), _jsxs("span", { children: [_jsx("button", { onClick: () => setEditing(b), children: "\u270F\uFE0F" }), _jsx("button", { onClick: () => remove(b.id), children: "\uD83D\uDDD1\uFE0F" })] })] }, b.id));
                }) })] }));
}
