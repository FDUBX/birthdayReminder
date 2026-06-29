import { useState } from "react";
import type { Birthday } from "@bday/shared";

type Payload = Omit<Birthday, "id">;
interface Props { initial?: Birthday; onSubmit: (b: Payload) => void; onCancel: () => void; }

function toDateInput(b?: Birthday): string {
  if (!b) return "";
  const y = b.birth_year ?? 2000;
  return `${y.toString().padStart(4, "0")}-${String(b.birth_month).padStart(2, "0")}-${String(b.birth_day).padStart(2, "0")}`;
}

export default function BirthdayForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(toDateInput(initial));
  const [unknownYear, setUnknownYear] = useState(initial ? initial.birth_year === null : false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parts = date.split("-");
    const y = Number(parts[0] ?? "0");
    const m = Number(parts[1] ?? "0");
    const d = Number(parts[2] ?? "0");
    onSubmit({ name: name.trim(), birth_month: m, birth_day: d, birth_year: unknownYear ? null : y });
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <label>Date <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label><input aria-label="Année inconnue" type="checkbox" checked={unknownYear} onChange={(e) => setUnknownYear(e.target.checked)} /> Année inconnue</label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
