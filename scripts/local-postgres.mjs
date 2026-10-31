import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".local");
mkdirSync(directory, { recursive: true });
const configFile = path.join(directory, "postgres.json");
const config = existsSync(configFile)
  ? JSON.parse(readFileSync(configFile, "utf8"))
  : {
      user: "agristock",
      password: randomBytes(24).toString("hex"),
      port: 55432,
    };
writeFileSync(configFile, JSON.stringify(config, null, 2));
const database = new EmbeddedPostgres({
  ...config,
  databaseDir: path.join(directory, "postgres"),
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  onLog: () => {},
  onError: (message) => process.stderr.write(String(message) + "\n"),
});
if (!existsSync(path.join(directory, "postgres", "PG_VERSION")))
  await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
for (const name of ["agristock", "agristock_test"]) {
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!exists.rowCount) await client.query("CREATE DATABASE " + name);
}
await client.end();
writeFileSync(
  path.join(directory, "api.env"),
  `DATABASE_URL=postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/agristock\nPORT=3001\nNODE_ENV=development\n`,
);
console.log(
  "PostgreSQL sẵn sàng tại 127.0.0.1:" +
    config.port +
    ". Cấu hình riêng: .local/api.env",
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await database.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
