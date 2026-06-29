# BirthdayReminder

PWA (Android + iOS) rappelant les anniversaires d'une famille via notifications push. Stack 100 % serverless Cloudflare, backups sur R2.

- **Spec :** `docs/superpowers/specs/2026-06-29-birthday-reminder-design.md`
- **Plan :** `docs/superpowers/plans/2026-06-29-birthday-reminder.md`

## Architecture

Monorepo pnpm :

| Package | Rôle |
|---------|------|
| `packages/shared` | Logique pure dates/notifications (Feb 29 → 28, timezone Europe/Paris, planner). Testée. |
| `apps/worker` | API Hono + cron (`scheduled`) sur Cloudflare Workers. D1 (SQLite) + R2. |
| `apps/web` | PWA React 19 + Vite (`vite-plugin-pwa`, injectManifest). Cloudflare Pages ou Worker assets. |

- **Auth :** email + mot de passe (PBKDF2, Web Crypto) + code d'invitation. Session = JWT en cookie `httpOnly`.
- **Push :** Web Push VAPID via `web-push-browser` (Web-Crypto natif, compatible Workers). Pas de `web-push` (dépend de `node:crypto`).
- **Notif :** cron horaire, ne déclenche qu'à `notify_hour` (heure Europe/Paris, DST géré). Jour J + rappel `reminder_days_before` jours avant. Tous les abonnés notifiés.
- **Backup :** dump JSON D1 → R2 quotidien à 03:00 Paris.

## Développement local

```bash
pnpm install
pnpm --filter worker migrate:local      # applique le schéma D1 en local
pnpm dev:worker                          # API sur http://localhost:8787
pnpm dev:web                             # PWA sur http://localhost:5173 (proxy /api → :8787)
pnpm -r test                             # 62 tests (shared + worker + web)
pnpm -r build                            # typecheck + build PWA
```

## Déploiement Cloudflare

### 1. Ressources

```bash
cd apps/worker
wrangler d1 create bday-db               # copier database_id dans wrangler.toml
wrangler r2 bucket create bday-backups
```

### 2. Clés VAPID

```bash
cd apps/worker
node scripts/gen-vapid.mjs               # génère les clés au format web-push-browser
```

⚠️ **Ne pas** utiliser `npx web-push generate-vapid-keys` : le chiffrement utilise `web-push-browser`, les clés doivent venir de son propre sérialiseur (`scripts/gen-vapid.mjs`).

### 3. Secrets

```bash
cd apps/worker
wrangler secret put JWT_SECRET           # longue chaîne aléatoire
wrangler secret put INVITE_CODE          # code d'invitation famille
wrangler secret put VAPID_PUBLIC_KEY     # depuis gen-vapid.mjs
wrangler secret put VAPID_PRIVATE_KEY    # depuis gen-vapid.mjs
wrangler secret put VAPID_SUBJECT        # ex: mailto:toi@example.com
```

### 4. Migrations + déploiement Worker

```bash
pnpm --filter worker migrate:remote
pnpm --filter worker deploy
```

### 5. Front (Cloudflare Pages)

- Build command : `pnpm --filter web build`
- Output : `apps/web/dist`

### ⚠️ Exigence same-origin (cookie de session)

La session est un cookie `httpOnly` + `SameSite=Lax`. Le front et l'API **doivent être servis sur le même hostname**, sinon le cookie n'accompagne pas les requêtes `/api/*` (le login échoue silencieusement).

Configurer un domaine unique, ex. `anniv.example.com` :
- Pages sert `anniv.example.com/*`
- Une route Worker `anniv.example.com/api/*` pointe vers `bday-worker`

(Alternative : servir le `dist/` directement depuis le Worker via Static Assets, en laissant Hono répondre sur `/api/*` et fallback assets pour le reste.)

## Notifications iOS — obligatoire

Le web push sur iPhone/iPad ne fonctionne que si :
1. iOS 16.4+
2. La PWA est **ajoutée à l'écran d'accueil** (Partager → Sur l'écran d'accueil)
3. Ouverte au moins une fois depuis l'icône, puis notifications activées dans Réglages de l'app

L'écran Réglages affiche un rappel (`IosInstallHint`) tant que l'app n'est pas en mode standalone sur iOS.

## Variables / bindings Worker

| Binding / secret | Type | Rôle |
|------------------|------|------|
| `DB` | D1 | base de données |
| `BACKUPS` | R2 | backups JSON |
| `JWT_SECRET` | secret | signature session |
| `INVITE_CODE` | secret | gate inscription |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | secret | clés Web Push |
| `VAPID_SUBJECT` | secret | contact VAPID (`mailto:`) |
