import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { Database } from "./db";
import { verifyPassword } from "./auth";
import { provisionStore } from "./provision";

test("operational provisioning creates only an owner and an empty store; refuses existing data", async () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, "../../../.local/postgres.json"), "utf8"),
  );
  const name = "agristock_provision_" + randomUUID().replaceAll("-", "");
  const base = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/`;
  const admin = new Pool({ connectionString: base + "postgres" });
  const previous = process.env.DATABASE_URL;
  await admin.query("CREATE DATABASE " + name);
  process.env.DATABASE_URL = base + name;
  const db = new Database();
  try {
    await db.onModuleInit();
    await db.pool.query(
      "INSERT INTO audit_log(id,action) VALUES($1,'LOGIN_FAILED')",
      [randomUUID()],
    );
    const input = {
      username: "owner",
      password: randomUUID() + randomUUID(),
      ownerName: "Chủ cửa hàng",
      storeName: "Cửa hàng kiểm thử khởi tạo",
      warehouseName: "Kho chính",
    };
    await provisionStore(db, input);
    const owner = (await db.pool.query("SELECT * FROM users")).rows[0];
    assert.equal(owner.owner, true);
    assert.equal(owner.must_change_password, true);
    assert.equal(
      (await db.pool.query("SELECT COUNT(*)::int count FROM audit_log")).rows[0]
        .count,
      2,
    );
    assert.equal(
      await verifyPassword(input.password, owner.password_hash),
      true,
    );
    for (const table of [
      "products",
      "lots",
      "orders",
      "debts",
      "partners",
      "payments",
    ])
      assert.equal(
        (await db.pool.query("SELECT COUNT(*)::int count FROM " + table))
          .rows[0].count,
        0,
      );
    await assert.rejects(() => provisionStore(db, input), /không trống/);
    assert.equal(
      (await db.pool.query("SELECT COUNT(*)::int count FROM users")).rows[0]
        .count,
      1,
    );
  } finally {
    await db.onModuleDestroy();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await admin.query("DROP DATABASE " + name);
    await admin.end();
  }
});
