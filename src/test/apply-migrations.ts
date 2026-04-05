import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Apply D1 migrations before tests run.
// applyD1Migrations() is idempotent — only applies un-applied migrations.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
