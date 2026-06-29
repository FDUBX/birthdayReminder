# BirthdayReminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA (Android + iOS) that reminds a small family of birthdays via web push, on a fully serverless Cloudflare stack with R2 backups.

**Architecture:** pnpm monorepo. `apps/worker` = Hono API + scheduled (cron) handler on Cloudflare Workers, using D1 (SQLite) and R2. `apps/web` = React 19 + Vite PWA deployed to Cloudflare Pages. `packages/shared` = pure, fully-tested date/age logic used by both. Notifications are computed by a pure planner (`planNotifications`) fed the current time, so it is deterministic and testable; the cron handler only does I/O (read D1, send push, purge dead subscriptions, backup).

**Tech Stack:** TypeScript (strict, no `any`), Hono, Cloudflare D1 / R2 / Cron Triggers, `jose` (JWT), Web Crypto `SubtleCrypto` (PBKDF2 password hashing), `pushforge` (VAPID web push), React 19, Vite, `vite-plugin-pwa`, Vitest, `@cloudflare/vitest-pool-workers`, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-29-birthday-reminder-design.md`

**Bindings & secrets (Worker):**
- D1 binding `DB`, R2 binding `BACKUPS`
- Secrets: `JWT_SECRET`, `INVITE_CODE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)

---

## File Structure

```
birthdayReminder/
  pnpm-workspace.yaml
  package.json                      # root, scripts only
  .gitignore
  packages/
    shared/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        dates.ts                    # isLeap, addDays, parisToday, parisHour, birthdayOnDate, ageFromYear
        planner.ts                  # planNotifications (pure)
        types.ts                    # Birthday, Settings, PlannedNotification, Subscription
      test/
        dates.test.ts
        planner.test.ts
  apps/
    worker/
      package.json
      wrangler.toml
      tsconfig.json
      vitest.config.ts
      migrations/
        0001_init.sql
      src/
        index.ts                    # Hono app + fetch + scheduled exports
        env.ts                      # Env type (bindings)
        auth/
          password.ts               # hashPassword, verifyPassword (PBKDF2)
          session.ts                # signSession, verifySession (jose)
          middleware.ts             # requireAuth
        routes/
          signup.ts
          login.ts
          birthdays.ts
          settings.ts
          push.ts
        push/
          send.ts                   # sendPush (pushforge) + dead-subscription detection
        cron/
          notify.ts                 # runNotifications (reads D1, calls planner, sends)
          backup.ts                 # runBackup (D1 -> R2)
      test/
        password.test.ts
        session.test.ts
        signup.test.ts
        login.test.ts
        birthdays.test.ts
        settings.test.ts
        push.test.ts
        notify.test.ts
        backup.test.ts
    web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      public/
        icon-192.png                # placeholder icons (replace later)
        icon-512.png
      src/
        main.tsx
        App.tsx
        api.ts                      # typed fetch client
        auth.tsx                    # AuthContext/provider
        sw-push.ts                  # subscribe/unsubscribe push
        pages/
          Login.tsx
          Signup.tsx
          Birthdays.tsx
          Settings.tsx
        components/
          BirthdayForm.tsx
          IosInstallHint.tsx
      test/
        BirthdayForm.test.tsx
```

---

## Phase 0 — Scaffold

### Task 1: Root workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "birthday-reminder",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev:web": "pnpm --filter web dev",
    "dev:worker": "pnpm --filter worker dev"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.wrangler/
.dev.vars
*.local
coverage/
```

- [ ] **Step 4: Install and commit**

Run: `pnpm install`
Expected: lockfile created, no errors.

```bash
git add pnpm-workspace.yaml package.json .gitignore pnpm-lock.yaml
git commit -m "chore: init pnpm monorepo"
```

---

### Task 2: shared package scaffold

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@bday/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "build": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true },
});
```

- [ ] **Step 4: Create `packages/shared/src/types.ts`**

```ts
export interface Birthday {
  id: number;
  name: string;
  birth_month: number; // 1-12
  birth_day: number;   // 1-31
  birth_year: number | null;
}

export interface Settings {
  reminder_days_before: number;
  notify_hour: number; // 0-23, local Europe/Paris
  timezone: string;    // "Europe/Paris"
}

export type NotificationKind = "today" | "reminder";

export interface PlannedNotification {
  birthday: Birthday;
  kind: NotificationKind;
  age: number | null; // computed for "today" when birth_year known
  daysUntil: number;  // 0 for today, reminder_days_before for reminder
}

export interface PushSubscriptionRecord {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from "./types";
export * from "./dates";
export * from "./planner";
```

- [ ] **Step 6: Install and commit**

Run: `pnpm install`

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "chore: scaffold shared package"
```

---

## Phase 1 — Core date logic (shared, pure TDD)

### Task 3: `ageFromYear`

**Files:**
- Create: `packages/shared/src/dates.ts`
- Test: `packages/shared/test/dates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/dates.test.ts
import { ageFromYear } from "../src/dates";

