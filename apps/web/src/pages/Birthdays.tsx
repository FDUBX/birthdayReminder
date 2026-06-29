import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Birthday } from "@bday/shared";
import { ageFromYear } from "@bday/shared";
import { api } from "../api";
import BirthdayForm from "../components/BirthdayForm";

const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

export default function Birthdays() {
  const [list, setList] = useState<Birthday[]>([]);
  const [editing, setEditing] = useState<Birthday | "new" | null>(null);
  const year = new Date().getFullYear();

  async function reload() { setList(await api.listBirthdays()); }
  useEffect(() => { void reload(); }, []);

  async function save(b: Omit<Birthday, "id">) {
    if (editing === "new") await api.createBirthday(b);
    else if (editing) await api.updateBirthday(editing.id, b);
    setEditing(null); await reload();
  }
  async function remove(id: number) { await api.deleteBirthday(id); await reload(); }

  return (
    <main style={{ maxWidth: 480, margin: "1rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Anniversaires</h1>
        <Link to="/settings">⚙️</Link>
      </header>
      {editing ? (
        <BirthdayForm initial={editing === "new" ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing("new")}>+ Ajouter</button>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {list.map((b) => {
          const age = ageFromYear(b.birth_year, year);
          const monthLabel = MONTHS[b.birth_month - 1] ?? "";
          return (
            <li key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <span>{b.name} — {b.birth_day} {monthLabel}{age !== null ? ` (${age} ans)` : ""}</span>
              <span>
                <button onClick={() => setEditing(b)}>✏️</button>
                <button onClick={() => remove(b.id)}>🗑️</button>
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
