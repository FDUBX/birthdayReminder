import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Settings as SettingsType } from "@bday/shared";
import { api } from "../api";
import { enablePush } from "../sw-push";
import IosInstallHint from "../components/IosInstallHint";
import { ArrowLeft, Bell } from "../components/icons";

export default function Settings() {
  const [s, setS] = useState<SettingsType | null>(null);
  const [pushMsg, setPushMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => { void api.getSettings().then(setS); }, []);

  if (!s) {
    return (
      <div className="page">
        <div className="spinner" aria-label="Chargement" />
      </div>
    );
  }

  async function save() {
    await api.updateSettings({ reminder_days_before: s!.reminder_days_before, notify_hour: s!.notify_hour });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  async function onEnablePush() {
    const r = await enablePush();
    setPushMsg(r.ok
      ? { ok: true, text: "Notifications activées avec succès !" }
      : { ok: false, text: `Échec : ${r.reason ?? "erreur inconnue"}` }
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__title">
          <Link to="/" className="btn btn--icon" aria-label="Retour">
            <ArrowLeft size={20} />
          </Link>
          <span className="app-title">Réglages</span>
        </div>
      </header>

      <IosInstallHint />

      <div className="settings-group" style={{ marginTop: "var(--sp-md)" }}>
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
            <div className="settings-row">
              <label className="label" htmlFor="reminder-days">
                Rappel (jours avant l'anniversaire)
              </label>
              <input
                id="reminder-days"
                className="input"
                type="number"
                min={0}
                max={60}
                value={s.reminder_days_before}
                onChange={(e) => setS({ ...s, reminder_days_before: Number(e.target.value) })}
              />
            </div>

            <div className="settings-row">
              <label className="label" htmlFor="notify-hour">
                Heure de notification (0–23, heure Paris)
              </label>
              <input
                id="notify-hour"
                className="input"
                type="number"
                min={0}
                max={23}
                value={s.notify_hour}
                onChange={(e) => setS({ ...s, notify_hour: Number(e.target.value) })}
              />
            </div>

            {savedMsg && (
              <p className="success-msg" role="status">Enregistré</p>
            )}

            <button className="btn btn--block" onClick={save}>
              Enregistrer
            </button>
          </div>
        </div>

        <hr className="settings-divider" />

        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
            <p style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600 }}>
              Active les notifications push pour être alerté le jour J.
            </p>
            <button className="btn btn--block" onClick={onEnablePush}>
              <Bell size={18} />
              Activer les notifications
            </button>
            {pushMsg && (
              <p className={pushMsg.ok ? "success-msg" : "error-msg"} role="status">
                {pushMsg.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
