import * as SQLite from "expo-sqlite";

const database = SQLite.openDatabaseAsync("agristock.db").then(
  async (database) => {
    await database.execAsync(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_values (key TEXT PRIMARY KEY,value TEXT NOT NULL);",
    );
    return database;
  },
);
export async function localGet<Value>(key: string): Promise<Value | null> {
  const row = await (
    await database
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM local_values WHERE key=?",
    key,
  );
  return row ? (JSON.parse(row.value) as Value) : null;
}
export async function localSet(key: string, value: unknown) {
  await (
    await database
  ).runAsync(
    "INSERT OR REPLACE INTO local_values(key,value) VALUES(?,?)",
    key,
    JSON.stringify(value),
  );
}
export async function localRemove(key: string) {
  await (await database).runAsync("DELETE FROM local_values WHERE key=?", key);
}
export async function clearUserCache(prefix: string) {
  await (
    await database
  ).runAsync(
    "DELETE FROM local_values WHERE substr(key,1,?)=?",
    prefix.length,
    prefix,
  );
}
