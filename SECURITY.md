# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une faille de sécurité.

Utilise plutôt le **signalement privé de vulnérabilité** de GitHub :
onglet **Security** du dépôt → **Report a vulnerability**.

Décris : le composant touché (worker/API, PWA, auth, push), l'impact, et les étapes de reproduction. Réponse sous ~7 jours.

## Périmètre

- **Auth** : inscription (code d'invitation), login (PBKDF2 + JWT cookie), sessions.
- **API** : routes `/api/*` (anniversaires, réglages, abonnements push).
- **Push** : envoi VAPID.

## Bonnes pratiques de déploiement

Les secrets (`JWT_SECRET`, `INVITE_CODE`, clés VAPID) ne sont **jamais** dans le dépôt — ils sont gérés via `wrangler secret`. Ne les commite pas. Utilise un `JWT_SECRET` et un `INVITE_CODE` forts.
