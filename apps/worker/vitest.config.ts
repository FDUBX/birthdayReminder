import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            d1Databases: ["DB"],
            r2Buckets: ["BACKUPS"],
            bindings: {
              TEST_MIGRATIONS: migrations,
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
  };
});
