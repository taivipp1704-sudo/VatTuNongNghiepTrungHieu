import { Pool, types } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const tables = [
  "warehouses",
  "roles",
  "users",
  "user_roles",
  "products",
  "lots",
  "partners",
  "product_warehouse_preferences",
  "partner_adjustments",
  "stock_documents",
  "orders",
  "photos",
  "loyalty_accounts",
  "loyalty_ledger",
  "debts",
  "payments",
  "invoices",
  "stock_ledger",
  "audit_log",
  "idempotency",
  "settings",
];
const jsonFields = new Set([
  "stock_documents.lines",
  "orders.lines",
  "orders.loyalty_snapshot",
  "audit_log.detail",
  "idempotency.response",
  "settings.value",
  "products.details",
  "partners.profile",
]);
types.setTypeParser(1082, (value) => value);
export async function backup(pool, destination) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const name = (await client.query("SELECT current_database() name")).rows[0]
      .name;
    const data = {};
    for (const table of tables) {
      if (["product_warehouse_preferences", "partner_adjustments"].includes(table) &&
          !(await client.query("SELECT to_regclass($1) existing", ["public." + table])).rows[0].existing) {
        data[table] = [];
        continue;
      }
      const rows = (await client.query("SELECT * FROM " + table)).rows;
      data[table] = table === "photos" ? rows.map(row => ({ ...row, data: row.data.toString("base64") })) : rows;
    }
    await client.query("COMMIT");
    const snapshot = {
      format: "agristock-backup-v1",
      id: randomUUID(),
      database: name,
      createdAt: new Date().toISOString(),
      tables: data,
    };
    writeFileSync(destination, gzipSync(JSON.stringify(snapshot)));
    return snapshot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function restore(pool, source) {
  const snapshot = JSON.parse(
    gunzipSync(readFileSync(source), {
      maxOutputLength: 256 * 1024 * 1024,
    }).toString("utf8"),
  );
  if (snapshot.format !== "agristock-backup-v1")
    throw new Error("Định dạng bản sao lưu không phù hợp.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const name = (await client.query("SELECT current_database() name")).rows[0]
      .name;
    if (name === snapshot.database)
      throw new Error(
        "Khôi phục vào cơ sở dữ liệu mới, khác cơ sở dữ liệu nguồn.",
      );
    for (const table of tables) {
      const count = (
        await client.query("SELECT COUNT(*)::int count FROM " + table)
      ).rows[0].count;
      if (count !== 0) throw new Error("Cơ sở dữ liệu đích phải trống.");
    }
    for (const table of tables) {
      const columns = new Set(
        (
          await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
            [table],
          )
        ).rows.map((row) => row.column_name),
      );
      for (const row of snapshot.tables[table] || []) {
        const keys = Object.keys(row);
        if (keys.some((key) => !columns.has(key) || !/^[a-z_]+$/.test(key)))
          throw new Error("Cột dữ liệu không hợp lệ.");
        const values = keys.map((key) =>
          table === "photos" && key === "data" ? Buffer.from(row[key], "base64") : jsonFields.has(table + "." + key) && row[key] !== null
            ? JSON.stringify(row[key])
            : row[key],
        );
        await client.query(
          "INSERT INTO " +
            table +
            "(" +
            keys.join(",") +
            ") VALUES(" +
            keys.map((_, index) => "$" + (index + 1)).join(",") +
            ")",
          values,
        );
      }
    }
    await client.query("COMMIT");
    return { database: name, createdAt: snapshot.createdAt };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.env.DATABASE_URL) throw new Error("Thiếu DATABASE_URL.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (process.argv[2] === "restore") {
      if (!process.argv[3])
        throw new Error("Chỉ định tệp sao lưu cần khôi phục.");
      const result = await restore(pool, path.resolve(process.argv[3]));
      console.log(
        "Đã khôi phục vào " +
          result.database +
          ". Các thiết bị cần đăng nhập lại.",
      );
    } else {
      const directory = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../.local/backups",
      );
      mkdirSync(directory, { recursive: true });
      const file = path.join(
        directory,
        "agristock-" +
          new Date().toISOString().replace(/[:.]/g, "-") +
          ".json.gz",
      );
      await backup(pool, file);
      console.log("Đã sao lưu: " + file);
    }
  } finally {
    await pool.end();
  }
}
