export interface Env {
  DB: D1Database;
  BACKUPS: R2Bucket;
  JWT_SECRET: string;
  INVITE_CODE: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
