import { isIos, isStandalone } from "../sw-push";

export default function IosInstallHint() {
  if (!isIos() || isStandalone()) return null;
  return (
    <div style={{ background: "#fff6e5", border: "1px solid #f0c36d", padding: 12, borderRadius: 8, margin: "12px 0" }}>
      <strong>iPhone / iPad :</strong> pour recevoir les notifications, ajoute d'abord cette app à l'écran d'accueil
      (bouton <em>Partager</em> → <em>Sur l'écran d'accueil</em>), puis rouvre-la depuis l'icône et active les notifications.
    </div>
  );
}
