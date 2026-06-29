# BirthdayReminder — Design

**Date:** 2026-06-29
**Statut:** Approuvé (brainstorming)

## Objectif

PWA (Android + iOS) rappelant les anniversaires à souhaiter. Liste familiale partagée, notifications push, hébergement Cloudflare serverless, backup sur R2.

## Décisions verrouillées

| Sujet | Décision |
|-------|----------|
| Utilisateurs | Multi-comptes (login), 2-5 personnes |
| Données | Liste familiale **commune** : tous voient et éditent la même liste |
| Notifications | Jour J **+** rappel X jours avant ; délai global réglable ; **tous** les users notifiés en même temps |
| Champs anniversaire | Nom + Date. Année de naissance facultative → âge calculé si fournie |
| Hébergement | **Cloudflare serverless** (Option 1) — 0 machine à maintenir, gratuit à cette échelle, push robustes |
| Auth | Email + mot de passe + **code d'invitation** pour gater l'inscription (aucun service email requis) |
| Timezone | `Europe/Paris` (heure de notification) |
| 29 février | Années non-bissextiles → notifier le **28/02** (principe : plus tôt que trop tard) |

## Stack technique

- **Front :** React 19 (composants fonctionnels) + Vite + `vite-plugin-pwa`, TypeScript strict (pas de `any`) → Cloudflare **Pages**
- **API :** Cloudflare **Workers** + Hono (routeur léger)
- **DB :** **D1** (SQLite)
- **Scheduler :** Cloudflare **Cron Triggers** (1×/jour)
- **Push :** Web Push VAPID envoyé depuis le Worker
- **Backup :** Worker planifié → dump D1 → bucket **R2**
- **Auth :** hash PBKDF2 via Web Crypto, session JWT en cookie, code d'invitation en variable d'environnement

## Contrainte iOS (à respecter dans l'implémentation)

Web push sur iPhone fonctionne uniquement si :
- iOS 16.4+
- PWA **installée** sur l'écran d'accueil (pas seulement ouverte dans Safari)
- L'app a été ouverte au moins une fois (enregistrement du service worker)

L'UI doit donc guider explicitement l'utilisateur iOS vers « Ajouter à l'écran d'accueil » puis l'activation des notifications.

## Modèle de données (D1)

```sql
users(
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
)

birthdays(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  birth_month INTEGER NOT NULL,   -- 1-12
  birth_day INTEGER NOT NULL,     -- 1-31
  birth_year INTEGER,             -- NULL si inconnu
  created_by INTEGER NOT NULL,    -- users.id
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

push_subscriptions(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
)

settings(
  id INTEGER PRIMARY KEY CHECK (id = 1),   -- singleton
  reminder_days_before INTEGER NOT NULL,   -- ex: 7
  notify_hour INTEGER NOT NULL,            -- ex: 8 (heure locale Europe/Paris)
  timezone TEXT NOT NULL                   -- 'Europe/Paris'
)
```

Date stockée en mois/jour séparés (+ année nullable) → match annuel trivial, indépendant de l'année courante. Âge calculé à l'affichage et dans la notif si `birth_year` présent.

## Composants (unités isolées)

Chaque unité a un rôle unique, une interface définie, testable indépendamment.

1. **PWA shell** — manifest, service worker, prompt d'installation, gestion de l'abonnement push (permission + souscription navigateur).
2. **Auth module** — signup (vérifie le code d'invitation), login, middleware de session.
3. **Birthdays API** — CRUD de la liste partagée (toute personne connectée peut créer/éditer/supprimer).
4. **Settings API** — lecture/écriture du délai global, heure de notification, timezone.
5. **Push service** — enregistre et purge les subscriptions, envoie les notifications VAPID.
6. **Scheduler (cron)** — calcule les anniversaires à notifier ce jour, déclenche les push.
7. **Backup (cron)** — exporte D1 vers R2.

## Flux principaux

### Inscription
`email + mot de passe + code d'invitation` → si code valide et email non utilisé → création user (hash PBKDF2) → session.

### Connexion
`email + mot de passe` → vérification hash → session JWT en cookie.

### CRUD anniversaires
Liste unique partagée. Tout utilisateur connecté peut ajouter / modifier / supprimer.

### Activation des notifications
Le PWA shell demande la permission, souscrit via le service worker, envoie `{endpoint, p256dh, auth}` à l'API → stocké dans `push_subscriptions` lié au user.

### Notification quotidienne (cœur)
Cron quotidien réglé pour déclencher à `notify_hour` heure `Europe/Paris` (le cron tourne en UTC, conversion appliquée).

Pour chaque anniversaire, match si :
- `(birth_month, birth_day) == aujourd'hui` → **jour J**
- **ou** `(birth_month, birth_day) == aujourd'hui + reminder_days_before` → **rappel anticipé**

Règle 29/02 : un anniversaire du 29/02 est traité comme le 28/02 les années non-bissextiles.

→ Envoi d'une push à **toutes** les subscriptions.
Texte :
- Jour J : `🎂 Aujourd'hui : anniversaire de {nom}{ (âge ans) si année}`
- Rappel : `Dans {X} jours : anniversaire de {nom}`

### Backup
Worker planifié exporte le contenu D1 (dump SQL / JSON) vers R2, fichier horodaté.

## Gestion d'erreurs

- **Push expirée** (HTTP 404/410 du service de push) → suppression automatique de la subscription concernée.
- **Code d'invitation invalide** ou **email déjà utilisé** → rejet avec message clair.
- **D1 indisponible** pendant le cron → log + skip ; le cron du lendemain rejoue (pas de double-envoi car match basé sur la date du jour).
- **Permission push refusée** côté client → l'UI explique et propose de réessayer.

## Tests

- **Unit :** logique de match de dates (le point dur — gestion 29/02, fenêtre rappel, calcul `aujourd'hui + N`), calcul d'âge.
- **Integration :** endpoints API (signup/login/CRUD/settings) avec Vitest + workerd/Miniflare.
- **Push :** envoi mocké ; vérifie purge sur 410, ciblage de toutes les subscriptions.

## Hors périmètre (YAGNI)

- Photos, notes/idées cadeaux, lien de parenté, téléphone.
- Listes privées ou partage sélectif (liste unique commune uniquement).
- Réglage de notif par anniversaire ou par utilisateur (délai global unique).
- Notifications natives App Store / Play Store (PWA web push uniquement).
