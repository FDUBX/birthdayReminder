import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Settings as SettingsType } from "@bday/shared";
import { api } from "../api";
import { enablePush } from "../sw-push";
import IosInstallHint from "../components/IosInstallHint";

export default function Settings() {
  const [s, setS] = useState<SettingsType | null>(null);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => { void api.getSettings().then(setS); }, []);
  if (!s) return <p>Chargement…</p>;

  async function save() {
    await api.updateSettings({ reminder_days_before: s!.reminder_days_before, notify_hour: s!.notify_hour });
  }
  async function onEnablePush() {
    const r = await enablePush();
    setPushMsg(r.ok ? "Notifications activées ✅" : `Échec : ${r.reason}`);
  }

  return (
    <main style={{ maxWidth: 480, margin: "1rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Réglages</h1><Link to="/">←</Link>
      </header>
      <IosInstallHint />
      <label style={{ display: "block", margin: "8px 0" }}>
        Rappel (jours avant) :
        <input type="number" min={0} max={60} value={s.reminder_days_before}
          onChange={(e) => setS({ ...s, reminder_days_before: Number(e.target.value) })} />
      </label>
      <label style={{ display: "block", margin: "8px 0" }}>
        Heure de notification :
        <input type="number" min={0} max={23} value={s.notify_hour}
          onChange={(e) => setS({ ...s, notify_hour: Number(e.target.value) })} />
      </label>
      <button onClick={save}>Enregistrer</button>
      <hr />
      <button onClick={onEnablePush}>Activer les notifications sur cet appareil</button>
      {pushMsg && <p>{pushMsg}</p>}
    </main>
  );
}
