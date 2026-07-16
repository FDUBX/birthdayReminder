<div align="center">

<img src="assets/readme/hero.svg" alt="BirthdayReminder — ne rate plus jamais un anniversaire à souhaiter. PWA familiale, notifications push, serverless Cloudflare." width="100%">

<p>
  <a href="https://bday-worker.francois-dubeaux.workers.dev"><img alt="Production live" src="https://img.shields.io/badge/prod-live-e85d75?style=flat-square"></a>
  <img alt="71 tests passing" src="https://img.shields.io/badge/tests-71%20passing-3f9d6d?style=flat-square">
  <img alt="Cloudflare Workers D1 R2" src="https://img.shields.io/badge/Cloudflare-Workers%20%C2%B7%20D1%20%C2%B7%20R2-f0748c?style=flat-square">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?style=flat-square">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-2f6f9f?style=flat-square">
</p>

### [→ Ouvrir l'application](https://bday-worker.francois-dubeaux.workers.dev)

</div>

> **PWA (Android + iOS)** qui rappelle les anniversaires d'une famille via notifications push.
> Stack **100 % serverless Cloudflare** (un seul Worker sert la PWA *et* l'API), base D1 (SQLite), backups R2.

**Production :** https://bday-worker.francois-dubeaux.workers.dev
**DB D1 :** `bday-db` (`918bd6e7-889c-4929-87a2-7ab4c6ec2a07`) · **Bucket R2 :** `bday-backups`

---

## Sommaire

1. [TL;DR — redéployer](#1-tldr--redéployer-le-cas-courant)
2. [Architecture](#2-architecture)
3. [Structure du repo](#3-structure-du-repo)
4. [Développement local](#4-développement-local)
5. [Tests](#5-tests)
6. [Premier déploiement (from scratch)](#6-premier-déploiement-from-scratch)
7. [Gérer les secrets](#7-gérer-les-secrets)
8. [Base de données (migrations, requêtes, restore)](#8-base-de-données)
9. [Backups R2](#9-backups-r2)
10. [Notifications push](#10-notifications-push)
11. [Installer la PWA (Android / iOS)](#11-installer-la-pwa)
12. [Troubleshooting](#12-troubleshooting)
13. [Aide-mémoire commandes](#13-aide-mémoire-commandes)
14. [Conventions Git](#14-conventions-git)

Specs détaillées : `docs/superpowers/specs/` · plan d'implémentation : `docs/superpowers/plans/`.

---

## 1. TL;DR — redéployer (le cas courant)

Après n'importe quel changement de code, depuis la **racine du repo** :

```bash
pnpm install                       # seulement si les deps ont changé
pnpm -r test                       # vérifier que tout passe (71 tests)
pnpm --filter web build            # IMPORTANT : régénère apps/web/dist (servi par le Worker)
pnpm --filter worker deploy:worker # déploie le Worker + les assets
```

> ⚠️ **Toujours `pnpm --filter web build` AVANT le deploy.** Le Worker uploade le dossier `apps/web/dist` tel quel ; sans rebuild, tu redéploies l'ancien front.
>
> ⚠️ Le script s'appelle **`deploy:worker`**, pas `deploy` (`pnpm deploy` est une commande **intégrée** de pnpm qui ferait autre chose).

Vérifier le déploiement :
```bash
curl https://bday-worker.francois-dubeaux.workers.dev/api/health   # → {"ok":true}
```

Côté navigateur/téléphone : **hard refresh** pour récupérer le nouveau service worker (mise à jour auto via `registerType: "autoUpdate"`, mais le hard refresh accélère).

---

## 2. Architecture

Monorepo pnpm, 3 packages :

| Package | Rôle |
|---------|------|
| `packages/shared` | Logique **pure** dates/notifications (calcul d'âge, 29 fév → 28, timezone Europe/Paris DST-aware, planner, tri prochain anniversaire). Entièrement testée. Importée par worker **et** web. |
| `apps/worker` | API Hono + handler cron (`scheduled`) sur Cloudflare Workers. Sert **aussi la PWA** via Static Assets. D1 + R2. |
| `apps/web` | PWA React 19 + Vite (`vite-plugin-pwa`, injectManifest). Buildée dans `apps/web/dist`, servie par le Worker. |

**Un seul Worker sert tout** (PWA + API) via Cloudflare Static Assets → front et API **same-origin** → le cookie de session `httpOnly`/`SameSite=Lax` accompagne `/api/*`, aucun routing multi-domaine.

Routage interne (`apps/worker/src/index.ts`) :
- `/api/*` → routes Hono ; route inconnue sous `/api/` → JSON 404
- tout le reste → assets statiques ; route client inexistante (`/settings`, …) → `index.html` (fallback SPA, `not_found_handling = "single-page-application"`)

**Choix techniques notables :**
- **Auth :** email + mot de passe (PBKDF2 via Web Crypto, comparaison timing-safe) + **code d'invitation** gateant l'inscription. Session = JWT (HS256) en cookie `httpOnly`.
- **Push :** Web Push VAPID via **`web-push-browser`** (Web-Crypto natif, tourne sur Workers). ⚠️ **Pas** le paquet `web-push` classique (dépend de `node:crypto`, casse sur workerd).
- **Notif :** cron **horaire** (`0 * * * *`) qui ne déclenche l'envoi qu'à `notify_hour` heure **Europe/Paris** (DST géré via `Intl`). Jour J + rappel `reminder_days_before` jours avant. **Tous** les appareils abonnés sont notifiés. Abonnement mort (404/410) → purgé automatiquement.
- **Liste partagée :** un seul carnet d'anniversaires, visible/éditable par tous les comptes.
- **Backup :** dump JSON de toute la D1 → R2 quotidien à 03:00 Paris.

---

## 3. Structure du repo

```
birthdayReminder/
├── package.json                  # racine monorepo (scripts -r)
├── pnpm-workspace.yaml
├── packages/shared/
│   ├── src/
│   │   ├── dates.ts              # ageFromYear, currentAge, isLeap, addDays,
│   │   │                         #   birthdayOnDate, parisToday, parisHour,
│   │   │                         #   daysUntilNextBirthday
│   │   ├── planner.ts            # planNotifications (pur, cœur du cron)
│   │   ├── types.ts              # Birthday, Settings, PlannedNotification…
│   │   └── index.ts
│   └── test/                     # dates.test.ts, planner.test.ts
└── apps/
    ├── worker/
    │   ├── wrangler.toml         # config Worker : D1, R2, [assets], cron
    │   ├── migrations/0001_init.sql
    │   ├── scripts/gen-vapid.mjs # génération des clés VAPID
    │   ├── src/
    │   │   ├── index.ts          # app Hono + fetch + scheduled + catch-all assets
    │   │   ├── env.ts            # type Env (bindings)
    │   │   ├── auth/             # password.ts, session.ts, middleware.ts
    │   │   ├── routes/           # signup, login, birthdays, settings, push
    │   │   ├── push/send.ts      # sendPush (web-push-browser) + dead-sub
    │   │   └── cron/             # notify.ts, backup.ts
    │   └── test/                 # *.test.ts (vitest pool workers)
    └── web/
        ├── vite.config.ts        # plugin React + PWA + manifest + proxy /api
        ├── public/icon*.png|svg  # icônes PWA
        └── src/
            ├── main.tsx, App.tsx # routing
            ├── api.ts            # client fetch typé (NE PAS coupler à l'UI)
            ├── auth.tsx          # AuthContext
            ├── sw.ts             # service worker (push + notificationclick)
            ├── sw-push.ts        # enablePush, détection iOS/standalone
            ├── styles.css        # design system claymorphism
            ├── components/       # BirthdayForm, IosInstallHint, icons
            └── pages/            # Login, Signup, Birthdays, Settings
```

---

## 4. Développement local

```bash
pnpm install

# 1) migrer la base D1 LOCALE (séparée de la prod !)
pnpm --filter worker migrate:local

# 2) lancer les deux serveurs (deux terminaux)
pnpm dev:worker      # API + assets sur http://localhost:8787
pnpm dev:web         # PWA sur http://localhost:5173 (proxy /api → :8787)
```

Ouvre http://localhost:5173. Le proxy Vite redirige `/api/*` vers le Worker local (`:8787`).

> ⚠️ La D1 **locale** est un fichier SQLite distinct de la prod, dans `apps/worker/.wrangler/`. Elle doit être migrée séparément (`migrate:local`). Oublier ça → **HTTP 500 `no such table`** sur login/birthdays (voir [Troubleshooting](#12-troubleshooting)).

Pour des données locales : crée un compte via l'UI (le `INVITE_CODE` local par défaut n'existe pas tant que tu ne définis pas de secret local — en dev, mets-le dans un fichier `apps/worker/.dev.vars`) :

```
# apps/worker/.dev.vars   (gitignored)
JWT_SECRET=dev-secret
INVITE_CODE=DEV
VAPID_PUBLIC_KEY=...        # via node scripts/gen-vapid.mjs
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:dev@example.com
```

---

## 5. Tests

```bash
pnpm -r test                       # tout (71 tests : shared 30 + worker 39 + web 2)
pnpm --filter @bday/shared test    # logique pure (rapide, pas de runtime Workers)
pnpm --filter worker test          # intégration API (vitest-pool-workers + D1 réelle en mémoire)
pnpm --filter web test             # composant (vitest + jsdom)
pnpm -r build                      # typecheck strict partout + build PWA
```

Les tests worker démarrent `workerd` localement (vitest-pool-workers). Si tu vois des erreurs `ConnectEx` / `semaphore timeout`, c'est l'OS, pas le code → voir [Troubleshooting](#12-troubleshooting).

---

## 6. Premier déploiement (from scratch)

À faire **une seule fois** (déjà fait pour la prod actuelle). Utile si tu recrées l'environnement.

```bash
cd apps/worker
npx wrangler login                      # auth navigateur ; vérifier : npx wrangler whoami
```

**1. Créer les ressources**
```bash
npx wrangler d1 create bday-db          # copie le database_id affiché
npx wrangler r2 bucket create bday-backups
```

**2. Mettre l'id de la DB dans `apps/worker/wrangler.toml`**
```toml
[[d1_databases]]
binding = "DB"
database_name = "bday-db"
database_id = "<UUID renvoyé à l'étape 1>"
```
(Récupérable à tout moment : `npx wrangler d1 list`.)

**3. Générer les clés VAPID**
```bash
node scripts/gen-vapid.mjs              # imprime VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```
⚠️ **Ne PAS** utiliser `npx web-push generate-vapid-keys` — le chiffrement utilise `web-push-browser`, les clés doivent venir de son propre sérialiseur (`scripts/gen-vapid.mjs`).

**4. Définir les secrets** (voir [section 7](#7-gérer-les-secrets))

**5. Migrer la base distante**
```bash
pnpm --filter worker migrate:remote
```

**6. Build + deploy**
```bash
cd ../..
pnpm --filter web build
pnpm --filter worker deploy:worker
```

---

## 7. Gérer les secrets

5 secrets, définis **un par un** (la valeur se tape au prompt, **pas** en argument) :

```bash
cd apps/worker
npx wrangler secret put JWT_SECRET          # chaîne aléatoire longue, ex: openssl rand -base64 32
npx wrangler secret put INVITE_CODE         # code que la famille tape à l'inscription
npx wrangler secret put VAPID_PUBLIC_KEY    # depuis gen-vapid.mjs
npx wrangler secret put VAPID_PRIVATE_KEY   # depuis gen-vapid.mjs
npx wrangler secret put VAPID_SUBJECT       # mailto:fran.dub@gmail.com
```

> ⚠️ `wrangler secret put NOM valeur` **ne marche pas** — la valeur en argument est ignorée. Lance la commande seule puis colle au prompt, ou pipe : `echo "valeur" | npx wrangler secret put NOM`.

Lister / supprimer :
```bash
npx wrangler secret list
npx wrangler secret delete NOM
```

| Secret | Rôle |
|--------|------|
| `JWT_SECRET` | signature des sessions JWT. **Le changer déconnecte tout le monde.** |
| `INVITE_CODE` | gate d'inscription. À communiquer à la famille. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | clés Web Push. **Les changer invalide tous les abonnements push** (il faut réactiver les notifs sur chaque appareil). |
| `VAPID_SUBJECT` | contact VAPID, format `mailto:`. |

Bindings non-secrets (dans `wrangler.toml`) : `DB` (D1), `BACKUPS` (R2), `ASSETS` (PWA).

---

## 8. Base de données

SQLite via Cloudflare D1. Schéma : `apps/worker/migrations/0001_init.sql`.

Tables : `users`, `birthdays` (liste partagée), `push_subscriptions`, `settings` (ligne unique id=1 : `reminder_days_before`, `notify_hour`, `timezone`).

**Migrations**
```bash
pnpm --filter worker migrate:local     # base locale (dev)
pnpm --filter worker migrate:remote    # base prod
```
Nouvelle migration : ajoute `apps/worker/migrations/0002_xxx.sql` (numéroté), puis relance `migrate:remote`.

**Requêtes ad hoc**
```bash
cd apps/worker
npx wrangler d1 execute bday-db --remote --command "SELECT id, name, birth_month, birth_day, birth_year FROM birthdays"
npx wrangler d1 execute bday-db --remote --command "SELECT email FROM users"
# local : remplacer --remote par --local
```

**Restore depuis un backup R2** (voir section suivante) : récupère le JSON, puis réinsère via `d1 execute` ou un fichier `.sql`.

---

## 9. Backups R2

Le cron sauvegarde toute la base en JSON dans R2, chaque jour à **03:00 Paris** : `backups/AAAA-MM-JJ.json`.

```bash
cd apps/worker
npx wrangler r2 object get bday-backups/backups/2026-06-30.json --file ./backup.json --remote
# lister via le dashboard Cloudflare → R2 → bday-backups → backups/
```

Le dump contient `users`, `birthdays`, `subscriptions`, `settings` + `generated_at`.

---

## 10. Notifications push

- Le cron tourne **toutes les heures** mais n'envoie qu'à `notify_hour` (Réglages, heure Europe/Paris).
- Envoie pour : anniversaire **aujourd'hui** + anniversaires dans **`reminder_days_before`** jours.
- Tous les appareils abonnés reçoivent. Abonnement expiré (HTTP 404/410) → supprimé automatiquement.

**Tester sans attendre :**
```bash
cd apps/worker
npx wrangler tail                       # logs live du Worker (voir les exécutions cron)
```
Ou : dashboard Cloudflare → Workers → `bday-worker` → Triggers → déclencher le cron manuellement. Mets un anniversaire daté aujourd'hui et `notify_hour` = heure courante.

`reminder_days_before` et `notify_hour` se règlent dans l'écran **Réglages** de l'app (globaux, partagés).

---

## 11. Installer la PWA

- **Android (Chrome) :** menu ⋮ → « Installer l'application » → ouvrir → Réglages → activer les notifications.
- **iPhone/iPad (Safari, iOS 16.4+) :**
  1. Partager → « Sur l'écran d'accueil »
  2. **Rouvrir depuis l'icône** (le push ne marche QUE en mode installé)
  3. Réglages de l'app → activer les notifications

L'écran Réglages affiche un rappel tant que l'app n'est pas en mode standalone sur iOS.

---

## 12. Troubleshooting

| Symptôme | Cause | Fix |
|----------|-------|-----|
| `ERR_PNPM_INVALID_DEPLOY_TARGET This command requires one parameter` | `pnpm deploy` est une commande intégrée pnpm qui masque le script | Utiliser `pnpm --filter worker run deploy:worker` (le script s'appelle `deploy:worker`) |
| Déploiement réussi mais **ancien front** affiché | Oubli du rebuild | `pnpm --filter web build` **avant** `deploy:worker` ; côté client, hard refresh |
| `The database 00000000-... could not be found [code: 7404]` | `database_id` placeholder dans `wrangler.toml` | Mettre l'UUID réel (`npx wrangler d1 list`) |
| **HTTP 500** en local sur login/birthdays (`no such table: users`) | D1 **locale** pas migrée | `pnpm --filter worker migrate:local` |
| Tests worker : `ConnectEx #1225 / #121 semaphore timeout`, `Fallback service failed to fetch module` | État socket/winsock Windows dégradé (sessions longues, process node orphelins) — **pas le code** | **Reboot** le PC. (Vérif : `shared` + `web` passent quand même ; le code worker est inchangé.) |
| Push iOS ne marche pas | PWA pas installée sur l'écran d'accueil, ou iOS < 16.4 | Installer via « Sur l'écran d'accueil », rouvrir depuis l'icône, activer les notifs |
| Login échoue silencieusement / boucle | (théorique) front et API pas same-origin | On sert tout depuis le Worker → déjà same-origin. Ne pas séparer sur deux domaines. |
| `npx wrangler` tire la **v4** | npx prend la dernière | Sans gravité pour `d1 list` ; pour le reste **utiliser les scripts pnpm** (wrangler 3.114 épinglé, cohérent avec la config testée) |
| Build web émet des `.js` dans `src/` | `tsc -b` (build mode) émet — corrigé : build = `tsc --noEmit && vite build` | Déjà géré ; les `.js`/`.tsbuildinfo` sont gitignorés |

**Nettoyer les process orphelins (Windows, sans reboot) :**
```powershell
Get-Process workerd,esbuild -ErrorAction SilentlyContinue | Stop-Process -Force
# ne PAS mass-kill `node` (tuerait l'éditeur / le terminal)
```

---

## 13. Aide-mémoire commandes

```bash
# Dev
pnpm install
pnpm --filter worker migrate:local
pnpm dev:worker                          # :8787
pnpm dev:web                             # :5173

# Qualité
pnpm -r test
pnpm -r build

# Déploiement
pnpm --filter web build
pnpm --filter worker migrate:remote      # seulement si nouvelle migration
pnpm --filter worker deploy:worker

# Ops (depuis apps/worker)
npx wrangler whoami
npx wrangler tail                        # logs live
npx wrangler d1 list
npx wrangler d1 execute bday-db --remote --command "SELECT ..."
npx wrangler secret list
npx wrangler r2 object get bday-backups/backups/<date>.json --file ./b.json --remote

# Vérifier la prod
curl https://bday-worker.francois-dubeaux.workers.dev/api/health
```

---

## 14. Conventions Git

- Conventional commits : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Branches : `feature/<nom>`, `fix/<nom>`, `chore/<nom>`, `docs/<nom>`.
- Pas de push direct sur `main` → branche + PR + merge (`gh pr create` / `gh pr merge --merge`).
- `main` est la branche déployée.
