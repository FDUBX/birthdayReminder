import { isIos, isStandalone } from "../sw-push";

export default function IosInstallHint() {
  if (!isIos() || isStandalone()) return null;
  return (
    <div className="ios-hint" role="note">
      <p>
        <strong>iPhone / iPad :</strong> pour recevoir les notifications, ajoute d'abord cette app
        à l'écran d'accueil (bouton <em>Partager</em> → <em>Sur l'écran d'accueil</em>),
        puis rouvre-la depuis l'icône et active les notifications.
      </p>
    </div>
  );
}
