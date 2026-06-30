import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Birthday } from "@bday/shared";
import { ageFromYear, daysUntilNextBirthday, parisToday } from "@bday/shared";
import { api } from "../api";
import BirthdayForm from "../components/BirthdayForm";
import { Settings, Plus, Pencil, Trash, Cake } from "../components/icons";

const MONTHS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDate(month: number, day: number): string {
  const label = MONTHS_LONG[month - 1] ?? "";
  return `${day} ${label}`;
}

type SortedBirthday = Birthday & { daysUntil: number };

function sortBirthdays(list: Birthday[]): SortedBirthday[] {
  const today = parisToday(new Date());
  return list
    .map((b) => ({ ...b, daysUntil: daysUntilNextBirthday(b.birth_month, b.birth_day, today) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

interface BadgeProps { daysUntil: number; }
function BirthdayBadge({ daysUntil }: BadgeProps) {
  if (daysUntil === 0) {
    return (
      <span className="badge badge--today">
        <Cake size={13} />
        Aujourd'hui
      </span>
    );
  }
  return (
    <span className="badge badge--soon">
      Dans {daysUntil} j
    </span>
  );
}

export default function Birthdays() {
  const [list, setList] = useState<Birthday[]>([]);
  const [editing, setEditing] = useState<Birthday | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const today = parisToday(new Date());

  async function reload() {
    setLoading(true);
    setList(await api.listBirthdays());
    setLoading(false);
  }
  useEffect(() => { void reload(); }, []);

  async function save(b: Omit<Birthday, "id">) {
    if (editing === "new") await api.createBirthday(b);
    else if (editing) await api.updateBirthday(editing.id, b);
    setEditing(null);
    await reload();
  }

  async function remove(id: number) {
    await api.deleteBirthday(id);
    await reload();
  }

  const sorted = sortBirthdays(list);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__title">
          <span className="app-title">Anniversaires</span>
        </div>
        <div className="topbar__actions">
          <Link to="/settings" className="btn btn--icon" aria-label="Réglages">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {editing ? (
        <div style={{ marginTop: "var(--sp-md)" }}>
          <BirthdayForm
            initial={editing === "new" ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <div className="add-btn-wrap">
          <button className="btn btn--block" onClick={() => setEditing("new")}>
            <Plus size={18} />
            Ajouter un anniversaire
          </button>
        </div>
      )}

      {loading ? (
        <div className="spinner" aria-label="Chargement" />
      ) : sorted.length === 0 && !editing ? (
        <div className="empty">
          <div className="empty__icon">
            <Cake size={40} />
          </div>
          <p>Aucun anniversaire —{" "}ajoutes-en un !</p>
        </div>
      ) : (
        <ul className="birthday-list">
          {sorted.map((b) => {
            const age = ageFromYear(b.birth_year, today.year);
            return (
              <li key={b.id} className="birthday-item">
                <div className="birthday-item__info">
                  <div className="birthday-item__name">{b.name}</div>
                  <div className="birthday-item__date">
                    {formatDate(b.birth_month, b.birth_day)}
                    {age !== null && <span style={{ marginLeft: 6 }}>· {age} ans</span>}
                  </div>
                </div>
                <div className="birthday-item__badge">
                  <BirthdayBadge daysUntil={b.daysUntil} />
                </div>
                <div className="birthday-item__actions">
                  <button
                    className="btn btn--icon"
                    aria-label={`Modifier ${b.name}`}
                    onClick={() => setEditing(b)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="btn btn--icon btn--icon-danger"
                    aria-label={`Supprimer ${b.name}`}
                    onClick={() => remove(b.id)}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
