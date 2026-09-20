import { env } from "cloudflare:workers";

/**
 * Returns the D1 database bound as `DB` in wrangler.jsonc.
 *
 * During local development Wrangler stores this as a local SQLite database.
 * The same interface is used by the deployed Cloudflare Worker.
 */
export function getDatabase(): D1Database {
  return env.DB;
}
