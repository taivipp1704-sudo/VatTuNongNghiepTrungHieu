import "reflect-metadata";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { INestApplication } from "@nestjs/common";
import { createApp } from "./main";
import { Database } from "./db";
import { seedDatabase } from "./seed";
import { defaultLoyaltySettings, loyaltyAmounts } from "./loyalty";
import { saleSchema } from "./validation";
import sharp from "sharp";
import { reportRange } from "./reports";

const config = JSON.parse(
  readFileSync(resolve(__dirname, "../../..", ".local/postgres.json"), "utf8"),
);
process.env.DATABASE_URL = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/agristock_test`;
process.env.NODE_ENV = "test";
let app: INestApplication;
let db: Database;
let origin: string;
const tokens: Record<string, string> = {};
const main = "10000000-0000-4000-8000-000000000001";
const secondary = "10000000-0000-4000-8000-000000000002";
const npk = "20000000-0000-4000-8000-000000000001";
const gloves = "20000000-0000-4000-8000-000000000006";
const future = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function request(
  path: string,
  body?: unknown,
  actor = "owner",
  key = randomUUID(),
  method?: string,
) {
  const response = await fetch(origin + "/api" + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (tokens[actor] || ""),
      "Idempotency-Key": key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

before(async () => {
  assert.ok(process.env.DATABASE_URL?.endsWith("/agristock_test"));
  const setup = new Pool({ connectionString: process.env.DATABASE_URL });
  await setup.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await setup.end();
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
  db = app.get(Database);
  const accounts = await seedDatabase(db);
  for (const account of accounts) {
    const response = await request("/auth/login", {
      username: account.username,
      password: account.password,
    });
    assert.equal(response.status, 201);
    tokens[account.username] = response.data.token;
    const blocked = await request("/bootstrap", undefined, account.username);
    assert.equal(blocked.status, 403);
    const changed = await request(
      "/auth/password",
      {
        currentPassword: account.password,
        newPassword: "AgriStock-Internal-Test-2026!",
      },
      account.username,
    );
    assert.equal(changed.status, 201);
  }
});
after(async () => {
  if (app) await app.close();
});

test("counter report ranges cover calendar weeks, leap months, quarters and years", () => {
  assert.deepEqual(
    [
      reportRange("WEEK", "2025-01-01").start,
      reportRange("WEEK", "2025-01-01").end,
    ],
    ["2024-12-30", "2025-01-06"],
  );
  assert.deepEqual(
    [
      reportRange("MONTH", "2024-02-29").start,
      reportRange("MONTH", "2024-02-29").end,
    ],
    ["2024-02-01", "2024-03-01"],
  );
  assert.deepEqual(
    [
      reportRange("QUARTER", "2025-12-31").start,
      reportRange("QUARTER", "2025-12-31").end,
    ],
    ["2025-10-01", "2026-01-01"],
  );
  assert.deepEqual(
    [
      reportRange("YEAR", "2024-02-29").start,
      reportRange("YEAR", "2024-02-29").end,
    ],
    ["2024-01-01", "2025-01-01"],
  );
  assert.throws(() => reportRange("DAY", "2025-02-29"));
});

test("revenue reports separate sales, later debt collections and returns by Vietnam calendar dates", async () => {
  const { customerId, products } = await loyaltyFixture();
  const sale = await request("/sales", {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    paid: 400000,
    method: "CASH",
  });
  assert.equal(sale.status, 201);
  await db.pool.query(
    "UPDATE orders SET created_at='2024-12-31T16:59:00Z' WHERE id=$1",
    [sale.data.id],
  );
  await db.pool.query(
    "UPDATE payments SET created_at='2024-12-31T16:59:00Z' WHERE order_id=$1",
    [sale.data.id],
  );
  const debt = (
    await db.pool.query("SELECT id FROM debts WHERE order_id=$1", [
      sale.data.id,
    ])
  ).rows[0];
  assert.equal(
    (
      await request("/debts/" + debt.id + "/pay", {
        amount: 600000,
        method: "CASH",
      })
    ).status,
    201,
  );
  await db.pool.query(
    "UPDATE payments SET created_at='2024-12-31T17:01:00Z' WHERE order_id=$1 AND amount=600000",
    [sale.data.id],
  );
  assert.equal(
    (
      await request("/orders/" + sale.data.id + "/return", {
        reason: "Kiểm tra trả ở kỳ sau",
      })
    ).status,
    201,
  );
  await db.pool.query(
    "UPDATE orders SET returned_at='2025-02-01T08:00:00+07' WHERE id=$1",
    [sale.data.id],
  );
  await db.pool.query(
    "UPDATE payments SET created_at='2025-02-01T08:00:00+07' WHERE order_id=$1 AND direction='OUT'",
    [sale.data.id],
  );
  const dec = await request(
    "/reports?period=DAY&anchor=2024-12-31&warehouseId=" + main,
  );
  assert.equal(dec.status, 200);
  assert.equal(dec.data.series.length, 24);
  assert.equal(dec.data.totals.revenue, 1000000);
  assert.equal(dec.data.totals.collected, 400000);
  assert.equal(dec.data.series[23].revenue, 1000000);
  assert.equal(dec.data.grossProfit, 500000);
  const jan = await request(
    "/reports?period=MONTH&anchor=2025-01-01&warehouseId=" + main,
  );
  assert.equal(jan.data.series.length, 31);
  assert.equal(jan.data.totals.revenue, 0);
  assert.equal(jan.data.totals.collected, 600000);
  const feb = await request(
    "/reports?period=MONTH&anchor=2025-02-01&warehouseId=" + main,
  );
  assert.equal(feb.data.series.length, 28);
  assert.equal(feb.data.totals.revenue, -1000000);
  assert.equal(feb.data.totals.collected, -1000000);
  assert.equal(feb.data.totals.returns, 1);
  assert.equal(feb.data.grossProfit, -500000);
  const other = await request(
    "/reports?period=YEAR&anchor=2025-01-01&warehouseId=" + secondary,
  );
  assert.equal(other.data.series.length, 12);
  assert.equal(other.data.totals.revenue, 0);
  assert.equal((await request("/reports?period=BAD")).status, 400);
  assert.equal(
    (await request("/reports?period=MONTH&anchor=2025-02-30")).status,
    400,
  );
  assert.equal((await request("/reports", undefined, "banhang")).status, 403);
});

test("customer purchase history and reports enforce warehouse access and redact costs", async () => {
  const { customerId, products } = await loyaltyFixture();
  const sale = await request("/sales", {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    paid: 100000,
    method: "CASH",
  });
  assert.equal(sale.status, 201);
  const role = await request("/admin/roles", {
    name: "Xem lịch sử và doanh thu không giá vốn",
    permissions: ["reports.view", "partners.view", "sales.view"],
  });
  const username = "counter-report-test",
    password = "Counter-Report-Test-2026!";
  const user = await request("/admin/users", {
    username,
    password,
    name: "Kiểm tra báo cáo",
    roleIds: [role.data.id],
    warehouseIds: [main],
  });
  assert.equal(user.status, 201);
  tokens.counterReporter = (
    await request("/auth/login", { username, password })
  ).data.token;
  await request(
    "/auth/password",
    { currentPassword: password, newPassword: "Counter-Report-Changed-2026!" },
    "counterReporter",
  );
  const history = await request(
    "/partners/" + customerId + "/purchases",
    undefined,
    "counterReporter",
  );
  assert.equal(history.status, 200);
  assert.equal(history.data.summary.spent, 1000000);
  assert.equal(history.data.summary.paid, 100000);
  assert.equal(history.data.summary.outstanding, 900000);
  assert.equal(history.data.orders[0].id, sale.data.id);
  assert.equal(JSON.stringify(history.data).includes("costBase"), false);
  const filtered = await request(
    "/orders?customerId=" + customerId,
    undefined,
    "counterReporter",
  );
  assert.equal(filtered.data.length, 1);
  const report = await request(
    "/reports?period=QUARTER",
    undefined,
    "counterReporter",
  );
  assert.equal(report.status, 200);
  assert.equal(report.data.series.length, 3);
  assert.equal("grossProfit" in report.data, false);
  assert.equal(JSON.stringify(report.data).includes('"cost"'), false);
  assert.equal(
    (
      await request(
        "/reports?warehouseId=" + secondary,
        undefined,
        "counterReporter",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/partners/" + customerId + "/purchases?warehouseId=" + secondary,
        undefined,
        "counterReporter",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/partners/" + customerId + "/purchases?page=0")).status,
    400,
  );
  assert.equal(
    (await request("/partners/" + customerId + "/purchases", undefined, "kho"))
      .status,
    403,
  );
});

test("employee roles, warehouses and active state can be saved independently without granting access", async () => {
  const role = await request("/admin/roles", {
    name: "Kiểm tra gán quyền độc lập",
    permissions: ["inventory.view", "inventory.receipt.create", "sales.view"],
  });
  assert.equal(role.status, 201);
  const initialPassword = "Unassigned-Employee-Test-2026!";
  const currentPassword = "Unassigned-Employee-Changed-2026!";
  const username = "unassigned-employee-test";
  const created = await request("/admin/users", {
    username,
    name: "Nhân viên chưa gán quyền",
    password: initialPassword,
    roleIds: [],
    warehouseIds: [],
  });
  assert.equal(created.status, 201);
  const initial = await request("/auth/login", {
    username,
    password: initialPassword,
  });
  assert.equal(initial.status, 201);
  tokens.independentEmployee = initial.data.token;
  assert.equal(
    (
      await request(
        "/auth/password",
        { currentPassword: initialPassword, newPassword: currentPassword },
        "independentEmployee",
      )
    ).status,
    201,
  );
  for (const active of [true, false]) {
    for (const withRole of [true, false]) {
      for (const withWarehouse of [true, false]) {
        const body = {
          active,
          roleIds: withRole ? [role.data.id] : [],
          warehouseIds: withWarehouse ? [main] : [],
        };
        const saved = await request(
          "/admin/users/" + created.data.id,
          body,
          "owner",
          randomUUID(),
          "PATCH",
        );
        assert.equal(saved.status, 200, JSON.stringify(body));
        assert.equal(
          (await request("/me", undefined, "independentEmployee")).status,
          401,
          "Old session must be revoked",
        );
        const login = await request("/auth/login", {
          username,
          password: currentPassword,
        });
        if (!active) {
          assert.equal(login.status, 401);
          continue;
        }
        assert.equal(login.status, 201);
        tokens.independentEmployee = login.data.token;
        assert.deepEqual(login.data.user.warehouseIds, body.warehouseIds);
        assert.equal(login.data.user.roles.length, withRole ? 1 : 0);
        assert.equal(
          login.data.user.permissions.includes("inventory.view"),
          withRole,
        );
        const bootstrap = await request(
          "/bootstrap",
          undefined,
          "independentEmployee",
        );
        assert.equal(bootstrap.data.warehouses.length, withWarehouse ? 1 : 0);
        const inventory = await request(
          "/inventory",
          undefined,
          "independentEmployee",
        );
        assert.equal(inventory.status, withRole ? 200 : 403);
        if (withRole && !withWarehouse) {
          assert.ok(inventory.data.every((p: any) => p.lots.length === 0));
          assert.equal(
            (
              await request(
                "/inventory?warehouseId=" + main,
                undefined,
                "independentEmployee",
              )
            ).status,
            403,
          );
          assert.deepEqual(
            (await request("/orders", undefined, "independentEmployee")).data,
            [],
          );
        }
      }
    }
  }
  const owner = await request("/me");
  assert.equal(
    (
      await request(
        "/admin/users/" + owner.data.id,
        { active: false, roleIds: [], warehouseIds: [] },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal((await request("/me")).status, 200);
});

test("uploaded product photos validate content, bind once, survive omitted fields, replace and delete transactionally", async () => {
  const base64 = (
    await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#176b46" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
  assert.equal(
    (await request("/photos/product", { base64 }, "banhang")).status,
    403,
  );
  assert.equal(
    (await request("/photos/product", { base64 }, "anonymous")).status,
    401,
  );
  assert.equal(
    (
      await request("/photos/product", {
        base64: Buffer.from("<svg>fake</svg>").toString("base64"),
      })
    ).status,
    400,
  );
  const key = randomUUID();
  const uploaded = await request("/photos/product", { base64 }, "owner", key);
  assert.equal(uploaded.status, 201);
  assert.deepEqual(
    (await request("/photos/product", { base64 }, "owner", key)).data,
    uploaded.data,
  );
  const { products } = await loyaltyFixture();
  const item = products[0];
  const patch = (imageUrl?: string) =>
    request(
      "/products/" + item.id,
      { ...item.body, ...(imageUrl !== undefined ? { imageUrl } : {}) },
      "owner",
      randomUUID(),
      "PATCH",
    );
  assert.equal((await patch(uploaded.data.imageUrl)).status, 200);
  const viewed = await request(
    "/photos/" + uploaded.data.id,
    undefined,
    "banhang",
  );
  assert.equal(viewed.status, 200);
  assert.match(viewed.data.dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal((await patch()).status, 200);
  assert.equal((await request("/photos/" + uploaded.data.id)).status, 200);
  assert.equal(
    (
      await request(
        "/products/" + products[1].id,
        { ...products[1].body, imageUrl: uploaded.data.imageUrl },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal((await patch("/api/photos/" + randomUUID())).status, 400);
  assert.equal((await request("/photos/" + uploaded.data.id)).status, 200);
  const replacement = await request("/photos/product", { base64 });
  assert.equal((await patch(replacement.data.imageUrl)).status, 200);
  assert.equal((await request("/photos/" + uploaded.data.id)).status, 404);
  assert.equal((await patch("")).status, 200);
  assert.equal((await request("/photos/" + replacement.data.id)).status, 404);
  const stored = (
    await db.pool.query("SELECT image_url FROM products WHERE id=$1", [item.id])
  ).rows[0];
  assert.equal(stored.image_url, "");
});

test("non-owner administrators may reduce or disable their own access without escalating or altering the owner", async () => {
  const role = await request("/admin/roles", {
    name: "Quản trị nhân viên kiểm thử tự lưu",
    permissions: ["users.manage"],
  });
  const username = "self-edit-admin-test";
  const password = "Self-Edit-Admin-Test-2026!";
  const changedPassword = "Self-Edit-Admin-Changed-2026!";
  const created = await request("/admin/users", {
    username,
    name: "Quản trị tự chỉnh",
    password,
    roleIds: [role.data.id],
    warehouseIds: [main],
  });
  assert.equal(created.status, 201);
  const login = await request("/auth/login", { username, password });
  tokens.selfEditAdmin = login.data.token;
  assert.equal(
    (
      await request(
        "/auth/password",
        { currentPassword: password, newPassword: changedPassword },
        "selfEditAdmin",
      )
    ).status,
    201,
  );
  const adminRole = await request("/admin/roles", {
    name: "Quyền ngoài phạm vi người sửa",
    permissions: ["users.manage", "roles.manage"],
  });
  assert.equal(
    (
      await request(
        "/admin/users/" + created.data.id,
        { active: true, roleIds: [adminRole.data.id], warehouseIds: [main] },
        "selfEditAdmin",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  const owner = await request("/me");
  assert.equal(
    (
      await request(
        "/admin/users/" + owner.data.id,
        { active: false, roleIds: [], warehouseIds: [] },
        "selfEditAdmin",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/admin/users/" + created.data.id,
        { active: true, roleIds: [], warehouseIds: [] },
        "selfEditAdmin",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal((await request("/me", undefined, "selfEditAdmin")).status, 401);
  const reducedLogin = await request("/auth/login", {
    username,
    password: changedPassword,
  });
  assert.equal(reducedLogin.status, 201);
  assert.deepEqual(reducedLogin.data.user.permissions, []);
  tokens.selfEditAdmin = reducedLogin.data.token;
  assert.equal(
    (await request("/admin/users", undefined, "selfEditAdmin")).status,
    403,
  );
  // Re-enable only the existing admin role as owner, then test independent self-locking.
  assert.equal(
    (
      await request(
        "/admin/users/" + created.data.id,
        { active: true, roleIds: [role.data.id], warehouseIds: [main] },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  tokens.selfEditAdmin = (
    await request("/auth/login", { username, password: changedPassword })
  ).data.token;
  assert.equal(
    (
      await request(
        "/admin/users/" + created.data.id,
        { active: false, roleIds: [role.data.id], warehouseIds: [main] },
        "selfEditAdmin",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/auth/login", { username, password: changedPassword }))
      .status,
    401,
  );
});

test("delivery evidence is scoped, idempotent, retained on returns and confirms delivery atomically", async () => {
  const { products } = await loyaltyFixture();
  const sold = await request("/sales", {
    warehouseId: main,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    paid: 1000000,
    method: "CASH",
    deliveryStatus: "SHIPPING",
  });
  assert.equal(sold.status, 201);
  const path = "/orders/" + sold.data.id + "/photos";
  const base64 = (
    await sharp({
      create: { width: 32, height: 24, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
  const body = { base64, confirmDelivered: true, note: "Đã giao đủ hàng" };
  assert.equal((await request(path, body, "banhang")).status, 403);
  const role = await request("/admin/roles", {
    name: "Nhân viên giao hàng kiểm thử",
    permissions: ["sales.view", "sales.fulfillment"],
  });
  const password = "Delivery-Photo-Test-2026!";
  const staff = await request("/admin/users", {
    username: "delivery-photo",
    name: "Giao hàng",
    password,
    roleIds: [role.data.id],
    warehouseIds: [main],
  });
  assert.equal(staff.status, 201);
  const login = await request("/auth/login", {
    username: "delivery-photo",
    password,
  });
  tokens.deliveryPhoto = login.data.token;
  assert.equal(
    (
      await request(
        "/auth/password",
        {
          currentPassword: password,
          newPassword: "Delivery-Photo-Changed-2026!",
        },
        "deliveryPhoto",
      )
    ).status,
    201,
  );
  const key = randomUUID();
  const added = await request(path, body, "deliveryPhoto", key);
  assert.equal(added.status, 201);
  assert.deepEqual(
    (await request(path, body, "deliveryPhoto", key)).data,
    added.data,
  );
  assert.equal(
    (await request(path, { ...body, note: "changed" }, "deliveryPhoto", key))
      .status,
    409,
  );
  assert.equal(
    (await request(path, undefined, "deliveryPhoto")).data.length,
    1,
  );
  assert.equal(
    (await request("/photos/" + added.data.id, undefined, "banhang")).status,
    404,
  );
  assert.equal(
    (await request("/photos/" + added.data.id, undefined, "deliveryPhoto"))
      .status,
    200,
  );
  await db.pool.query("UPDATE users SET warehouse_ids=$2 WHERE id=$1", [
    staff.data.id,
    [secondary],
  ]);
  assert.equal((await request(path, undefined, "deliveryPhoto")).status, 403);
  assert.equal((await request(path, body, "deliveryPhoto")).status, 403);
  assert.equal(
    (await request("/photos/" + added.data.id, undefined, "deliveryPhoto"))
      .status,
    403,
  );
  await db.pool.query("UPDATE users SET warehouse_ids=$2 WHERE id=$1", [
    staff.data.id,
    [main],
  ]);
  const order = (
    await db.pool.query("SELECT delivery_status FROM orders WHERE id=$1", [
      sold.data.id,
    ])
  ).rows[0];
  assert.equal(order.delivery_status, "DELIVERED");
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await request(path, { base64 }, "deliveryPhoto")).status,
      201,
    );
  assert.equal((await request(path, { base64 }, "deliveryPhoto")).status, 409);
  assert.equal(
    (
      await request("/orders/" + sold.data.id + "/return", {
        reason: "Kiểm thử lưu ảnh khi trả hàng",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(path, undefined, "deliveryPhoto")).data.length,
    5,
  );
  assert.equal((await request(path, body, "deliveryPhoto")).status, 409);
  assert.equal(
    (await request("/photos/" + added.data.id, undefined, "deliveryPhoto"))
      .status,
    200,
  );
});

test("warehouse scope and cost redaction are enforced at the API", async () => {
  const result = await request("/inventory", undefined, "kho");
  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(result.data).includes("cost_base"), false);
  assert.equal(JSON.stringify(result.data).includes("costBase"), false);
  assert.equal(
    (await request("/inventory?warehouseId=" + secondary, undefined, "kho"))
      .status,
    403,
  );
  assert.equal((await request("/admin/users", undefined, "kho")).status, 403);
  assert.equal(
    (
      await request(
        "/sales",
        {
          warehouseId: main,
          lines: [{ productId: gloves, quantity: 1, unit: "BASE" }],
          paid: 18000,
          method: "CASH",
        },
        "kho",
      )
    ).status,
    403,
  );
});

test("draft receipt does not change stock; posting and retries change it once", async () => {
  const before = (
    await db.pool.query(
      "SELECT sum(quantity)::numeric quantity FROM lots WHERE product_id=$1 AND warehouse_id=$2",
      [npk, main],
    )
  ).rows[0].quantity;
  const created = await request(
    "/documents",
    {
      kind: "RECEIPT",
      warehouseId: main,
      reason: "Nhập bổ sung kiểm thử",
      status: "DRAFT",
      lines: [
        {
          productId: npk,
          lotCode: "TEST-EARLY",
          expiresOn: future(3),
          quantity: 2,
          unit: "BASE",
        },
      ],
    },
    "kho",
  );
  assert.equal(created.status, 201);
  assert.equal(
    (await request("/documents/" + created.data.id + "/post", {})).status,
    409,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT sum(quantity)::numeric quantity FROM lots WHERE product_id=$1 AND warehouse_id=$2",
        [npk, main],
      )
    ).rows[0].quantity,
    before,
  );
  assert.equal(
    (await request("/documents/" + created.data.id + "/submit", {}, "kho"))
      .status,
    201,
  );
  const key = randomUUID();
  const first = await request(
    "/documents/" + created.data.id + "/post",
    {},
    "owner",
    key,
  );
  const retry = await request(
    "/documents/" + created.data.id + "/post",
    {},
    "owner",
    key,
  );
  assert.equal(first.status, 201);
  assert.deepEqual(first.data, retry.data);
  assert.equal(
    (
      await db.pool.query(
        "SELECT sum(quantity)::numeric quantity FROM lots WHERE product_id=$1 AND warehouse_id=$2",
        [npk, main],
      )
    ).rows[0].quantity,
    before + 2,
  );
});

test("FEFO chooses the earliest eligible lot and rejects expired goods", async () => {
  const result = await request("/sales", {
    warehouseId: main,
    lines: [{ productId: npk, quantity: 1, unit: "BASE" }],
    paid: 10000,
    method: "CASH",
  });
  assert.equal(result.status, 201);
  const lot = (
    await db.pool.query("SELECT code FROM lots WHERE id=$1", [
      result.data.lines[0].allocations[0].lotId,
    ])
  ).rows[0];
  assert.equal(lot.code, "TEST-EARLY");
  const expired = await request("/sales", {
    warehouseId: main,
    lines: [
      {
        productId: "20000000-0000-4000-8000-000000000005",
        quantity: 1,
        unit: "BASE",
      },
    ],
    paid: 35000,
    method: "CASH",
  });
  assert.equal(expired.status, 409);
});

test("two devices cannot both sell the final available unit", async () => {
  const product = await request("/products", {
    sku: "RACE-ONE",
    name: "Vật tư kiểm thử đồng thời",
    category: "Vật tư",
    baseUnit: "cái",
    packUnit: "hộp",
    packFactor: 1,
    priceBase: 1000,
    pricePack: 1000,
    costBase: 500,
    minStock: 0,
    trackLots: false,
  });
  assert.equal(product.status, 201);
  const receipt = await request("/documents", {
    kind: "RECEIPT",
    warehouseId: main,
    reason: "Tồn kiểm thử đồng thời",
    lines: [{ productId: product.data.id, quantity: 1, unit: "BASE" }],
  });
  assert.equal(receipt.status, 201);
  assert.equal(
    (await request("/documents/" + receipt.data.id + "/post", {})).status,
    201,
  );
  const input = {
    warehouseId: main,
    lines: [{ productId: product.data.id, quantity: 1, unit: "BASE" }],
    paid: 1000,
    method: "CASH",
  };
  const results = await Promise.all([
    request("/sales", input),
    request("/sales", input, "banhang"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.pool.query(
        "SELECT sum(quantity)::numeric quantity FROM lots WHERE product_id=$1",
        [product.data.id],
      )
    ).rows[0].quantity,
    0,
  );
});

test("concurrent idempotent sales create one order; changing payload conflicts", async () => {
  const input = {
    warehouseId: main,
    lines: [{ productId: gloves, quantity: 1, unit: "BASE" }],
    paid: 18000,
    method: "CASH",
  };
  const key = randomUUID();
  const results = await Promise.all([
    request("/sales", input, "banhang", key),
    request("/sales", input, "banhang", key),
  ]);
  assert.equal(results[0].status, 201);
  assert.deepEqual(results[0].data, results[1].data);
  assert.equal(JSON.stringify(results[0].data).includes("costBase"), false);
  assert.equal(
    (
      await db.pool.query(
        "SELECT COUNT(*)::int count FROM orders WHERE id=$1",
        [results[0].data.id],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (await request("/sales", { ...input, paid: 0 }, "banhang", key)).status,
    409,
  );
});

test("server validates price edits, discounts, customer debt and credit method", async () => {
  const input = {
    warehouseId: main,
    lines: [{ productId: gloves, quantity: 1, unit: "BASE", unitPrice: 1 }],
    paid: 1,
    method: "CASH",
  };
  assert.equal((await request("/sales", input, "banhang")).status, 403);
  assert.equal(
    (
      await request(
        "/sales",
        {
          ...input,
          lines: [{ productId: gloves, quantity: 1, unit: "BASE" }],
          paid: 17000,
          discount: 1000,
        },
        "banhang",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/sales",
        {
          ...input,
          lines: [{ productId: gloves, quantity: 1, unit: "BASE" }],
          paid: 0,
        },
        "banhang",
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/sales", { ...input, method: "CREDIT" }, "owner")).status,
    400,
  );
});

test("partial collection and replay preserve debt and payment totals", async () => {
  const customer = (
    await db.pool.query("SELECT id FROM partners WHERE kind='CUSTOMER' LIMIT 1")
  ).rows[0].id;
  const sold = await request(
    "/sales",
    {
      warehouseId: main,
      customerId: customer,
      lines: [{ productId: gloves, quantity: 2, unit: "BASE" }],
      paid: 10000,
      method: "CASH",
    },
    "banhang",
  );
  assert.equal(sold.status, 201);
  assert.equal(sold.data.debt, 26000);
  const debt = (
    await db.pool.query("SELECT id FROM debts WHERE order_id=$1", [
      sold.data.id,
    ])
  ).rows[0].id;
  const key = randomUUID();
  const paid = await request(
    "/debts/" + debt + "/pay",
    { amount: 1000, method: "CASH" },
    "ketoan",
    key,
  );
  assert.equal(paid.data.balance, 25000);
  const repeated = await request(
    "/debts/" + debt + "/pay",
    { amount: 1000, method: "CASH" },
    "ketoan",
    key,
  );
  assert.deepEqual(paid.data, repeated.data);
  assert.equal(
    (
      await request(
        "/debts/" + debt + "/pay",
        { amount: 26000, method: "CASH" },
        "ketoan",
      )
    ).status,
    400,
  );
  const returned = await request("/orders/" + sold.data.id + "/return", {
    reason: "Khách trả toàn bộ đơn kiểm thử",
    refundMethod: "TRANSFER",
  });
  assert.equal(returned.status, 201);
  assert.equal(returned.data.refund, 11000);
  assert.equal(
    (
      await db.pool.query(
        "SELECT method FROM payments WHERE order_id=$1 AND direction='OUT'",
        [sold.data.id],
      )
    ).rows[0].method,
    "TRANSFER",
  );
  assert.equal(
    (await db.pool.query("SELECT balance FROM debts WHERE id=$1", [debt]))
      .rows[0].balance,
    0,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT COUNT(*)::int count FROM stock_ledger l JOIN lots lot ON lot.id=l.lot_id WHERE l.order_id=$1 AND lot.state='QUARANTINE'",
        [sold.data.id],
      )
    ).rows[0].count,
    1,
  );
});

test("failed multi-line posting rolls back all stock changes", async () => {
  const lot = (
    await db.pool.query(
      "SELECT id,quantity FROM lots WHERE product_id=$1 AND warehouse_id=$2 AND quantity>10 ORDER BY quantity DESC LIMIT 1",
      [npk, main],
    )
  ).rows[0];
  const document = await request("/documents", {
    kind: "ISSUE",
    warehouseId: main,
    reason: "Kiểm thử rollback toàn phiếu",
    lines: [
      { productId: npk, lotId: lot.id, quantity: 1, unit: "BASE" },
      { productId: gloves, lotId: randomUUID(), quantity: 1, unit: "BASE" },
    ],
  });
  assert.equal(document.status, 201);
  assert.equal(
    (await request("/documents/" + document.data.id + "/post", {})).status,
    400,
  );
  assert.equal(
    (await db.pool.query("SELECT quantity FROM lots WHERE id=$1", [lot.id]))
      .rows[0].quantity,
    lot.quantity,
  );
  assert.equal(
    (
      await db.pool.query("SELECT status FROM stock_documents WHERE id=$1", [
        document.data.id,
      ])
    ).rows[0].status,
    "PENDING",
  );
});

test("invoice provider is explicitly unavailable and owner is protected", async () => {
  const invoice = (await db.pool.query("SELECT id FROM invoices LIMIT 1"))
    .rows[0].id;
  assert.equal(
    (await request("/invoices/" + invoice + "/issue", {})).status,
    503,
  );
  const owner = (await db.pool.query("SELECT id FROM users WHERE owner"))
    .rows[0].id;
  const role = (
    await db.pool.query("SELECT id FROM roles WHERE NOT protected LIMIT 1")
  ).rows[0].id;
  assert.equal(
    (
      await request(
        "/admin/users/" + owner,
        { active: false, roleIds: [role], warehouseIds: [main] },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
});

test("multiple roles combine; revocation and account disable take effect immediately", async () => {
  const roleIds = (
    await db.pool.query(
      "SELECT id FROM roles WHERE name IN ('Nhân viên kho','Nhân viên bán hàng')",
    )
  ).rows.map((row) => row.id);
  const created = await request("/admin/users", {
    username: "combined",
    name: "Nhân viên kiêm nhiệm",
    password: "AgriStock-Combined-Test!",
    roleIds,
    warehouseIds: [main],
  });
  assert.equal(created.status, 201);
  const logged = await request("/auth/login", {
    username: "combined",
    password: "AgriStock-Combined-Test!",
  });
  tokens.combined = logged.data.token;
  await request(
    "/auth/password",
    {
      currentPassword: "AgriStock-Combined-Test!",
      newPassword: "AgriStock-Combined-Changed!",
    },
    "combined",
  );
  const user = await request("/me", undefined, "combined");
  assert.ok(user.data.permissions.includes("sales.create"));
  assert.ok(user.data.permissions.includes("inventory.receipt.create"));
  assert.equal(
    (
      await request(
        "/admin/users/" + created.data.id,
        { active: false, roleIds, warehouseIds: [main] },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal((await request("/me", undefined, "combined")).status, 401);
  const warehouseRole = (
    await db.pool.query("SELECT id FROM roles WHERE name='Nhân viên kho'")
  ).rows[0];
  await db.pool.query(
    "UPDATE roles SET permissions=array_append(permissions,'roles.manage') WHERE id=$1",
    [warehouseRole.id],
  );
  assert.equal(
    (
      await request(
        "/admin/roles",
        { name: "Vượt quyền kiểm thử", permissions: ["inventory.cost.view"] },
        "kho",
      )
    ).status,
    400,
  );
  await db.pool.query(
    "UPDATE roles SET permissions=array_remove(permissions,'inventory.view') WHERE id=$1",
    [warehouseRole.id],
  );
  assert.equal((await request("/inventory", undefined, "kho")).status, 403);
});

async function loyaltyFixture() {
  const customerId = randomUUID();
  await db.pool.query(
    "INSERT INTO partners(id,name,kind,credit_limit) VALUES($1,'Khách tích điểm kiểm thử','CUSTOMER',1000000000)",
    [customerId],
  );
  const products = [];
  for (const [index, rate] of [0.1, 0.5].entries()) {
    const productId = randomUUID();
    const product = {
      sku: "LOY-" + productId,
      name: index === 0 ? "Phân bón tích điểm" : "Thuốc tích điểm",
      category: index === 0 ? "Phân bón" : "Thuốc BVTV",
      baseUnit: "cái",
      packUnit: "hộp",
      packFactor: 1,
      priceBase: 1_000_000,
      pricePack: 1_000_000,
      costBase: 500_000,
      minStock: 0,
      trackLots: false,
    };
    // The ordinary product endpoint supports creating a configured item too.
    const created = await request("/products", {
      ...product,
      loyaltyRate: rate,
    });
    assert.equal(created.status, 201);
    await db.pool.query(
      "INSERT INTO lots(id,product_id,warehouse_id,code,quantity,cost_base) VALUES($1,$2,$3,'LOYALTY-TEST',100,500000)",
      [randomUUID(), created.data.id, main],
    );
    products.push({ id: created.data.id, body: product, rate });
  }
  return { customerId, products };
}

test("all product groups accept bottle units, create and edit without fertilizer-only rules", async()=>{
  for(const category of ["Phân bón","Thuốc BVTV","Hạt giống","Vật tư"]){
    const body={sku:"GROUP-"+randomUUID(),name:"Hàng "+category,category,baseUnit:"chai",packUnit:"chai",packFactor:1,priceBase:25000,pricePack:25000,costBase:15000,minStock:0,trackLots:true};
    const created=await request("/products",body);assert.equal(created.status,201,JSON.stringify(created.data));
    const edited=await request("/products/"+created.data.id,{...body,name:body.name+" đã sửa"},"owner",randomUUID(),"PATCH");assert.equal(edited.status,200);
    const stored=(await db.pool.query("SELECT category,base_unit,pack_factor FROM products WHERE id=$1",[created.data.id])).rows[0];
    assert.equal(stored.category,category);assert.equal(stored.base_unit,"chai");assert.equal(stored.pack_factor,1);
  }
});

async function negativeFixture(){
  const product=await request("/products",{sku:"NEG-"+randomUUID(),name:"Thuốc BVTV bán chai",category:"Thuốc BVTV",baseUnit:"chai",packUnit:"chai",packFactor:1,priceBase:10000,pricePack:10000,costBase:4000,minStock:0,trackLots:false});
  assert.equal(product.status,201);return product.data.id as string;
}
async function receiveNegative(id:string,qty:number,cost=5000){
  const doc=await request("/documents",{kind:"RECEIPT",warehouseId:main,reason:"Nhập bù tồn âm kiểm thử",status:"PENDING",lines:[{productId:id,lotCode:"NHAP-"+randomUUID(),quantity:qty,unit:"BASE",costBase:cost}]});
  assert.equal(doc.status,201);return doc.data.id as string;
}
async function negativeStock(id:string){
  return (await db.pool.query("SELECT COALESCE(sum(quantity),0)::numeric actual,COALESCE(sum(CASE WHEN state='AVAILABLE' AND (expires_on IS NULL OR expires_on>=CURRENT_DATE) THEN quantity-reserved ELSE 0 END),0)::numeric available FROM lots WHERE product_id=$1 AND warehouse_id=$2",[id,main])).rows[0];
}
test("negative stock is store/role guarded; 100 sold to zero, then -1, receipt 10 makes 9 exactly once",async()=>{
  const id=await negativeFixture();
  const sale=(quantity=1)=>({warehouseId:main,lines:[{productId:id,quantity,unit:"BASE"}],paid:10000*quantity,method:"CASH"});
  assert.equal((await request("/sales",sale())).status,409);
  assert.equal((await request("/settings/inventory",{allowNegativeStock:true},"banhang")).status,403);
  assert.equal((await request("/settings/inventory",{allowNegativeStock:true})).status,201);
  try{
    assert.equal((await request("/sales",sale(),"banhang")).status,403);
    const first=await receiveNegative(id,100,4000);assert.equal((await request("/documents/"+first+"/post",{})).status,201);
    assert.equal((await request("/sales",sale(100))).status,201);assert.equal((await negativeStock(id)).actual,0);
    const key=randomUUID(),sold=await request("/sales",sale(),"owner",key);assert.equal(sold.status,201);
    assert.deepEqual((await request("/sales",sale(),"owner",key)).data,sold.data);assert.equal((await negativeStock(id)).actual,-1);
    const doc=await receiveNegative(id,10);assert.equal((await negativeStock(id)).actual,-1);
    const postKey=randomUUID();assert.equal((await request("/documents/"+doc+"/post",{},"owner",postKey)).status,201);
    assert.equal((await request("/documents/"+doc+"/post",{},"owner",postKey)).status,201);
    assert.deepEqual(await negativeStock(id),{actual:9,available:9});
    const real=(await db.pool.query("SELECT min(quantity) lowest FROM lots WHERE product_id=$1 AND NOT is_deficit",[id])).rows[0];assert.ok(real.lowest>=0);
    const movements=(await db.pool.query("SELECT sum(GREATEST(g.delta,0)) incoming,sum(GREATEST(-g.delta,0)) outgoing FROM stock_ledger g JOIN lots l ON l.id=g.lot_id WHERE l.product_id=$1 AND NOT g.is_reconciliation",[id])).rows[0];assert.equal(movements.incoming,110);assert.equal(movements.outgoing,101);
    const report=await request("/management/reports/inventory?period=DAY&warehouseId="+main);assert.equal(report.status,200);
    const row=report.data.items.find((r:any)=>r.id===id);assert.equal(row.incoming,110);assert.equal(row.outgoing,101);assert.equal(row.closing,9);
    const order=(await db.pool.query("SELECT lines FROM orders WHERE id=$1",[sold.data.id])).rows[0];assert.equal(order.lines[0].allocations[0].costBase,4000);assert.equal(order.lines[0].allocations[0].deficit,true);
    const other=(await db.pool.query("SELECT COALESCE(sum(quantity),0)::numeric qty FROM lots WHERE product_id=$1 AND warehouse_id=$2",[id,secondary])).rows[0];assert.equal(other.qty,0);
  }finally{await request("/settings/inventory",{allowNegativeStock:false});}
});
test("partial replenishment and returned quarantined goods reconcile without double counting",async()=>{
  const id=await negativeFixture();await request("/settings/inventory",{allowNegativeStock:true});
  try{
    const sold=await request("/sales",{warehouseId:main,lines:[{productId:id,quantity:5,unit:"BASE"}],paid:50000,method:"CASH"});assert.equal(sold.status,201);
    const doc=await receiveNegative(id,2);await request("/documents/"+doc+"/post",{});assert.equal((await negativeStock(id)).actual,-3);
    await request("/settings/inventory",{allowNegativeStock:false});
    assert.equal((await request("/orders/"+sold.data.id+"/return",{reason:"Khách trả đủ hàng bán âm"})).status,201);
    assert.deepEqual(await negativeStock(id),{actual:2,available:-3});
    const quarantine=(await db.pool.query("SELECT id FROM lots WHERE product_id=$1 AND state='QUARANTINE'",[id])).rows[0];
    assert.equal((await request("/lots/"+quarantine.id+"/release",{reason:"Đã kiểm tra hàng trả còn nguyên"})).status,201);
    assert.deepEqual(await negativeStock(id),{actual:2,available:2});
  }finally{await request("/settings/inventory",{allowNegativeStock:false});}
});
test("concurrent negative sales serialize one shortage bucket; ordinary lots remain nonnegative",async()=>{
  const id=await negativeFixture();await request("/settings/inventory",{allowNegativeStock:true});
  try{
    const body={warehouseId:main,lines:[{productId:id,quantity:1,unit:"BASE"}],paid:10000,method:"CASH"};
    const sales=await Promise.all([request("/sales",body),request("/sales",body)]);assert.deepEqual(sales.map(r=>r.status),[201,201]);
    assert.equal((await negativeStock(id)).actual,-2);
    const buckets=(await db.pool.query("SELECT count(*)::int count FROM lots WHERE product_id=$1 AND is_deficit",[id])).rows[0];assert.equal(buckets.count,1);
    const docs=await Promise.all([receiveNegative(id,1),receiveNegative(id,3)]);
    const posts=await Promise.all(docs.map(doc=>request("/documents/"+doc+"/post",{})));assert.deepEqual(posts.map(r=>r.status),[201,201]);
    assert.deepEqual(await negativeStock(id),{actual:2,available:2});
  }finally{await request("/settings/inventory",{allowNegativeStock:false});}
});

test("staff negative permission respects warehouse scope; expired and quarantined lots are never allocated",async()=>{
  const id=await negativeFixture();await request("/settings/inventory",{allowNegativeStock:true});
  try{
    const role=await request("/admin/roles",{name:"Bán âm "+randomUUID(),permissions:["sales.create","sales.view","sales.negative"]});
    const password="Negative-Staff-2026!",username="neg-"+randomUUID().slice(0,8);
    assert.equal((await request("/admin/users",{username,name:"Nhân viên bán âm",password,roleIds:[role.data.id],warehouseIds:[main]})).status,201);
    const login=await request("/auth/login",{username,password});tokens.negativeStaff=login.data.token;
    assert.equal((await request("/auth/password",{currentPassword:password,newPassword:password+"Changed"},"negativeStaff")).status,201);
    const expiredId=randomUUID(),quarantineId=randomUUID();
    await db.pool.query("INSERT INTO lots(id,product_id,warehouse_id,code,quantity,cost_base,expires_on) VALUES($1,$2,$3,'EXPIRED',3,4000,CURRENT_DATE-1)",[expiredId,id,main]);
    await db.pool.query("INSERT INTO lots(id,product_id,warehouse_id,code,quantity,cost_base,state) VALUES($1,$2,$3,'QUARANTINE',2,4000,'QUARANTINE')",[quarantineId,id,main]);
    const body={warehouseId:main,lines:[{productId:id,quantity:1,unit:"BASE"}],paid:10000,method:"CASH"};
    const sold=await request("/sales",body,"negativeStaff");assert.equal(sold.status,201);
    const lines=(await db.pool.query("SELECT lines FROM orders WHERE id=$1",[sold.data.id])).rows[0].lines;assert.equal(lines[0].allocations.length,1);assert.equal(lines[0].allocations[0].deficit,true);
    assert.equal((await request("/sales",{...body,warehouseId:secondary},"negativeStaff")).status,403);
    await request("/settings/inventory",{allowNegativeStock:false});assert.equal((await request("/sales",body,"negativeStaff")).status,409);
    const unchanged=(await db.pool.query("SELECT sum(quantity) qty FROM lots WHERE id=ANY($1::uuid[])",[[expiredId,quarantineId]])).rows[0];assert.equal(unchanged.qty,5);
  }finally{await request("/settings/inventory",{allowNegativeStock:false});}
});

test("loyalty rates are per product, admin guarded, audited and preserved by older clients", async () => {
  const fixture = await loyaltyFixture();
  const p = fixture.products[0];
  assert.equal(
    (
      await request(
        "/products/" + p.id + "/loyalty",
        { rate: 0.5 },
        "banhang",
        randomUUID(),
        "PATCH",
      )
    ).status,
    403,
  );
  for (const rate of [-0.1, 100.1, 0.12345, "0,1"]) {
    assert.equal(
      (
        await request(
          "/products/" + p.id + "/loyalty",
          { rate },
          "owner",
          randomUUID(),
          "PATCH",
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request(
        "/products/" + p.id + "/loyalty",
        { rate: 0.5 },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/products/" + p.id, p.body, "owner", randomUUID(), "PATCH"))
      .status,
    200,
  );
  assert.equal(
    (
      await db.pool.query("SELECT loyalty_rate FROM products WHERE id=$1", [
        p.id,
      ])
    ).rows[0].loyalty_rate,
    0.5,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int count FROM audit_log WHERE action='PRODUCT_LOYALTY_CHANGED' AND entity_id=$1",
        [p.id],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await request(
        "/loyalty/settings",
        { ...defaultLoyaltySettings, enabled: true },
        "banhang",
        randomUUID(),
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/loyalty/settings",
        { ...defaultLoyaltySettings, pointValue: 0 },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  const role = await request("/admin/roles", {
    name: "Quản lý hàng không chỉnh điểm",
    permissions: ["products.manage", "inventory.cost.view"],
  });
  const staff = await request("/admin/users", {
    username: "loyalty-product-manager",
    name: "Quản lý hàng kiểm thử",
    password: "Loyalty-Product-Test-2026!",
    roleIds: [role.data.id],
    warehouseIds: [main],
  });
  assert.equal(staff.status, 201);
  const login = await request("/auth/login", {
    username: "loyalty-product-manager",
    password: "Loyalty-Product-Test-2026!",
  });
  tokens.productManager = login.data.token;
  await request(
    "/auth/password",
    {
      currentPassword: "Loyalty-Product-Test-2026!",
      newPassword: "Loyalty-Product-Changed-2026!",
    },
    "productManager",
  );
  assert.equal(
    (
      await request(
        "/products/" + p.id,
        { ...p.body, loyaltyRate: 50 },
        "productManager",
        randomUUID(),
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/products",
        { ...p.body, sku: randomUUID(), loyaltyRate: 50 },
        "productManager",
      )
    ).status,
    403,
  );
});

test("mixed loyalty rates, discounted sales and debt payments retain their original rule snapshot", async () => {
  const { customerId, products } = await loyaltyFixture();
  const settings = {
    ...defaultLoyaltySettings,
    enabled: true,
    earningTiming: "PROPORTIONAL",
  };
  assert.equal(
    (
      await request(
        "/loyalty/settings",
        settings,
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  const sale = {
    warehouseId: main,
    customerId,
    lines: products.map((p) => ({
      productId: p.id,
      quantity: 1,
      unit: "BASE",
    })),
    discount: 1_000_000,
    paid: 500_000,
    method: "CASH",
  };
  const key = randomUUID();
  const result = await request("/sales", sale, "owner", key);
  assert.equal(result.status, 201);
  assert.equal(result.data.loyalty_potential, 3);
  assert.equal(result.data.loyalty_earned, 1);
  assert.deepEqual(
    (await request("/sales", sale, "owner", key)).data,
    result.data,
  );
  const orderId = result.data.id;
  for (const p of products)
    await request(
      "/products/" + p.id + "/loyalty",
      { rate: 90 },
      "owner",
      randomUUID(),
      "PATCH",
    );
  await request(
    "/loyalty/settings",
    { ...defaultLoyaltySettings, pointValue: 1 },
    "owner",
    randomUUID(),
    "PATCH",
  );
  const debt = (
    await db.pool.query("SELECT id FROM debts WHERE order_id=$1", [orderId])
  ).rows[0];
  const paymentKey = randomUUID();
  const payment = { amount: 500_000, method: "CASH" };
  const paid = await request(
    "/debts/" + debt.id + "/pay",
    payment,
    "owner",
    paymentKey,
  );
  assert.equal(paid.status, 201);
  assert.equal(
    (await request("/debts/" + debt.id + "/pay", payment, "owner", paymentKey))
      .status,
    201,
  );
  const wallet = await request("/loyalty/customers/" + customerId);
  assert.equal(wallet.data.balance, 3);
  assert.equal(wallet.data.entries.length, 2);
  assert.equal(
    (
      await db.pool.query("SELECT loyalty_earned FROM orders WHERE id=$1", [
        orderId,
      ])
    ).rows[0].loyalty_earned,
    3,
  );
});

test("loyalty redemption is atomic across two devices; returns reverse earnings and refund spent points", async () => {
  const { customerId, products } = await loyaltyFixture();
  const settings = {
    ...defaultLoyaltySettings,
    enabled: true,
    redeemEnabled: true,
    earningTiming: "ORDER",
    maxRedeemPercent: 100,
  };
  await request("/loyalty/settings", settings, "owner", randomUUID(), "PATCH");
  const line = { productId: products[1].id, quantity: 1, unit: "BASE" };
  const base = {
    warehouseId: main,
    customerId,
    lines: [line],
    discount: 0,
    method: "CASH",
  };
  const first = await request("/sales", { ...base, paid: 1_000_000 });
  assert.equal(first.data.loyalty_earned, 5);
  const quote = await request("/loyalty/quote", {
    warehouseId: main,
    customerId,
    lines: [line],
    redeemPoints: 5,
  });
  assert.equal(quote.status, 201);
  assert.equal(quote.data.total, 995_000);
  const payload = {
    ...base,
    paid: 995_000,
    redeemPoints: 5,
    expectedTotal: 995_000,
  };
  assert.equal(
    (await request("/sales", { ...payload, expectedTotal: 996_000 })).status,
    409,
  );
  const requests = await Promise.all([
    request("/sales", payload),
    request("/sales", payload),
  ]);
  assert.deepEqual(requests.map((r) => r.status).sort(), [201, 409]);
  const redeemed = requests.find((r) => r.status === 201)!;
  assert.equal(redeemed.data.loyalty_spent, 5);
  assert.equal(redeemed.data.loyalty_earned, 4);
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    4,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT quantity FROM lots WHERE product_id=$1 AND state='AVAILABLE'",
        [products[1].id],
      )
    ).rows[0].quantity,
    98,
  );
  const sourceReturn = await request("/orders/" + first.data.id + "/return", {
    reason: "Trả đơn đã phát sinh điểm",
  });
  assert.equal(sourceReturn.status, 201);
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    -1,
  );
  assert.equal(
    (
      await request("/loyalty/quote", {
        warehouseId: main,
        customerId,
        lines: [line],
        redeemPoints: 1,
      })
    ).status,
    409,
  );
  const returnKey = randomUUID();
  const returned = await request(
    "/orders/" + redeemed.data.id + "/return",
    { reason: "Trả đơn đã dùng điểm" },
    "owner",
    returnKey,
  );
  assert.equal(returned.status, 201);
  assert.equal(returned.data.refund, 995_000);
  assert.deepEqual(
    (
      await request(
        "/orders/" + redeemed.data.id + "/return",
        { reason: "Trả đơn đã dùng điểm" },
        "owner",
        returnKey,
      )
    ).data,
    returned.data,
  );
  const wallet = (await request("/loyalty/customers/" + customerId)).data;
  assert.equal(wallet.balance, 0);
  assert.equal(
    wallet.entries.filter((e: any) => e.kind === "RETURN_REDEEM").length,
    1,
  );
  await request(
    "/loyalty/settings",
    defaultLoyaltySettings,
    "owner",
    randomUUID(),
    "PATCH",
  );
});

test("loyalty conversion options handle rounding, discount basis, limits and anonymous customers", () => {
  const lines = [
    { total: 1_000_000, loyaltyRate: 0.1 },
    { total: 1_000_000, loyaltyRate: 0.5 },
  ];
  const settings = {
    ...defaultLoyaltySettings,
    enabled: true,
    redeemEnabled: true,
  };
  assert.equal(
    loyaltyAmounts(lines, 2_000_000, 1_000_000, 0, settings, 10, true)
      .potentialPoints,
    3,
  );
  assert.equal(
    loyaltyAmounts(
      lines,
      2_000_000,
      1_000_000,
      0,
      { ...settings, earningBase: "BEFORE_DISCOUNT" },
      10,
      true,
    ).potentialPoints,
    6,
  );
  assert.equal(
    loyaltyAmounts(
      [{ total: 1_500_000, loyaltyRate: 0.1 }],
      1_500_000,
      0,
      0,
      { ...settings, rounding: "NEAREST" },
      0,
      true,
    ).potentialPoints,
    2,
  );
  assert.equal(
    loyaltyAmounts(lines, 2_000_000, 0, 0, settings, 0, false).potentialPoints,
    0,
  );
  assert.throws(() =>
    loyaltyAmounts(
      lines,
      2_000_000,
      0,
      10,
      { ...settings, maxRedeemPercent: 0.1 },
      10,
      true,
    ),
  );
  assert.throws(() =>
    loyaltyAmounts(
      lines,
      2_000_000,
      0,
      1,
      { ...settings, minRedeemPoints: 2 },
      10,
      true,
    ),
  );
});

test("full-payment earning and a concurrent payment/return leave no orphaned points", async () => {
  const { customerId, products } = await loyaltyFixture();
  await request(
    "/loyalty/settings",
    { ...defaultLoyaltySettings, enabled: true },
    "owner",
    randomUUID(),
    "PATCH",
  );
  const sale = await request("/sales", {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[1].id, quantity: 1, unit: "BASE" }],
    paid: 0,
    method: "CREDIT",
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.data.loyalty_potential, 5);
  assert.equal(sale.data.loyalty_earned, 0);
  const debtId = (
    await db.pool.query("SELECT id FROM debts WHERE order_id=$1", [
      sale.data.id,
    ])
  ).rows[0].id;
  assert.equal(
    (
      await request("/debts/" + debtId + "/pay", {
        amount: 500_000,
        method: "CASH",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    0,
  );
  const [payment, returned] = await Promise.all([
    request("/debts/" + debtId + "/pay", { amount: 500_000, method: "CASH" }),
    request("/orders/" + sale.data.id + "/return", {
      reason: "Kiểm tra thu tiền đồng thời trả hàng",
    }),
  ]);
  assert.equal(returned.status, 201);
  assert.ok([201, 400].includes(payment.status));
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    0,
  );
  await request(
    "/loyalty/settings",
    defaultLoyaltySettings,
    "owner",
    randomUUID(),
    "PATCH",
  );
});

test("admin can allow a full points redemption without inventing cash payments or new earnings", async () => {
  const { customerId, products } = await loyaltyFixture();
  await request(
    "/products/" + products[0].id + "/loyalty",
    { rate: 100 },
    "owner",
    randomUUID(),
    "PATCH",
  );
  await request(
    "/loyalty/settings",
    {
      ...defaultLoyaltySettings,
      enabled: true,
      redeemEnabled: true,
      maxRedeemPercent: 100,
      earningTiming: "ORDER",
    },
    "owner",
    randomUUID(),
    "PATCH",
  );
  const sale = {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    method: "CASH",
  };
  const earned = await request("/sales", { ...sale, paid: 1_000_000 });
  assert.equal(earned.data.loyalty_earned, 1000);
  const redeemed = await request("/sales", {
    ...sale,
    paid: 0,
    redeemPoints: 1000,
    expectedTotal: 0,
  });
  assert.equal(redeemed.status, 201);
  assert.equal(redeemed.data.total, 0);
  assert.equal(redeemed.data.loyalty_earned, 0);
  assert.equal(redeemed.data.payment_status, "PAID");
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int count FROM payments WHERE order_id=$1",
        [redeemed.data.id],
      )
    ).rows[0].count,
    0,
  );
  const returned = await request("/orders/" + redeemed.data.id + "/return", {
    reason: "Hoàn đơn dùng toàn bộ điểm",
  });
  assert.equal(returned.status, 201);
  assert.equal(returned.data.refund, 0);
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    1000,
  );
  await request(
    "/loyalty/settings",
    defaultLoyaltySettings,
    "owner",
    randomUUID(),
    "PATCH",
  );
});

test("a pending sale from the previous APK can replay after the loyalty upgrade", async () => {
  const { products } = await loyaltyFixture();
  const body = {
    warehouseId: main,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    paid: 1_000_000,
    method: "CASH",
  };
  const key = randomUUID();
  const created = await request("/sales", body, "owner", key);
  assert.equal(created.status, 201);
  const {
    redeemPoints: _points,
    expectedTotal: _total,
    ...legacyParsed
  } = saleSchema.parse(body);
  const legacyHash = createHash("sha256")
    .update("sales.confirm" + JSON.stringify(legacyParsed))
    .digest("hex");
  await db.pool.query("UPDATE idempotency SET request_hash=$2 WHERE key=$1", [
    key,
    legacyHash,
  ]);
  const replay = await request(
    "/sales",
    { ...body, redeemPoints: 0, expectedTotal: 1_000_000 },
    "owner",
    key,
  );
  assert.equal(replay.status, 201);
  assert.deepEqual(replay.data, created.data);
  assert.equal(
    (
      await db.pool.query(
        "SELECT quantity FROM lots WHERE product_id=$1 AND state='AVAILABLE'",
        [products[0].id],
      )
    ).rows[0].quantity,
    99,
  );
});

test("bulk point rates are permission guarded, all-or-nothing and idempotent", async () => {
  const { products } = await loyaltyFixture();
  const ids = products.map((p) => p.id);
  const path = "/products/loyalty/bulk";
  assert.equal(
    (await request(path, { ids, rate: 0.25 }, "banhang", randomUUID(), "PATCH"))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        path,
        { ids: [ids[0], randomUUID()], rate: 0.25 },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await db.pool.query("SELECT loyalty_rate FROM products WHERE id=$1", [
        ids[0],
      ])
    ).rows[0].loyalty_rate,
    0.1,
  );
  const key = randomUUID();
  const changed = await request(
    path,
    { ids, rate: 0.25 },
    "owner",
    key,
    "PATCH",
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.data.updated, 2);
  assert.deepEqual(
    (await request(path, { ids, rate: 0.25 }, "owner", key, "PATCH")).data,
    changed.data,
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int count FROM audit_log WHERE action='PRODUCT_LOYALTY_CHANGED' AND entity_id=ANY($1::text[])",
        [ids],
      )
    ).rows[0].count,
    2,
  );
});

test("manual point adjustments require a separate admin right, a reason and a replay key", async () => {
  const { customerId } = await loyaltyFixture();
  const path = "/loyalty/customers/" + customerId + "/adjust";
  assert.equal(
    (await request(path, { delta: 50, reason: "Ưu đãi kiểm thử" }, "banhang"))
      .status,
    403,
  );
  assert.equal((await request(path, { delta: 50, reason: "" })).status, 400);
  const key = randomUUID();
  const changed = await request(
    path,
    { delta: 50, reason: "Ưu đãi kiểm thử" },
    "owner",
    key,
  );
  assert.equal(changed.status, 201);
  assert.equal(changed.data.balance, 50);
  assert.deepEqual(
    (
      await request(
        path,
        { delta: 50, reason: "Ưu đãi kiểm thử" },
        "owner",
        key,
      )
    ).data,
    changed.data,
  );
  const wallet = await request("/loyalty/customers/" + customerId);
  assert.equal(wallet.data.balance, 50);
  assert.equal(wallet.data.entries.length, 1);
  assert.equal(wallet.data.entries[0].note, "Ưu đãi kiểm thử");
  assert.equal(wallet.data.entries[0].order_id, null);
  const partners = await request("/partners");
  const customer = partners.data.find((p: any) => p.id === customerId);
  assert.equal(
    customer.lifetime_earned,
    0,
    "manual points must not inflate VIP rank",
  );
});

test("ceil, VIP thresholds and return options survive updates from an older settings screen", async () => {
  const settings = {
    ...defaultLoyaltySettings,
    enabled: true,
    rounding: "CEIL",
    earningTiming: "ORDER",
    reverseEarnOnReturn: false,
    refundSpentOnReturn: false,
    tiers: [
      { name: "Mới", minimumPoints: 0 },
      { name: "Thân thiết", minimumPoints: 50 },
    ],
  };
  assert.equal(
    (
      await request(
        "/loyalty/settings",
        settings,
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  const legacy = {
    enabled: true,
    pointValue: 1000,
    earningTiming: "ORDER",
    earningBase: "AFTER_DISCOUNT",
    rounding: "CEIL",
    redeemEnabled: false,
    minRedeemPoints: 1,
    maxRedeemPercent: 50,
  };
  const updated = await request(
    "/loyalty/settings",
    legacy,
    "owner",
    randomUUID(),
    "PATCH",
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.data.reverseEarnOnReturn, false);
  assert.deepEqual(updated.data.tiers, settings.tiers);
  const parsed = {
    ...defaultLoyaltySettings,
    rounding: "CEIL" as const,
    enabled: true,
  };
  assert.equal(
    loyaltyAmounts(
      [{ total: 1_100_000, loyaltyRate: 0.1 }],
      1_100_000,
      0,
      0,
      parsed,
      0,
      true,
    ).potentialPoints,
    2,
  );
  assert.equal(
    (
      await request(
        "/loyalty/settings",
        { tiers: [{ name: "Sai", minimumPoints: 10 }] },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  const { customerId, products } = await loyaltyFixture();
  const sale = await request("/sales", {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[1].id, quantity: 1, unit: "BASE" }],
    paid: 1_000_000,
    method: "CASH",
  });
  assert.equal(sale.data.loyalty_earned, 5);
  await request(
    "/loyalty/settings",
    defaultLoyaltySettings,
    "owner",
    randomUUID(),
    "PATCH",
  );
  assert.equal(
    (
      await request("/orders/" + sale.data.id + "/return", {
        reason: "Giữ điểm theo quy tắc đã bán",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request("/loyalty/customers/" + customerId)).data.balance,
    5,
    "return follows the order snapshot, not changed configuration",
  );
});

test("revoking redemption survives database startup and blocks quotes as well as sales", async () => {
  const role = (
    await db.pool.query("SELECT id FROM roles WHERE name='Nhân viên bán hàng'")
  ).rows[0];
  await db.pool.query(
    "UPDATE roles SET permissions=array_remove(permissions,'loyalty.redeem') WHERE id=$1",
    [role.id],
  );
  await db.pool.query(
    readFileSync(resolve(__dirname, "../schema.sql"), "utf8"),
  );
  const perms = (
    await db.pool.query("SELECT permissions FROM roles WHERE id=$1", [role.id])
  ).rows[0].permissions;
  assert.equal(perms.includes("loyalty.redeem"), false);
  const { customerId, products } = await loyaltyFixture();
  const body = {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    redeemPoints: 1,
  };
  assert.equal((await request("/loyalty/quote", body, "banhang")).status, 403);
  assert.equal(
    (
      await request(
        "/sales",
        { ...body, paid: 999000, method: "CASH" },
        "banhang",
      )
    ).status,
    403,
  );
});

test("delivery updates and dashboard/customer warehouse filters enforce scope", async () => {
  const { customerId, products } = await loyaltyFixture();
  const sale = await request("/sales", {
    warehouseId: main,
    customerId,
    lines: [{ productId: products[0].id, quantity: 1, unit: "BASE" }],
    paid: 1_000_000,
    method: "CASH",
    deliveryStatus: "PENDING_PACK",
    note: "Giao tại cửa hàng",
  });
  assert.equal(sale.status, 201);
  const path = "/orders/" + sale.data.id + "/delivery";
  assert.equal(
    (
      await request(
        path,
        { status: "SHIPPING", carrier: "Giao nội bộ", trackingCode: "NB-001" },
        "banhang",
        randomUUID(),
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        path,
        { status: "SHIPPING", carrier: "Giao nội bộ", trackingCode: "NB-001" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  const changed = (
    await db.pool.query(
      "SELECT delivery_status,tracking_code,note FROM orders WHERE id=$1",
      [sale.data.id],
    )
  ).rows[0];
  assert.equal(changed.delivery_status, "SHIPPING");
  assert.equal(changed.tracking_code, "NB-001");
  assert.equal(changed.note, "Giao tại cửa hàng");
  assert.equal(
    (await request("/dashboard?warehouseId=" + secondary, undefined, "kho"))
      .status,
    403,
  );
  assert.equal(
    (await request("/partners?warehouseId=" + secondary, undefined, "kho"))
      .status,
    403,
  );
  await request("/orders/" + sale.data.id + "/return", {
    reason: "Kiểm tra khóa trạng thái đơn trả",
  });
  assert.equal(
    (
      await request(
        path,
        { status: "DELIVERED" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    409,
  );
});

test("warehouse administration and image URLs are validated without changing historical references", async () => {
  const body = { name: "Kho mở rộng kiểm thử", address: "Tiền Giang" };
  const key = randomUUID();
  assert.equal((await request("/warehouses", body, "kho")).status, 403);
  const warehouse = await request("/warehouses", body, "owner", key);
  assert.equal(warehouse.status, 201);
  assert.deepEqual(
    (await request("/warehouses", body, "owner", key)).data,
    warehouse.data,
  );
  assert.equal(
    (
      await request(
        "/warehouses/" + warehouse.data.id,
        { name: "Kho mở rộng đã đổi tên", address: "Cai Lậy" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.ok(
    (await request("/bootstrap")).data.warehouses.some(
      (w: any) =>
        w.id === warehouse.data.id && w.name === "Kho mở rộng đã đổi tên",
    ),
  );
  const { products } = await loyaltyFixture();
  const item = products[0];
  assert.equal(
    (
      await request(
        "/products/" + item.id,
        { ...item.body, imageUrl: "javascript:alert(1)" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/products/" + item.id,
        { ...item.body, imageUrl: "https://name:password@example.com/a.jpg" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/products/" + item.id,
        { ...item.body, imageUrl: "https://example.com/a.jpg" },
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/products/" + item.id,
        item.body,
        "owner",
        randomUUID(),
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await db.pool.query("SELECT image_url FROM products WHERE id=$1", [
        item.id,
      ])
    ).rows[0].image_url,
    "https://example.com/a.jpg",
  );
});

test("custom and rolling reports validate ranges and preserve partial-month events", async () => {
  assert.equal(reportRange("ROLLING_7","2026-11-02").start,"2026-10-27");
  assert.equal(reportRange("ROLLING_30","2026-11-02").start,"2026-10-04");
  assert.throws(()=>reportRange("CUSTOM",undefined,"2026-02-30","2026-03-01"));
  assert.throws(()=>reportRange("CUSTOM",undefined,"2026-02-02","2026-02-01"));
  assert.throws(()=>reportRange("CUSTOM",undefined,"2024-01-01","2026-01-01"));
  const range=reportRange("CUSTOM",undefined,"2024-02-29","2024-03-01");
  assert.equal(range.start,"2024-02-29"); assert.equal(range.end,"2024-03-02");
  const result=await request("/reports?period=CUSTOM&from=2024-01-15&through=2024-05-20&warehouseId="+main);
  assert.equal(result.status,200); assert.equal(result.data.series.length,5);
  assert.equal(result.data.series[0].bucket,"2024-01-01T00:00:00");
});

test("store-management profiles, wholesale, warehouse preferences and debt adjustments are protected and replay-safe",async()=>{
  const viewerRole=await request("/admin/roles",{name:"[TEST] Quyền đối chiếu "+randomUUID().slice(0,8),permissions:["inventory.view","partners.view","debts.view","reports.view","sales.create"]});
  assert.equal(viewerRole.status,201);
  const viewerUsername="parity_"+randomUUID().slice(0,8),viewerPassword="Parity-Test-Only-2026!";
  const viewerUser=await request("/admin/users",{username:viewerUsername,name:"[TEST] Người xem đối chiếu",password:viewerPassword,roleIds:[viewerRole.data.id],warehouseIds:[main]});
  assert.equal(viewerUser.status,201);
  await db.pool.query("UPDATE users SET must_change_password=false WHERE id=$1",[viewerUser.data.id]);
  tokens.parity=(await request("/auth/login",{username:viewerUsername,password:viewerPassword})).data.token;
  const body={sku:"PARITY-"+randomUUID().slice(0,8),name:"[TEST] Hàng đối chiếu chức năng",category:"Vật tư",baseUnit:"cái",packUnit:"hộp",packFactor:10,priceBase:1000,pricePack:9000,costBase:500,minStock:1,trackLots:false,details:{wholesaleBase:800,wholesalePack:7000,weightGrams:100,dimensions:"10 × 10",sellable:true}};
  const made=await request("/products",body); assert.equal(made.status,201);
  const id=made.data.id;
  const person=await request("/partners",{name:"[TEST] Hồ sơ đối chiếu",kind:"CUSTOMER",creditLimit:100000,profile:{code:"TEST-KH",email:"test@example.invalid",group:"Bán sỉ",birthday:"2000-02-29",gender:"OTHER",discountPercent:5,priceBook:"WHOLESALE",assignedStaff:"QA",active:true,addresses:[{label:"Cửa hàng",address:"Địa chỉ thử"}],contacts:[{name:"Liên hệ thử",phone:"0900000000",email:""}]}});
  assert.equal(person.status,201); const customerId=person.data.id;
  const receipt=await request("/documents",{kind:"RECEIPT",warehouseId:main,lines:[{productId:id,quantity:3,unit:"PACK",costBase:500}],reason:"Nhập kho kiểm thử chức năng"});
  assert.equal(receipt.status,201); assert.equal((await request("/documents/"+receipt.data.id+"/post",{})).status,201);
  const wholesale={warehouseId:main,customerId,priceBook:"WHOLESALE",lines:[{productId:id,quantity:1,unit:"PACK"}],discount:0,redeemPoints:0};
  assert.equal((await request("/loyalty/quote",{...wholesale,priceBook:"RETAIL"},"parity")).status,201);
  assert.equal((await request("/loyalty/quote",wholesale,"parity")).status,403);
  assert.equal((await request("/loyalty/quote",wholesale)).data.total,7000);
  const saleKey=randomUUID(),sale={...wholesale,paid:7000,method:"CASH"};
  const sold=await request("/sales",sale,"owner",saleKey); assert.equal(sold.status,201);
  assert.equal((await request("/sales",sale,"owner",saleKey)).data.id,sold.data.id);
  const prefs={warehouseId:main,location:"Kệ TEST",minStock:2,maxStock:50};
  assert.equal((await request("/management/products/"+id+"/warehouse",prefs,"parity",randomUUID(),"PATCH")).status,403);
  assert.equal((await request("/management/products/"+id+"/warehouse",{...prefs,maxStock:1},"owner",randomUUID(),"PATCH")).status,400);
  assert.equal((await request("/management/products/"+id+"/warehouse",prefs,"owner",randomUUID(),"PATCH")).status,200);
  const stock=await request("/management/products/"+id+"/stock?warehouseId="+main,undefined,"parity");
  assert.equal(stock.status,200); assert.equal(stock.data.warehouses[0].actual,20); assert.equal(stock.data.warehouses[0].min_stock,2); assert.equal(stock.data.warehouses[0].costBase,undefined);
  assert.equal((await request("/management/products/"+id+"/stock?warehouseId="+secondary,undefined,"parity")).status,403);
  const adjust={warehouseId:main,newBalance:-1000,reason:"Số dư đầu kỳ kiểm thử"},key=randomUUID();
  assert.equal((await request("/management/partners/"+customerId+"/balance",adjust,"parity")).status,403);
  const corrected=await request("/management/partners/"+customerId+"/balance",adjust,"owner",key); assert.equal(corrected.status,201);
  assert.equal((await request("/management/partners/"+customerId+"/balance",adjust,"owner",key)).data.id,corrected.data.id);
  const ledger=await request("/management/partners/"+customerId+"/ledger?warehouseId="+main); assert.equal(ledger.status,200); assert.equal(ledger.data.balance,-1000);
  assert.equal((await request("/management/reports/finance",undefined,"parity")).status,403);
  const finance=await request("/management/reports/finance?period=DAY&warehouseId="+main); assert.equal(finance.status,200);
  assert.ok(finance.data.items.some((r:any)=>r.order_id===sold.data.id&&r.amount===7000));
  const inventory=await request("/management/reports/inventory?period=DAY&warehouseId="+main); assert.equal(inventory.status,200);
  const entry=inventory.data.items.find((r:any)=>r.id===id); assert.equal(entry.incoming,30); assert.equal(entry.outgoing,10); assert.equal(entry.closing,20);
  assert.equal((await request("/management/products/"+id+"/history?warehouseId="+main)).data.total,2);
  const {details,...legacy}=body;
  assert.equal((await request("/products/"+id,legacy,"owner",randomUUID(),"PATCH")).status,200);
  assert.equal((await db.pool.query("SELECT details FROM products WHERE id=$1",[id])).rows[0].details.wholesalePack,7000);
  assert.equal((await request("/partners/"+customerId,{name:"[TEST] Đổi tên",kind:"CUSTOMER",creditLimit:100000},"owner",randomUUID(),"PATCH")).status,200);
  assert.equal((await db.pool.query("SELECT profile FROM partners WHERE id=$1",[customerId])).rows[0].profile.email,"test@example.invalid");
  assert.equal((await request("/products/"+id,{...body,details:{...details,sellable:false}},"owner",randomUUID(),"PATCH")).status,200);
  assert.equal((await request("/loyalty/quote",wholesale)).status,400);
});

test("store lists search all records, paginate consistently and preserve scope; returned sales reconcile the customer ledger",async()=>{
  const prefix="LIST-"+randomUUID().slice(0,8);
  const people=[];
  for(let i=0;i<3;i++){
    const created=await request("/partners",{name:prefix+" "+i,kind:"CUSTOMER",phone:"09001234"+i,profile:{code:prefix+"-"+i,group:prefix,active:i!==2}});
    assert.equal(created.status,201);people.push(created.data.id);
  }
  const first=await request("/partners?search="+prefix+"&limit=1&page=1");
  const second=await request("/partners?search="+prefix+"&limit=1&page=2");
  assert.equal(first.status,200);assert.equal(first.data.length,1);assert.equal(first.data[0].list_total,3);assert.notEqual(first.data[0].id,second.data[0].id);
  assert.equal((await request("/partners?search="+prefix+"&active=INACTIVE")).data[0].id,people[2]);
  assert.equal((await request("/partners?search=no-match&includeId="+people[0])).data[0].id,people[0]);
  assert.equal((await request("/partners?page=0")).status,400);
  assert.equal((await request("/inventory?page=-1")).status,400);
  assert.equal((await request("/inventory?ids=bad-id")).status,400);
  const product=(await db.pool.query("SELECT id FROM products WHERE sku LIKE 'PARITY-%' LIMIT 1")).rows[0];
  const inventory=await request("/inventory?search=no-match&ids="+product.id+"&warehouseId="+main);
  assert.equal(inventory.status,200);assert.equal(inventory.data[0].id,product.id);assert.equal(inventory.data[0].min_stock,2);
  assert.equal((await request("/inventory?warehouseId="+secondary,undefined,"parity")).status,403);
  const existing=(await db.pool.query("SELECT id FROM partners WHERE profile->>'code'='TEST-KH' LIMIT 1")).rows[0];
  await db.pool.query("UPDATE partners SET phone='0900999888' WHERE id=$1",[existing.id]);
  const orders=await request("/orders?search=0900999888&limit=1");assert.equal(orders.status,200);assert.equal(orders.data.length,1);assert.equal(orders.data[0].customer_id,existing.id);
  assert.equal((await request("/orders?search=0900999888&status=UNPAID")).data.length,0);
  const returned=await request("/orders/"+orders.data[0].id+"/return",{reason:"Trả hàng kiểm tra đối chiếu sổ",refundMethod:"CASH"});
  assert.equal(returned.status,201);
  const ledger=await request("/management/partners/"+existing.id+"/ledger?warehouseId="+main);
  assert.equal(ledger.status,200);assert.equal(ledger.data.balance,-1000);assert.equal(ledger.data.items.reduce((sum:number,r:any)=>sum+r.delta,0),-1000);
  assert.equal((await request("/orders?search=0900999888&status=RETURNED")).data.length,1);
  assert.equal((await request("/orders?from=2026-02-30&through=2026-03-01")).status,400);
});