describe("ageFromYear", () => {
  it("returns age turned on the target date", () => {
    expect(ageFromYear(1990, 2026)).toBe(36);
  });
  it("returns null when birth year is null", () => {
    expect(ageFromYear(null, 2026)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bday/shared test`
Expected: FAIL — `ageFromYear` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/shared/src/dates.ts
export function ageFromYear(birthYear: number | null, targetYear: number): number | null {
  if (birthYear === null) return null;
  return targetYear - birthYear;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bday/shared test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/dates.ts packages/shared/test/dates.test.ts
git commit -m "feat(shared): ageFromYear"
```

---

### Task 4: date helpers — `isLeap`, `addDays`, `birthdayOnDate`

**Files:**
- Modify: `packages/shared/src/dates.ts`
- Test: `packages/shared/test/dates.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to packages/shared/test/dates.test.ts
import { isLeap, addDays, birthdayOnDate } from "../src/dates";

describe("isLeap", () => {
  it("2024 leap, 2025 not, 2000 leap, 1900 not", () => {
    expect(isLeap(2024)).toBe(true);
    expect(isLeap(2025)).toBe(false);
    expect(isLeap(2000)).toBe(true);
    expect(isLeap(1900)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month boundary", () => {
    expect(addDays({ year: 2026, month: 1, day: 28 }, 5)).toEqual({ year: 2026, month: 2, day: 2 });
  });
  it("crosses year boundary", () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({ year: 2027, month: 1, day: 2 });
  });
});

describe("birthdayOnDate", () => {
  it("matches exact month/day", () => {
    expect(birthdayOnDate(3, 15, { year: 2026, month: 3, day: 15 })).toBe(true);
    expect(birthdayOnDate(3, 15, { year: 2026, month: 3, day: 14 })).toBe(false);
  });
  it("Feb 29 birthday celebrated Feb 28 in non-leap year", () => {
    expect(birthdayOnDate(2, 29, { year: 2026, month: 2, day: 28 })).toBe(true);
    expect(birthdayOnDate(2, 29, { year: 2026, month: 3, day: 1 })).toBe(false);
  });
  it("Feb 29 birthday matches Feb 29 in leap year only", () => {
    expect(birthdayOnDate(2, 29, { year: 2024, month: 2, day: 29 })).toBe(true);
    expect(birthdayOnDate(2, 29, { year: 2024, month: 2, day: 28 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @bday/shared test`
Expected: FAIL — `isLeap` / `addDays` / `birthdayOnDate` not defined.

- [ ] **Step 3: Implement**

```ts
// append to packages/shared/src/dates.ts
export interface CalDate { year: number; month: number; day: number; }

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function addDays(date: CalDate, days: number): CalDate {
  const dt = new Date(Date.UTC(date.year, date.month - 1, date.day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function birthdayOnDate(birthMonth: number, birthDay: number, target: CalDate): boolean {
  if (birthMonth === 2 && birthDay === 29 && !isLeap(target.year)) {
    return target.month === 2 && target.day === 28;
  }
  return birthMonth === target.month && birthDay === target.day;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @bday/shared test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/dates.ts packages/shared/test/dates.test.ts
git commit -m "feat(shared): isLeap, addDays, birthdayOnDate with Feb29 rule"
```

---

### Task 5: timezone helpers — `parisToday`, `parisHour`

**Files:**
- Modify: `packages/shared/src/dates.ts`
- Test: `packages/shared/test/dates.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to packages/shared/test/dates.test.ts
import { parisToday, parisHour } from "../src/dates";

describe("parisToday / parisHour", () => {
  it("converts a known UTC instant to Paris calendar date (summer, +2)", () => {
    // 2026-07-01T23:30:00Z is 2026-07-02 01:30 in Paris
    const d = new Date("2026-07-01T23:30:00Z");
    expect(parisToday(d)).toEqual({ year: 2026, month: 7, day: 2 });
    expect(parisHour(d)).toBe(1);
  });
  it("converts a known UTC instant to Paris (winter, +1)", () => {
    // 2026-01-01T23:30:00Z is 2026-01-02 00:30 in Paris
    const d = new Date("2026-01-01T23:30:00Z");
    expect(parisToday(d)).toEqual({ year: 2026, month: 1, day: 2 });
    expect(parisHour(d)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @bday/shared test`
Expected: FAIL — `parisToday` / `parisHour` not defined.

- [ ] **Step 3: Implement**

```ts
// append to packages/shared/src/dates.ts
const TZ = "Europe/Paris";

export function parisToday(now: Date): CalDate {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

export function parisHour(now: Date): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", hourCycle: "h23",
  }).format(now); // "HH"
  return Number(s);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @bday/shared test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/dates.ts packages/shared/test/dates.test.ts
git commit -m "feat(shared): parisToday and parisHour (DST-aware)"
```

---

### Task 6: `planNotifications` (pure planner)

**Files:**
- Create: `packages/shared/src/planner.ts`
- Test: `packages/shared/test/planner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/planner.test.ts
import { planNotifications } from "../src/planner";
import type { Birthday, Settings } from "../src/types";

const settings: Settings = { reminder_days_before: 7, notify_hour: 8, timezone: "Europe/Paris" };
const now = new Date("2026-03-15T07:00:00Z"); // Paris 2026-03-15 08:00 (summer not yet; +1 => 08:00)

function bday(p: Partial<Birthday>): Birthday {
  return { id: 1, name: "X", birth_month: 1, birth_day: 1, birth_year: null, ...p };
}

describe("planNotifications", () => {
  it("plans a 'today' notification with age when year known", () => {
    const list = [bday({ id: 1, name: "Anna", birth_month: 3, birth_day: 15, birth_year: 1990 })];
    const out = planNotifications(list, settings, now);
    expect(out).toEqual([
      { birthday: list[0], kind: "today", age: 36, daysUntil: 0 },
    ]);
  });

  it("plans a 'reminder' notification reminder_days_before ahead", () => {
    const list = [bday({ id: 2, name: "Bob", birth_month: 3, birth_day: 22, birth_year: null })];
    const out = planNotifications(list, settings, now);
    expect(out).toEqual([
      { birthday: list[0], kind: "reminder", age: null, daysUntil: 7 },
    ]);
  });

  it("emits both when a birthday is both today and (for another) the reminder day", () => {
    const list = [
      bday({ id: 1, name: "Anna", birth_month: 3, birth_day: 15, birth_year: 2000 }),
      bday({ id: 2, name: "Bob", birth_month: 3, birth_day: 22 }),
    ];
    const out = planNotifications(list, settings, now);
    expect(out.map((n) => [n.birthday.name, n.kind])).toEqual([
      ["Anna", "today"],
      ["Bob", "reminder"],
    ]);
  });

  it("returns empty when nothing matches", () => {
    const list = [bday({ birth_month: 6, birth_day: 1 })];
    expect(planNotifications(list, settings, now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @bday/shared test`
Expected: FAIL — `planNotifications` not defined.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/planner.ts
import type { Birthday, Settings, PlannedNotification } from "./types";
import { parisToday, addDays, birthdayOnDate, ageFromYear } from "./dates";

export function planNotifications(
  birthdays: Birthday[],
  settings: Settings,
  now: Date,
): PlannedNotification[] {
  const today = parisToday(now);
  const reminderTarget = addDays(today, settings.reminder_days_before);
  const out: PlannedNotification[] = [];

  for (const b of birthdays) {
    if (birthdayOnDate(b.birth_month, b.birth_day, today)) {
      out.push({ birthday: b, kind: "today", age: ageFromYear(b.birth_year, today.year), daysUntil: 0 });
    } else if (
      settings.reminder_days_before > 0 &&
      birthdayOnDate(b.birth_month, b.birth_day, reminderTarget)
    ) {
      out.push({ birthday: b, kind: "reminder", age: null, daysUntil: settings.reminder_days_before });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @bday/shared test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/planner.ts packages/shared/test/planner.test.ts
git commit -m "feat(shared): planNotifications pure planner"
```

---

## Phase 2 — Worker scaffold + DB

### Task 7: Worker scaffold (Hono + wrangler + vitest pool)

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/wrangler.toml`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/vitest.config.ts`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/index.ts`

- [ ] **Step 1: Create `apps/worker/package.json`**

```json
{
  "name": "worker",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "build": "tsc --noEmit",
    "migrate:local": "wrangler d1 migrations apply bday-db --local",
    "migrate:remote": "wrangler d1 migrations apply bday-db --remote"
  },
  "dependencies": {
    "@bday/shared": "workspace:*",
    "hono": "^4.6.0",
    "jose": "^5.9.0",
    "pushforge": "^1.0.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20240909.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.78.0"
  }
}
```

> Note: confirm the latest `pushforge` version at install time with `pnpm view pushforge version`; pin the actual installed version.

- [ ] **Step 2: Create `apps/worker/wrangler.toml`**

```toml
name = "bday-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "bday-db"
database_id = "PLACEHOLDER_SET_AFTER_CREATE"  # set in Task 25

[[r2_buckets]]
binding = "BACKUPS"
bucket_name = "bday-backups"

[triggers]
crons = ["0 * * * *"]  # hourly; handler fires only at notify_hour Europe/Paris
```

- [ ] **Step 3: Create `apps/worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `apps/worker/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          r2Buckets: ["BACKUPS"],
          bindings: {
            JWT_SECRET: "test-secret",
            INVITE_CODE: "FAMILY2026",
            VAPID_PUBLIC_KEY: "test-public",
            VAPID_PRIVATE_KEY: "test-private",
            VAPID_SUBJECT: "mailto:test@example.com",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 5: Create `apps/worker/src/env.ts`**

```ts
export interface Env {
  DB: D1Database;
  BACKUPS: R2Bucket;
  JWT_SECRET: string;
  INVITE_CODE: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
```

- [ ] **Step 6: Create `apps/worker/src/index.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext) {
    // wired in Task 17 & 18
  },
};
```

- [ ] **Step 7: Install, typecheck, commit**

Run: `pnpm install && pnpm --filter worker build`
Expected: no type errors.

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "chore: scaffold cloudflare worker (hono + wrangler + vitest pool)"
```

---

### Task 8: D1 schema migration

**Files:**
- Create: `apps/worker/migrations/0001_init.sql`
- Test: `apps/worker/test/migrate.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- apps/worker/migrations/0001_init.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  birth_month INTEGER NOT NULL,
  birth_day INTEGER NOT NULL,
  birth_year INTEGER,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reminder_days_before INTEGER NOT NULL,
  notify_hour INTEGER NOT NULL,
  timezone TEXT NOT NULL
);

INSERT INTO settings (id, reminder_days_before, notify_hour, timezone)
VALUES (1, 7, 8, 'Europe/Paris');
```

- [ ] **Step 2: Write a test that applies migration and reads seed**

```ts
// apps/worker/test/migrate.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("schema", () => {
  it("seeds the settings singleton", async () => {
    const row = await env.DB.prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1").first();
    expect(row).toEqual({ reminder_days_before: 7, notify_hour: 8, timezone: "Europe/Paris" });
  });
});
```

> `env.TEST_MIGRATIONS` is provided automatically by `@cloudflare/vitest-pool-workers` when migrations live in the configured directory. If your version requires explicit wiring, add to `vitest.config.ts` miniflare options: read migrations via the pool's `readD1Migrations` helper. Verify against the installed pool version's README.

- [ ] **Step 3: Run to verify it fails (no migration applied yet / table missing) then passes once migration is picked up**

Run: `pnpm --filter worker test migrate`
Expected: PASS after migration file is present.

- [ ] **Step 4: Apply locally to confirm wrangler accepts it**

Run: `pnpm --filter worker migrate:local`
Expected: "Migrations applied successfully" (after `database_id` is set, or with `--local` which does not require remote id).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/migrations apps/worker/test/migrate.test.ts
git commit -m "feat(worker): D1 schema + settings seed"
```

---

## Phase 3 — Auth

### Task 9: Password hashing (PBKDF2 via Web Crypto)

**Files:**
- Create: `apps/worker/src/auth/password.ts`
- Test: `apps/worker/test/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/password.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password";

describe("password", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", stored)).toBe(true);
  });
  it("rejects a wrong password", async () => {
    const stored = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  it("produces a different salt each time", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test password`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/auth/password.ts
const ITERATIONS = 100_000;
const KEY_LEN = 32;

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, KEY_LEN * 8);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toB64(salt.buffer)}$${toB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const salt = fromB64(saltB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: Number(iterStr), hash: "SHA-256" }, key, KEY_LEN * 8,
  );
  return toB64(bits) === hashB64;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter worker test password`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/auth/password.ts apps/worker/test/password.test.ts
git commit -m "feat(worker): PBKDF2 password hashing"
```

---

### Task 10: Session JWT (`jose`)

**Files:**
- Create: `apps/worker/src/auth/session.ts`
- Test: `apps/worker/test/session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/session.test.ts
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/auth/session";

const secret = "test-secret";

describe("session", () => {
  it("round-trips a user id", async () => {
    const token = await signSession({ userId: 42 }, secret);
    const payload = await verifySession(token, secret);
    expect(payload?.userId).toBe(42);
  });
  it("rejects a tampered token", async () => {
    const token = await signSession({ userId: 42 }, secret);
    expect(await verifySession(token + "x", secret)).toBeNull();
  });
  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ userId: 42 }, "other");
    expect(await verifySession(token, secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test session`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/auth/session.ts
import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload { userId: number; }

const ALG = "HS256";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    if (typeof payload.userId !== "number") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter worker test session`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/auth/session.ts apps/worker/test/session.test.ts
git commit -m "feat(worker): JWT session sign/verify"
```

---

### Task 11: Auth middleware

**Files:**
- Create: `apps/worker/src/auth/middleware.ts`

- [ ] **Step 1: Implement (covered indirectly by route tests in later tasks)**

```ts
// apps/worker/src/auth/middleware.ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifySession } from "./session";

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: { userId: number };
}>(async (c, next) => {
  const token = getCookie(c, "session");
  const session = token ? await verifySession(token, c.env.JWT_SECRET) : null;
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.userId);
  await next();
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter worker build`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/auth/middleware.ts
git commit -m "feat(worker): requireAuth middleware"
```

---

### Task 12: Signup route

**Files:**
- Create: `apps/worker/src/routes/signup.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/signup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/signup.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => { await env.DB.exec("DELETE FROM users"); });

function post(body: unknown) {
  return app.request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, env);
}

describe("POST /api/signup", () => {
  it("creates a user with a valid invite code and sets a session cookie", async () => {
    const res = await post({ email: "a@b.com", password: "hunter2", inviteCode: "FAMILY2026" });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("session=");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
  it("rejects a wrong invite code", async () => {
    const res = await post({ email: "a@b.com", password: "hunter2", inviteCode: "WRONG" });
    expect(res.status).toBe(403);
  });
  it("rejects a duplicate email", async () => {
    await post({ email: "a@b.com", password: "hunter2", inviteCode: "FAMILY2026" });
    const res = await post({ email: "a@b.com", password: "other1", inviteCode: "FAMILY2026" });
    expect(res.status).toBe(409);
  });
  it("rejects a short password", async () => {
    const res = await post({ email: "a@b.com", password: "x", inviteCode: "FAMILY2026" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test signup`
Expected: FAIL — route returns 404.

- [ ] **Step 3: Implement the route**

```ts
// apps/worker/src/routes/signup.ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { hashPassword } from "../auth/password";
import { signSession } from "../auth/session";

export const signup = new Hono<{ Bindings: Env }>();

signup.post("/api/signup", async (c) => {
  const { email, password, inviteCode } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || password.length < 6) {
    return c.json({ error: "invalid input" }, 400);
  }
  if (inviteCode !== c.env.INVITE_CODE) {
    return c.json({ error: "bad invite code" }, 403);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "email already used" }, 409);

  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const result = await c.env.DB
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .bind(email, hash, now)
    .run();
  const userId = Number(result.meta.last_row_id);

  const token = await signSession({ userId }, c.env.JWT_SECRET);
  setCookie(c, "session", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.json({ id: userId, email }, 201);
});
```

- [ ] **Step 4: Wire into `index.ts`**

```ts
// apps/worker/src/index.ts  (add)
import { signup } from "./routes/signup";
app.route("/", signup);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test signup`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/routes/signup.ts apps/worker/src/index.ts apps/worker/test/signup.test.ts
git commit -m "feat(worker): signup with invite-code gate"
```

---

### Task 13: Login route

**Files:**
- Create: `apps/worker/src/routes/login.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/login.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/login.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { hashPassword } from "../src/auth/password";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM users");
  const hash = await hashPassword("hunter2");
  await env.DB.prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .bind("a@b.com", hash, new Date().toISOString()).run();
});

function post(body: unknown) {
  return app.request("/api/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }, env);
}

describe("POST /api/login", () => {
  it("logs in with correct credentials", async () => {
    const res = await post({ email: "a@b.com", password: "hunter2" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session=");
  });
  it("rejects wrong password", async () => {
    const res = await post({ email: "a@b.com", password: "nope" });
    expect(res.status).toBe(401);
  });
  it("rejects unknown email", async () => {
    const res = await post({ email: "x@y.com", password: "hunter2" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test login`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/routes/login.ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifyPassword } from "../auth/password";
import { signSession } from "../auth/session";

export const login = new Hono<{ Bindings: Env }>();

login.post("/api/login", async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return c.json({ error: "invalid input" }, 400);
  }
  const user = await c.env.DB
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email).first<{ id: number; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const token = await signSession({ userId: user.id }, c.env.JWT_SECRET);
  setCookie(c, "session", token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.json({ id: user.id, email });
});
```

- [ ] **Step 4: Wire into `index.ts`**

```ts
// apps/worker/src/index.ts  (add)
import { login } from "./routes/login";
app.route("/", login);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test login`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/routes/login.ts apps/worker/src/index.ts apps/worker/test/login.test.ts
git commit -m "feat(worker): login route"
```

---

## Phase 4 — Data API

### Task 14: Birthdays CRUD

**Files:**
- Create: `apps/worker/src/routes/birthdays.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/birthdays.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/birthdays.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { hashPassword } from "../src/auth/password";
import { signSession } from "../src/auth/session";

let cookie: string;

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM birthdays");
  await env.DB.exec("DELETE FROM users");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'a@b.com', ?, ?)")
    .bind(await hashPassword("x"), new Date().toISOString()).run();
  cookie = `session=${await signSession({ userId: 1 }, "test-secret")}`;
});

function req(path: string, init: RequestInit = {}) {
  return app.request(path, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } }, env);
}

describe("birthdays CRUD", () => {
  it("rejects unauthenticated access", async () => {
    const res = await app.request("/api/birthdays", {}, env);
    expect(res.status).toBe(401);
  });
  it("creates, lists, updates and deletes", async () => {
    const create = await req("/api/birthdays", { method: "POST", body: JSON.stringify({ name: "Anna", birth_month: 3, birth_day: 15, birth_year: 1990 }) });
    expect(create.status).toBe(201);
    const created = await create.json<{ id: number }>();

    const list = await req("/api/birthdays");
    expect((await list.json<unknown[]>()).length).toBe(1);

    const upd = await req(`/api/birthdays/${created.id}`, { method: "PUT", body: JSON.stringify({ name: "Anna B", birth_month: 3, birth_day: 15, birth_year: null }) });
    expect(upd.status).toBe(200);

    const del = await req(`/api/birthdays/${created.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const list2 = await req("/api/birthdays");
    expect((await list2.json<unknown[]>()).length).toBe(0);
  });
  it("validates month/day ranges", async () => {
    const res = await req("/api/birthdays", { method: "POST", body: JSON.stringify({ name: "Bad", birth_month: 13, birth_day: 1 }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test birthdays`
Expected: FAIL — 404/401 mismatch.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/routes/birthdays.ts
import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const birthdays = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

birthdays.use("/api/birthdays/*", requireAuth);
birthdays.use("/api/birthdays", requireAuth);

interface BodyShape {
  name: unknown; birth_month: unknown; birth_day: unknown; birth_year?: unknown;
}
function validate(b: BodyShape): { name: string; month: number; day: number; year: number | null } | null {
  const { name, birth_month, birth_day, birth_year } = b;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof birth_month !== "number" || birth_month < 1 || birth_month > 12) return null;
  if (typeof birth_day !== "number" || birth_day < 1 || birth_day > 31) return null;
  const year = birth_year === null || birth_year === undefined ? null : Number(birth_year);
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return null;
  return { name: name.trim(), month: birth_month, day: birth_day, year };
}

birthdays.get("/api/birthdays", async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT id, name, birth_month, birth_day, birth_year FROM birthdays ORDER BY birth_month, birth_day")
    .all();
  return c.json(results);
});

birthdays.post("/api/birthdays", async (c) => {
  const v = validate(await c.req.json().catch(() => ({})));
  if (!v) return c.json({ error: "invalid input" }, 400);
  const now = new Date().toISOString();
  const res = await c.env.DB
    .prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(v.name, v.month, v.day, v.year, c.get("userId"), now, now)
    .run();
  return c.json({ id: Number(res.meta.last_row_id) }, 201);
});

birthdays.put("/api/birthdays/:id", async (c) => {
  const v = validate(await c.req.json().catch(() => ({})));
  if (!v) return c.json({ error: "invalid input" }, 400);
  const id = Number(c.req.param("id"));
  const res = await c.env.DB
    .prepare("UPDATE birthdays SET name = ?, birth_month = ?, birth_day = ?, birth_year = ?, updated_at = ? WHERE id = ?")
    .bind(v.name, v.month, v.day, v.year, new Date().toISOString(), id)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ id });
});

birthdays.delete("/api/birthdays/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const res = await c.env.DB.prepare("DELETE FROM birthdays WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
```

- [ ] **Step 4: Wire into `index.ts`**

```ts
// apps/worker/src/index.ts  (add)
import { birthdays } from "./routes/birthdays";
app.route("/", birthdays);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test birthdays`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/routes/birthdays.ts apps/worker/src/index.ts apps/worker/test/birthdays.test.ts
git commit -m "feat(worker): birthdays CRUD (shared list)"
```

---

### Task 15: Settings API

**Files:**
- Create: `apps/worker/src/routes/settings.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/settings.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { signSession } from "../src/auth/session";

let cookie: string;
beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("UPDATE settings SET reminder_days_before = 7, notify_hour = 8 WHERE id = 1");
  cookie = `session=${await signSession({ userId: 1 }, "test-secret")}`;
});
function req(path: string, init: RequestInit = {}) {
  return app.request(path, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } }, env);
}

describe("settings", () => {
  it("returns current settings", async () => {
    const res = await req("/api/settings");
    expect(await res.json()).toEqual({ reminder_days_before: 7, notify_hour: 8, timezone: "Europe/Paris" });
  });
  it("updates reminder_days_before and notify_hour", async () => {
    const res = await req("/api/settings", { method: "PUT", body: JSON.stringify({ reminder_days_before: 3, notify_hour: 9 }) });
    expect(res.status).toBe(200);
    const after = await req("/api/settings");
    expect(await after.json()).toEqual({ reminder_days_before: 3, notify_hour: 9, timezone: "Europe/Paris" });
  });
  it("rejects out-of-range hour", async () => {
    const res = await req("/api/settings", { method: "PUT", body: JSON.stringify({ reminder_days_before: 3, notify_hour: 25 }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test settings`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/routes/settings.ts
import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const settings = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

settings.use("/api/settings", requireAuth);

settings.get("/api/settings", async (c) => {
  const row = await c.env.DB
    .prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1")
    .first();
  return c.json(row);
});

settings.put("/api/settings", async (c) => {
  const { reminder_days_before, notify_hour } = await c.req.json().catch(() => ({}));
  if (typeof reminder_days_before !== "number" || reminder_days_before < 0 || reminder_days_before > 60) {
    return c.json({ error: "invalid reminder_days_before" }, 400);
  }
  if (typeof notify_hour !== "number" || notify_hour < 0 || notify_hour > 23) {
    return c.json({ error: "invalid notify_hour" }, 400);
  }
  await c.env.DB
    .prepare("UPDATE settings SET reminder_days_before = ?, notify_hour = ? WHERE id = 1")
    .bind(reminder_days_before, notify_hour)
    .run();
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Wire into `index.ts`**

```ts
// apps/worker/src/index.ts  (add)
import { settings } from "./routes/settings";
app.route("/", settings);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test settings`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/routes/settings.ts apps/worker/src/index.ts apps/worker/test/settings.test.ts
git commit -m "feat(worker): global settings GET/PUT"
```

---

## Phase 5 — Push

### Task 16: Push subscription register / unregister

**Files:**
- Create: `apps/worker/src/routes/push.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/push.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/push.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { hashPassword } from "../src/auth/password";
import { signSession } from "../src/auth/session";

let cookie: string;
beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM push_subscriptions");
  await env.DB.exec("DELETE FROM users");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'a@b.com', ?, ?)")
    .bind(await hashPassword("x"), new Date().toISOString()).run();
  cookie = `session=${await signSession({ userId: 1 }, "test-secret")}`;
});
function req(path: string, init: RequestInit = {}) {
  return app.request(path, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } }, env);
}
const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "KEY", auth: "AUTH" } };

describe("push subscriptions", () => {
  it("returns the VAPID public key (no auth required)", async () => {
    const res = await app.request("/api/push/public-key", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: "test-public" });
  });
  it("registers a subscription (idempotent on endpoint)", async () => {
    expect((await req("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) })).status).toBe(201);
    await req("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
  it("unsubscribes", async () => {
    await req("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
    const res = await req("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
    expect(res.status).toBe(204);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test push`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/routes/push.ts
import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth } from "../auth/middleware";

export const push = new Hono<{ Bindings: Env; Variables: { userId: number } }>();

push.get("/api/push/public-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

push.use("/api/push/subscribe", requireAuth);
push.use("/api/push/unsubscribe", requireAuth);

push.post("/api/push/subscribe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return c.json({ error: "invalid subscription" }, 400);
  }
  await c.env.DB
    .prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id`)
    .bind(c.get("userId"), endpoint, p256dh, auth, new Date().toISOString())
    .run();
  return c.json({ ok: true }, 201);
});

push.post("/api/push/unsubscribe", async (c) => {
  const { endpoint } = await c.req.json().catch(() => ({}));
  if (typeof endpoint !== "string") return c.json({ error: "invalid input" }, 400);
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
  return c.body(null, 204);
});
```

- [ ] **Step 4: Wire into `index.ts`**

```ts
// apps/worker/src/index.ts  (add)
import { push } from "./routes/push";
app.route("/", push);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test push`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/routes/push.ts apps/worker/src/index.ts apps/worker/test/push.test.ts
git commit -m "feat(worker): push subscription register/unregister + public key"
```

---

### Task 17: Push send service (PushForge) with dead-subscription detection

**Files:**
- Create: `apps/worker/src/push/send.ts`
- Test: `apps/worker/test/send.test.ts`

- [ ] **Step 1: Write the failing test (mock global fetch)**

```ts
// apps/worker/test/send.test.ts
import { describe, expect, it, vi } from "vitest";
import { sendPush } from "../src/push/send";

const vapid = { subject: "mailto:t@e.com", publicKey: "pub", privateKey: "priv" };
const sub = { endpoint: "https://push.example/abc", p256dh: "KEY", auth: "AUTH" };

describe("sendPush", () => {
  it("returns { dead: false } on 201", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
    const r = await sendPush(sub, { title: "T", body: "B" }, vapid);
    expect(r).toEqual({ dead: false });
  });
  it("returns { dead: true } on 410 Gone", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));
    const r = await sendPush(sub, { title: "T", body: "B" }, vapid);
    expect(r).toEqual({ dead: true });
  });
  it("returns { dead: true } on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const r = await sendPush(sub, { title: "T", body: "B" }, vapid);
    expect(r).toEqual({ dead: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test send`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/push/send.ts
import { buildPushPayload } from "pushforge";

export interface PushTarget { endpoint: string; p256dh: string; auth: string; }
export interface PushMessage { title: string; body: string; }
export interface VapidDetails { subject: string; publicKey: string; privateKey: string; }

// pushforge's buildPushPayload returns the request parts to POST to the endpoint.
// Verify the exact return shape against the installed pushforge README; it provides
// { endpoint, headers, body } ready for fetch().
export async function sendPush(
  target: PushTarget,
  message: PushMessage,
  vapid: VapidDetails,
): Promise<{ dead: boolean }> {
  const subscription = {
    endpoint: target.endpoint,
    keys: { p256dh: target.p256dh, auth: target.auth },
  };
  const payload = await buildPushPayload(
    { data: JSON.stringify(message), options: { ttl: 60 * 60 * 24 } },
    subscription,
    vapid,
  );
  const res = await fetch(payload.endpoint, {
    method: "POST",
    headers: payload.headers,
    body: payload.body,
  });
  return { dead: res.status === 404 || res.status === 410 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter worker test send`
Expected: PASS.

> If the installed `pushforge` API differs (function name or return shape), adjust this thin wrapper only; the tests pin the behavior (POST to endpoint, dead on 404/410) which is what the rest of the system depends on.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/push/send.ts apps/worker/test/send.test.ts
git commit -m "feat(worker): sendPush via pushforge with dead-subscription detection"
```

---

### Task 18: Cron notify handler

**Files:**
- Create: `apps/worker/src/cron/notify.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/notify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/notify.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runNotifications } from "../src/cron/notify";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM birthdays");
  await env.DB.exec("DELETE FROM push_subscriptions");
  await env.DB.exec("DELETE FROM users");
  await env.DB.exec("UPDATE settings SET reminder_days_before = 7, notify_hour = 8 WHERE id = 1");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'a@b.com', 'x', ?)")
    .bind(new Date().toISOString()).run();
});

it("does nothing when current Paris hour != notify_hour", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  // 2026-03-15T05:00:00Z = Paris 06:00, notify_hour is 8
  await runNotifications(env, new Date("2026-03-15T05:00:00Z"));
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("sends to all subscriptions at notify_hour for a 'today' birthday", async () => {
  await env.DB.prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES ('Anna', 3, 15, 1990, 1, ?, ?)")
    .bind(new Date().toISOString(), new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push/1', 'K', 'A', ?)")
    .bind(new Date().toISOString()).run();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
  // 2026-03-15T07:00:00Z = Paris 08:00 (winter +1)
  await runNotifications(env, new Date("2026-03-15T07:00:00Z"));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

it("purges a subscription that returns 410", async () => {
  await env.DB.prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES ('Anna', 3, 15, NULL, 1, ?, ?)")
    .bind(new Date().toISOString(), new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push/dead', 'K', 'A', ?)")
    .bind(new Date().toISOString()).run();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));
  await runNotifications(env, new Date("2026-03-15T07:00:00Z"));
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
  expect(n?.n).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test notify`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/cron/notify.ts
import { planNotifications, parisHour } from "@bday/shared";
import type { Birthday, Settings, PlannedNotification } from "@bday/shared";
import type { Env } from "../env";
import { sendPush, type PushTarget } from "../push/send";

function messageFor(n: PlannedNotification): { title: string; body: string } {
  if (n.kind === "today") {
    const age = n.age !== null ? ` (${n.age} ans)` : "";
    return { title: "🎂 Anniversaire aujourd'hui", body: `C'est l'anniversaire de ${n.birthday.name}${age} !` };
  }
  return { title: "Rappel anniversaire", body: `Dans ${n.daysUntil} jours : anniversaire de ${n.birthday.name}` };
}

export async function runNotifications(env: Env, now: Date): Promise<void> {
  const settings = await env.DB
    .prepare("SELECT reminder_days_before, notify_hour, timezone FROM settings WHERE id = 1")
    .first<Settings>();
  if (!settings) return;
  if (parisHour(now) !== settings.notify_hour) return;

  const { results } = await env.DB
    .prepare("SELECT id, name, birth_month, birth_day, birth_year FROM birthdays")
    .all<Birthday>();
  const planned = planNotifications(results, settings, now);
  if (planned.length === 0) return;

  const { results: subs } = await env.DB
    .prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions")
    .all<PushTarget & { id: number }>();
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };

  for (const n of planned) {
    const msg = messageFor(n);
    for (const sub of subs) {
      const { dead } = await sendPush(sub, msg, vapid);
      if (dead) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
      }
    }
  }
}
```

- [ ] **Step 4: Wire into `scheduled` in `index.ts`**

```ts
// apps/worker/src/index.ts  (replace scheduled body)
import { runNotifications } from "./cron/notify";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runNotifications(env, new Date()));
  },
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test notify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/cron/notify.ts apps/worker/src/index.ts apps/worker/test/notify.test.ts
git commit -m "feat(worker): cron notify handler (hour-gated, purges dead subs)"
```

---

## Phase 6 — Backup

### Task 19: Daily backup to R2

**Files:**
- Create: `apps/worker/src/cron/backup.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/backup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/test/backup.test.ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runBackup } from "../src/cron/backup";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM birthdays");
  await env.DB.exec("DELETE FROM users");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'a@b.com', 'x', ?)")
    .bind(new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO birthdays (name, birth_month, birth_day, birth_year, created_by, created_at, updated_at) VALUES ('Anna', 3, 15, 1990, 1, ?, ?)")
    .bind(new Date().toISOString(), new Date().toISOString()).run();
});

it("writes a JSON backup object to R2 with the birthdays", async () => {
  await runBackup(env, new Date("2026-03-15T07:00:00Z"));
  const obj = await env.BACKUPS.get("backups/2026-03-15.json");
  expect(obj).not.toBeNull();
  const data = await obj!.json<{ birthdays: { name: string }[] }>();
  expect(data.birthdays[0].name).toBe("Anna");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test backup`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/cron/backup.ts
import type { Env } from "../env";

export async function runBackup(env: Env, now: Date): Promise<void> {
  const [users, birthdays, subscriptions, settings] = await Promise.all([
    env.DB.prepare("SELECT id, email, password_hash, created_at FROM users").all(),
    env.DB.prepare("SELECT * FROM birthdays").all(),
    env.DB.prepare("SELECT * FROM push_subscriptions").all(),
    env.DB.prepare("SELECT * FROM settings").all(),
  ]);
  const dump = {
    generated_at: now.toISOString(),
    users: users.results,
    birthdays: birthdays.results,
    subscriptions: subscriptions.results,
    settings: settings.results,
  };
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  await env.BACKUPS.put(`backups/${date}.json`, JSON.stringify(dump), {
    httpMetadata: { contentType: "application/json" },
  });
}
```

- [ ] **Step 4: Wire into `scheduled` (run once per day at notify_hour)**

```ts
// apps/worker/src/index.ts  (update scheduled)
import { runNotifications } from "./cron/notify";
import { runBackup } from "./cron/backup";
import { parisHour } from "@bday/shared";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const now = new Date();
    ctx.waitUntil(runNotifications(env, now));
    // back up once a day at 03:00 Paris
    if (parisHour(now) === 3) ctx.waitUntil(runBackup(env, now));
  },
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter worker test backup`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/cron/backup.ts apps/worker/src/index.ts apps/worker/test/backup.test.ts
git commit -m "feat(worker): daily D1 -> R2 JSON backup"
```

---

## Phase 7 — Frontend (React 19 + Vite PWA)

### Task 20: Web scaffold + PWA plugin

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/public/icon-192.png`, `apps/web/public/icon-512.png` (placeholder PNGs)

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@bday/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "BirthdayReminder",
        short_name: "Anniv",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#e85d75",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8787" } },
  test: { environment: "jsdom", globals: true, setupFiles: "./test/setup.ts" },
});
```

- [ ] **Step 3: Create `apps/web/index.html`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/sw.ts`, `test/setup.ts`**

```html
<!-- apps/web/index.html -->
<!doctype html>
<html lang="fr">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><title>BirthdayReminder</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "noUncheckedIndexedAccess": true,
    "skipLibCheck": true, "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "test"]
}
```

```tsx
// apps/web/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```

```tsx
// apps/web/src/App.tsx  (placeholder; replaced in Task 22)
export default function App() {
  return <h1>BirthdayReminder</h1>;
}
```

```ts
// apps/web/src/sw.ts — push display service worker (injectManifest)
/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Anniversaire", body: "" };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon-192.png" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
```

> `workbox-precaching` is pulled in transitively by `vite-plugin-pwa`; if the import is unresolved, add `workbox-precaching` to devDependencies.

```ts
// apps/web/test/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Add placeholder icons**

Run (PowerShell, generate 1x1 PNGs as placeholders — replace with real icons before launch):
```powershell
$png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
[IO.File]::WriteAllBytes("apps/web/public/icon-192.png", $png)
[IO.File]::WriteAllBytes("apps/web/public/icon-512.png", $png)
```

- [ ] **Step 5: Install, build, commit**

Run: `pnpm install && pnpm --filter web build`
Expected: build succeeds, `dist/` and `sw.js` produced.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore: scaffold react 19 vite pwa"
```

---

### Task 21: API client + auth context

**Files:**
- Create: `apps/web/src/api.ts`, `apps/web/src/auth.tsx`

- [ ] **Step 1: Implement API client**

```ts
// apps/web/src/api.ts
import type { Birthday, Settings } from "@bday/shared";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}
const opts = (method: string, body?: unknown): RequestInit => ({
  method, credentials: "include",
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  signup: (email: string, password: string, inviteCode: string) =>
    j<{ id: number }>(fetch("/api/signup", opts("POST", { email, password, inviteCode }))),
  login: (email: string, password: string) =>
    j<{ id: number }>(fetch("/api/login", opts("POST", { email, password }))),
  listBirthdays: () => j<Birthday[]>(fetch("/api/birthdays", opts("GET"))),
  createBirthday: (b: Omit<Birthday, "id">) => j<{ id: number }>(fetch("/api/birthdays", opts("POST", b))),
  updateBirthday: (id: number, b: Omit<Birthday, "id">) => j<{ id: number }>(fetch(`/api/birthdays/${id}`, opts("PUT", b))),
  deleteBirthday: (id: number) => j<void>(fetch(`/api/birthdays/${id}`, opts("DELETE"))),
  getSettings: () => j<Settings>(fetch("/api/settings", opts("GET"))),
  updateSettings: (s: Pick<Settings, "reminder_days_before" | "notify_hour">) =>
    j<{ ok: true }>(fetch("/api/settings", opts("PUT", s))),
  pushPublicKey: () => j<{ publicKey: string }>(fetch("/api/push/public-key", opts("GET"))),
  subscribePush: (sub: PushSubscriptionJSON) => j<{ ok: true }>(fetch("/api/push/subscribe", opts("POST", sub))),
  unsubscribePush: (endpoint: string) => j<void>(fetch("/api/push/unsubscribe", opts("POST", { endpoint }))),
};
```

- [ ] **Step 2: Implement auth context**

```tsx
// apps/web/src/auth.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthState { loggedIn: boolean; setLoggedIn: (v: boolean) => void; }
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // session is an httpOnly cookie; we track a client flag set after login/signup.
  const [loggedIn, setLoggedIn] = useState<boolean>(() => localStorage.getItem("loggedIn") === "1");
  const set = (v: boolean) => { v ? localStorage.setItem("loggedIn", "1") : localStorage.removeItem("loggedIn"); setLoggedIn(v); };
  return <Ctx.Provider value={{ loggedIn, setLoggedIn: set }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm --filter web build`
Expected: no type errors.

```bash
git add apps/web/src/api.ts apps/web/src/auth.tsx
git commit -m "feat(web): typed api client + auth context"
```

---

### Task 22: Routing + Login/Signup pages

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/pages/Login.tsx`, `apps/web/src/pages/Signup.tsx`

- [ ] **Step 1: Implement App router**

```tsx
// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Birthdays from "./pages/Birthdays";
import Settings from "./pages/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Protected><Birthdays /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Implement Login + Signup**

```tsx
// apps/web/src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const nav = useNavigate(); const { setLoggedIn } = useAuth();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api.login(email, password); setLoggedIn(true); nav("/"); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Connexion</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Se connecter</button>
      <Link to="/signup">Créer un compte</Link>
    </form>
  );
}
```

```tsx
// apps/web/src/pages/Signup.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Signup() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(""); const nav = useNavigate(); const { setLoggedIn } = useAuth();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api.signup(email, password, inviteCode); setLoggedIn(true); nav("/"); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Créer un compte</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe (6+ caractères)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <input placeholder="Code d'invitation" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Créer</button>
      <Link to="/login">J'ai déjà un compte</Link>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm --filter web build`
Expected: fails until Birthdays/Settings exist — that's expected; create stubs to compile if needed, or commit after Task 24. To keep this task self-contained, add temporary stubs:

```tsx
// apps/web/src/pages/Birthdays.tsx (temporary stub, replaced in Task 23)
export default function Birthdays() { return <div>Birthdays</div>; }
// apps/web/src/pages/Settings.tsx (temporary stub, replaced in Task 24)
export default function Settings() { return <div>Settings</div>; }
```

```bash
git add apps/web/src/App.tsx apps/web/src/pages
git commit -m "feat(web): routing + login/signup pages"
```

---

### Task 23: Birthdays page + form

**Files:**
- Create: `apps/web/src/components/BirthdayForm.tsx`
- Replace: `apps/web/src/pages/Birthdays.tsx`
- Test: `apps/web/test/BirthdayForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/BirthdayForm.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BirthdayForm from "../src/components/BirthdayForm";

describe("BirthdayForm", () => {
  it("submits name + parsed date with optional year", () => {
    const onSubmit = vi.fn();
    render(<BirthdayForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Nom"), { target: { value: "Anna" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-03-15" } });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Anna", birth_month: 3, birth_day: 15, birth_year: 2026 });
  });
  it("submits null year when 'année inconnue' is checked", () => {
    const onSubmit = vi.fn();
    render(<BirthdayForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Nom"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-22" } });
    fireEvent.click(screen.getByLabelText("Année inconnue"));
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Bob", birth_month: 7, birth_day: 22, birth_year: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test BirthdayForm`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the form**

```tsx
// apps/web/src/components/BirthdayForm.tsx
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
    const [y, m, d] = date.split("-").map(Number);
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test BirthdayForm`
Expected: PASS.

- [ ] **Step 5: Implement the Birthdays page (uses the form + api)**

```tsx
// apps/web/src/pages/Birthdays.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Birthday } from "@bday/shared";
import { ageFromYear } from "@bday/shared";
import { api } from "../api";
import BirthdayForm from "../components/BirthdayForm";

const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

export default function Birthdays() {
  const [list, setList] = useState<Birthday[]>([]);
  const [editing, setEditing] = useState<Birthday | "new" | null>(null);
  const year = new Date().getFullYear();

  async function reload() { setList(await api.listBirthdays()); }
  useEffect(() => { void reload(); }, []);

  async function save(b: Omit<Birthday, "id">) {
    if (editing === "new") await api.createBirthday(b);
    else if (editing) await api.updateBirthday(editing.id, b);
    setEditing(null); await reload();
  }
  async function remove(id: number) { await api.deleteBirthday(id); await reload(); }

  return (
    <main style={{ maxWidth: 480, margin: "1rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Anniversaires</h1>
        <Link to="/settings">⚙️</Link>
      </header>
      {editing ? (
        <BirthdayForm initial={editing === "new" ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing("new")}>+ Ajouter</button>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {list.map((b) => {
          const age = ageFromYear(b.birth_year, year);
          return (
            <li key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <span>{b.name} — {b.birth_day} {MONTHS[b.birth_month - 1]}{age !== null ? ` (${age} ans)` : ""}</span>
              <span>
                <button onClick={() => setEditing(b)}>✏️</button>
                <button onClick={() => remove(b.id)}>🗑️</button>
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter web build`
Expected: no type errors.

```bash
git add apps/web/src/components/BirthdayForm.tsx apps/web/src/pages/Birthdays.tsx apps/web/test/BirthdayForm.test.tsx
git commit -m "feat(web): birthdays list + add/edit/delete form"
```

---

### Task 24: Settings page + push enable + iOS hint

**Files:**
- Create: `apps/web/src/sw-push.ts`, `apps/web/src/components/IosInstallHint.tsx`
- Replace: `apps/web/src/pages/Settings.tsx`

- [ ] **Step 1: Implement push subscribe helper**

```ts
// apps/web/src/sw-push.ts
import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Push non supporté sur cet appareil/navigateur." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Permission refusée." };

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushPublicKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
  return { ok: true };
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}
```

- [ ] **Step 2: Implement iOS install hint**

```tsx
// apps/web/src/components/IosInstallHint.tsx
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
```

- [ ] **Step 3: Implement Settings page**

```tsx
// apps/web/src/pages/Settings.tsx
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
```

- [ ] **Step 4: Typecheck, build, commit**

Run: `pnpm --filter web build`
Expected: no type errors; service worker emitted.

```bash
git add apps/web/src/sw-push.ts apps/web/src/components/IosInstallHint.tsx apps/web/src/pages/Settings.tsx
git commit -m "feat(web): settings page, push enable, iOS install hint"
```

---

## Phase 8 — Deploy

### Task 25: VAPID keys, Cloudflare resources, deploy

**Files:**
- Modify: `apps/worker/wrangler.toml` (real `database_id`)
- Create: `README.md` (deploy steps)

- [ ] **Step 1: Generate VAPID keys**

Run (Node one-off using web-push CLI or pushforge key gen):
```bash
npx web-push generate-vapid-keys
```
Record `Public Key` and `Private Key`.

- [ ] **Step 2: Create Cloudflare resources**

```bash
cd apps/worker
wrangler d1 create bday-db          # copy the database_id into wrangler.toml
wrangler r2 bucket create bday-backups
```
Paste the returned `database_id` into `wrangler.toml` `[[d1_databases]]`.

- [ ] **Step 3: Set secrets**

```bash
wrangler secret put JWT_SECRET            # paste a long random string
wrangler secret put INVITE_CODE           # paste your family invite code
wrangler secret put VAPID_PUBLIC_KEY      # from step 1
wrangler secret put VAPID_PRIVATE_KEY     # from step 1
wrangler secret put VAPID_SUBJECT         # e.g. mailto:you@example.com
```

- [ ] **Step 4: Apply migrations to remote D1 and deploy worker**

```bash
pnpm --filter worker migrate:remote
pnpm --filter worker deploy
```
Expected: worker deployed; note its URL.

- [ ] **Step 5: Deploy web to Cloudflare Pages**

- Set `apps/web` build command `pnpm --filter web build`, output dir `apps/web/dist`.
- Add a Pages Function or routing rule so `/api/*` proxies to the worker, OR set `VITE` to call the worker URL directly. Simplest: bind the worker to a route `your-domain/api/*` and serve Pages at `your-domain/*`. Document the chosen domain in README.

- [ ] **Step 6: Write `README.md`**

Document: stack, local dev (`pnpm dev:worker`, `pnpm dev:web`), env/secrets, deploy commands, and the iOS install requirement.

- [ ] **Step 7: Commit and tag**

```bash
git add apps/worker/wrangler.toml README.md
git commit -m "docs: deployment setup + wrangler resource ids"
```

---

## Self-Review

**Spec coverage:**
- Multi-user + login → Tasks 9-13. ✅
- Shared family list → Task 14 (no per-user filter). ✅
- 2-5 users scale → serverless, no scaling work needed. ✅
- Day-J + reminder, global delay, all users notified → Tasks 6, 18. ✅
- Name + date, optional year + age → Tasks 3, 14, 23. ✅
- Cloudflare serverless (Pages/Workers/D1/Cron/R2) → Tasks 7, 8, 18, 19, 25. ✅
- Auth email/password + invite code → Tasks 9, 12. ✅
- Europe/Paris timezone → Task 5, used in 18/19. ✅
- Feb 29 → Feb 28 → Task 4. ✅
- Web push VAPID → Tasks 16, 17, 24. ✅
- iOS install constraint surfaced in UI → Task 24. ✅
- R2 backup → Task 19. ✅
- Error handling (expired push purge, bad invite, dup email) → Tasks 12, 16, 18. ✅
- Tests (date match unit, API integration, push mocked) → throughout. ✅

**Placeholder scan:** Two acknowledged external-API verification notes (pushforge return shape in Task 17; vitest-pool migration wiring in Task 8) — both pin behavior via tests and instruct exact adjustment. `database_id` placeholder is intentional, filled in Task 25. No silent TODOs.

**Type consistency:** `Birthday`, `Settings`, `PlannedNotification`, `PushSubscriptionRecord` defined once in `packages/shared/src/types.ts` and imported everywhere. `sendPush` signature `(target, message, vapid)` consistent between Task 17 definition and Task 18 use. API client return types match worker route responses.

**Scope:** Single coherent app, one plan. No decomposition needed.
