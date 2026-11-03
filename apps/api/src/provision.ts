import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Database, audit } from "./db";
import { hashPassword, permissionCatalog } from "./auth";

const inputSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,40}$/),
  password: z.string().min(12).max(200),
  ownerName: z.string().trim().min(2).max(120),
  storeName: z.string().trim().min(2).max(120),
  warehouseName: z.string().trim().min(2).max(120),
});

export async function provisionStore(db: Database, raw: unknown) {
  const input = inputSchema.parse(raw);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('agristock:provision',0))",
    );
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      )
    ).rows;
    for (const { tablename } of tables) {
      const name = '"' + String(tablename).replaceAll('"', '""') + '"';
      const filter =
        tablename === "audit_log"
          ? " WHERE action <> 'LOGIN_FAILED' OR user_id IS NOT NULL"
          : "";
      if (
        (
          await client.query(
            `SELECT EXISTS(SELECT 1 FROM ${name}${filter} LIMIT 1) populated`,
          )
        ).rows[0].populated
      ) {
        throw new Error(
          "Database không trống. Không khởi tạo hoặc ghi đè dữ liệu đang có.",
        );
      }
    }
    const ownerId = randomUUID(),
      roleId = randomUUID(),
      warehouseId = randomUUID();
    await client.query("INSERT INTO warehouses(id,name) VALUES($1,$2)", [
      warehouseId,
      input.warehouseName,
    ]);
    await client.query(
      "INSERT INTO roles(id,name,permissions,protected) VALUES($1,'Chủ cửa hàng',$2,true)",
      [roleId, [...permissionCatalog]],
    );
    await client.query(
      "INSERT INTO users(id,username,name,password_hash,owner,must_change_password,warehouse_ids) VALUES($1,$2,$3,$4,true,true,$5)",
      [
        ownerId,
        input.username.toLowerCase(),
        input.ownerName,
        passwordHash,
        [warehouseId],
      ],
    );
    await client.query(
      "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)",
      [ownerId, roleId],
    );
    await client.query("INSERT INTO settings(key,value) VALUES('store',$1)", [
      JSON.stringify({ name: input.storeName, address: "", phone: "" }),
    ]);
    await client.query(
      "INSERT INTO settings(key,value) VALUES('_stitch_permissions_v1','true') ON CONFLICT DO NOTHING",
    );
    await audit(client, ownerId, "STORE_PROVISIONED", ownerId, {
      warehouseId,
      username: input.username.toLowerCase(),
    });
    return { ownerId, warehouseId, username: input.username.toLowerCase() };
  });
}

if (require.main === module) {
  const db = new Database();
  (async () => {
    if (!process.env.DATABASE_URL || !process.env.AGRISTOCK_OWNER_PASSWORD)
      throw new Error(
        "Set DATABASE_URL and AGRISTOCK_OWNER_PASSWORD for the empty operational database. No demo environment is loaded.",
      );
    await db.onModuleInit();
    const result = await provisionStore(db, {
      username: process.env.AGRISTOCK_OWNER_USERNAME || "owner",
      password: process.env.AGRISTOCK_OWNER_PASSWORD,
      ownerName: process.env.AGRISTOCK_OWNER_NAME || "Chủ cửa hàng",
      storeName: process.env.AGRISTOCK_STORE_NAME || "HTAgri",
      warehouseName: process.env.AGRISTOCK_WAREHOUSE_NAME || "Kho cửa hàng",
    });
    console.log(
      "Đã tạo cửa hàng trống và tài khoản " +
        result.username +
        ". Đổi mật khẩu ở lần đăng nhập đầu; không có hàng hoặc công nợ mẫu.",
    );
  })()
    .catch((error) => {
      console.error(
        error instanceof z.ZodError
          ? "Thông tin khởi tạo không hợp lệ; mật khẩu cần ít nhất 12 ký tự."
          : error.message,
      );
      process.exitCode = 1;
    })
    .finally(() => db.onModuleDestroy());
}
