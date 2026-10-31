import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const config = JSON.parse(
  readFileSync(path.join(root, ".local/postgres.json"), "utf8"),
);
const database = "agristock_stitch_ui";
const base = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/`;
const admin = new Pool({ connectionString: base + "postgres" });
if (
  !(await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [database]))
    .rowCount
)
  await admin.query("CREATE DATABASE " + database);
await admin.end();
process.env.DATABASE_URL = base + database;
process.env.NODE_ENV = "development";
const { createApp } = require("../apps/api/dist/main.js");
const { Database } = require("../apps/api/dist/db.js");
const { seedDatabase } = require("../apps/api/dist/seed.js");
const app = await createApp();
await app.init();
const db = app.get(Database);
const credentials =
  (await db.pool.query("SELECT COUNT(*)::int count FROM users")).rows[0]
    .count === 0
    ? await seedDatabase(db)
    : [];
if (credentials.length) {
  mkdirSync(path.join(root, ".local"), { recursive: true });
  writeFileSync(
    path.join(root, ".local/stitch-ui-accounts.json"),
    JSON.stringify({ accounts: credentials }, null, 2),
  );
}
await app.listen(3003, "127.0.0.1");
console.log(
  "Isolated Stitch UI API ready on http://127.0.0.1:3003; main database unchanged.",
);
