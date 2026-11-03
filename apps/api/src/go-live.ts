import { Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Post, Req, Res, UseGuards } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Response } from "express";
import { PoolClient } from "pg";
import { z } from "zod";
import { AuthRequest, SessionGuard, permissionCatalog } from "./auth";
import { Database, audit } from "./db";
import { parse } from "./validation";

// One-time transition for the existing, named test database. Closed permanently after completion.
export const goLiveTables = ["warehouses", "roles", "users", "user_roles", "products", "lots", "partners", "product_warehouse_preferences", "partner_adjustments", "stock_documents", "orders", "photos", "loyalty_accounts", "loyalty_ledger", "debts", "payments", "invoices", "stock_ledger", "audit_log", "idempotency", "settings"];
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function assertTestStore(client: PoolClient) {
  const name = (await client.query("SELECT current_database() name")).rows[0].name;
  const values = (await client.query("SELECT key,value FROM settings WHERE key IN ('store','_ht_go_live_v1')")).rows;
  if (values.some(r => r.key === "_ht_go_live_v1") ||
      (name !== "agristock_remote_test_db" && !(process.env.NODE_ENV === "test" && name.startsWith("agristock_go_live_"))) ||
      values.find(r => r.key === "store")?.value?.name !== "Vật tư nông nghiệp Trung Hiếu · TEST") {
    throw new NotFoundException("Quá trình chuyển dữ liệu thử không khả dụng.");
  }
}

export async function goLiveSnapshot(client: PoolClient) {
  const tables: Record<string, any[]> = {};
  for (const table of goLiveTables) {
    const rows = (await client.query(`SELECT t.* FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    tables[table] = table === "photos" ? rows.map(r => ({ ...r, data: r.data.toString("base64") })) : rows;
  }
  return { tables, fingerprint: sha(JSON.stringify(tables)) };
}

export async function resetTestStore(db: Database, ownerId: string, fingerprint: string, backupSha256: string) {
  return db.transaction(async client => {
    // Lock the complete allowlist; fail closed if schema gained an unhandled table.
    const actual = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
    if (JSON.stringify(actual) !== JSON.stringify([...goLiveTables, "sessions"].sort())) throw new ConflictException("Danh sách bảng đã thay đổi; cần kiểm tra lại bản sao lưu.");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("LOCK TABLE " + [...goLiveTables, "sessions"].sort().join(",") + " IN ACCESS EXCLUSIVE MODE");
    await assertTestStore(client);
    const snapshot = await goLiveSnapshot(client);
    if (!snapshot.tables.settings.some(r => r.key === "_go_live_lock" && r.value === true)) throw new ConflictException("Chưa mở phiên bảo trì.");
    if (snapshot.fingerprint !== fingerprint) throw new ConflictException("Dữ liệu đã thay đổi sau sao lưu. Tải lại bản sao lưu trước khi tiếp tục.");
    const owner = snapshot.tables.users.find(r => r.id === ownerId && r.owner && r.active);
    if (!owner) throw new ForbiddenException("Chỉ chủ cửa hàng đang hoạt động được chuyển dữ liệu.");
    const warehouseId = randomUUID(), roleId = randomUUID(), dataEpoch = randomUUID();
    await client.query("TRUNCATE TABLE " + [...goLiveTables, "sessions"].join(",") + " RESTART IDENTITY");
    await client.query("INSERT INTO warehouses(id,name) VALUES($1,'Kho cửa hàng')", [warehouseId]);
    await client.query("INSERT INTO roles(id,name,permissions,protected) VALUES($1,'Chủ cửa hàng',$2,true)", [roleId, [...permissionCatalog]]);
    await client.query("INSERT INTO users(id,username,name,password_hash,owner,active,must_change_password,warehouse_ids,created_at) VALUES($1,$2,$3,$4,true,true,true,$5,$6)", [owner.id, owner.username, owner.name, owner.password_hash, [warehouseId], owner.created_at]);
    await client.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [owner.id, roleId]);
    for (const [key, value] of Object.entries({ store: { name: "HTAgri", address: "", phone: "" }, data_epoch: dataEpoch, _stitch_permissions_v1: true, _ht_go_live_v1: { at: new Date().toISOString(), backupSha256, previousFingerprint: fingerprint } })) {
      await client.query("INSERT INTO settings(key,value) VALUES($1,$2)", [key, JSON.stringify(value)]);
    }
    await audit(client, owner.id, "TEST_DATA_CLEARED_FOR_OPERATIONS", null, { backupSha256, dataEpoch });
    const counts: Record<string, number> = {};
    for (const table of goLiveTables) counts[table] = (await client.query("SELECT COUNT(*)::int count FROM " + table)).rows[0].count;
    return { cleared: true, username: owner.username, mustChangePassword: true, dataEpoch, warehouseId, counts };
  });
}

@Controller("api/admin/go-live")
@UseGuards(SessionGuard)
export class GoLiveController {
  constructor(private readonly db: Database) {}
  private owner(request: AuthRequest) { if (!request.user.owner) throw new ForbiddenException("Chỉ chủ cửa hàng được thực hiện."); }

  @Post("prepare")
  async prepare(@Req() request: AuthRequest) {
    this.owner(request);
    return this.db.transaction(async client => {
      await assertTestStore(client);
      await client.query("INSERT INTO settings(key,value) VALUES('_go_live_lock','true') ON CONFLICT(key) DO UPDATE SET value='true'");
      return { maintenance: true };
    });
  }

  @Post("cancel")
  async cancel(@Req() request: AuthRequest) {
    this.owner(request);
    return this.db.transaction(async client => { await assertTestStore(client); await client.query("DELETE FROM settings WHERE key='_go_live_lock'"); return { maintenance: false }; });
  }

  @Get("backup")
  async backup(@Req() request: AuthRequest, @Res() response: Response) {
    this.owner(request);
    const snapshot = await this.db.transaction(async client => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await assertTestStore(client);
      const data = await goLiveSnapshot(client);
      if (!data.tables.settings.some(r => r.key === "_go_live_lock" && r.value === true)) throw new ConflictException("Chưa mở phiên bảo trì.");
      return { ...data, database: (await client.query("SELECT current_database() name")).rows[0].name };
    });
    const file = gzipSync(JSON.stringify({ format: "agristock-backup-v1", id: randomUUID(), database: snapshot.database, createdAt: new Date().toISOString(), tables: snapshot.tables }));
    response.set({ "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="pre-htagri-go-live.json.gz"', "Cache-Control": "no-store", "X-HTAgri-Fingerprint": snapshot.fingerprint, "X-Content-SHA256": sha(file) }).send(file);
  }

  @Post("reset")
  async reset(@Req() request: AuthRequest, @Body() body: unknown) {
    this.owner(request);
    const input = parse(z.object({ confirmation: z.literal("CLEAR_TEST_DATA_FOR_HTAGRI"), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), backupSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), body);
    return resetTestStore(this.db, request.user.id, input.fingerprint, input.backupSha256);
  }
}
