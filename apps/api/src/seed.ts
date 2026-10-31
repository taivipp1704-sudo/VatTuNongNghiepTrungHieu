import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database, audit } from "./db";
import { hashPassword, permissionCatalog } from "./auth";

export async function seedDatabase(db: Database) {
  const credentials: { username: string; password: string; role: string }[] =
    [];
  await db.transaction(async (client) => {
    const existing = (
      await client.query("SELECT COUNT(*)::int count FROM users")
    ).rows[0].count;
    if (existing > 0)
      throw new Error(
        "Đã có tài khoản. Không tạo lại dữ liệu/mật khẩu khởi tạo.",
      );
    const mainWarehouse = "10000000-0000-4000-8000-000000000001";
    const secondaryWarehouse = "10000000-0000-4000-8000-000000000002";
    await client.query(
      "INSERT INTO warehouses(id,name,address) VALUES($1,$2,$3),($4,$5,$6)",
      [
        mainWarehouse,
        "Kho cửa hàng",
        "Cai Lậy, Tiền Giang",
        secondaryWarehouse,
        "Kho dự trữ",
        "Cai Lậy, Tiền Giang",
      ],
    );
    const templates = [
      {
        username: "owner",
        name: "Nguyễn Văn Hòa",
        role: "Chủ cửa hàng",
        owner: true,
        permissions: [...permissionCatalog] as string[],
        scopes: [mainWarehouse, secondaryWarehouse],
      },
      {
        username: "kho",
        name: "Phạm Quốc Cường",
        role: "Nhân viên kho",
        owner: false,
        permissions: [
          "inventory.view",
          "inventory.receipt.create",
          "inventory.issue.create",
          "inventory.count.create",
          "partners.view",
        ],
        scopes: [mainWarehouse],
      },
      {
        username: "banhang",
        name: "Lê Thị Ngọc Mai",
        role: "Nhân viên bán hàng",
        owner: false,
        permissions: [
          "inventory.view",
          "sales.create",
          "loyalty.redeem",
          "sales.view",
          "partners.view",
          "partners.manage",
          "invoices.view",
          "debts.view",
        ],
        scopes: [mainWarehouse],
      },
      {
        username: "ketoan",
        name: "Võ Thị Thu Thủy",
        role: "Kế toán",
        owner: false,
        permissions: [
          "sales.view",
          "partners.view",
          "partners.manage",
          "debts.view",
          "payments.create",
          "invoices.view",
          "invoices.issue",
          "reports.view",
          "reports.profit",
          "inventory.cost.view",
        ],
        scopes: [mainWarehouse, secondaryWarehouse],
      },
    ];
    let ownerId = "";
    for (const template of templates) {
      const roleId = randomUUID();
      const userId = randomUUID();
      const password = randomBytes(18).toString("base64url");
      await client.query(
        "INSERT INTO roles(id,name,permissions,protected) VALUES($1,$2,$3,$4)",
        [roleId, template.role, template.permissions, template.owner],
      );
      await client.query(
        "INSERT INTO users(id,username,name,password_hash,owner,warehouse_ids) VALUES($1,$2,$3,$4,$5,$6)",
        [
          userId,
          template.username,
          template.name,
          await hashPassword(password),
          template.owner,
          template.scopes,
        ],
      );
      await client.query(
        "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)",
        [userId, roleId],
      );
      if (template.owner) ownerId = userId;
      credentials.push({
        username: template.username,
        password,
        role: template.role,
      });
    }
    const products = [
      [
        "PB001",
        "8938500000001",
        "Phân bón NPK 16-16-8",
        "Phân bón",
        "kg",
        "bao",
        50,
        10000,
        480000,
        8500,
        1000,
        true,
      ],
      [
        "PB003",
        "8938500000003",
        "Phân urê 46%",
        "Phân bón",
        "kg",
        "bao",
        50,
        13200,
        650000,
        11800,
        1000,
        true,
      ],
      [
        "BVTV002",
        "8938500000002",
        "Thuốc trừ sâu sinh học",
        "Thuốc BVTV",
        "chai",
        "thùng",
        24,
        98000,
        2250000,
        78000,
        30,
        true,
      ],
      [
        "BVTV004",
        "8938500000004",
        "Thuốc trừ nấm",
        "Thuốc BVTV",
        "gói",
        "hộp",
        10,
        42000,
        400000,
        32000,
        20,
        true,
      ],
      [
        "HG005",
        "8938500000005",
        "Hạt giống rau cải",
        "Hạt giống",
        "gói",
        "hộp",
        20,
        35000,
        650000,
        25000,
        15,
        true,
      ],
      [
        "VT006",
        "8938500000006",
        "Găng tay làm vườn",
        "Vật tư",
        "đôi",
        "bịch",
        12,
        18000,
        195000,
        12000,
        24,
        false,
      ],
    ];
    for (const [index, values] of products.entries()) {
      const id =
        "20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0");
      await client.query(
        "INSERT INTO products(id,sku,barcode,name,category,base_unit,pack_unit,pack_factor,price_base,price_pack,cost_base,min_stock,track_lots) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [id, ...values],
      );
      const lotId = randomUUID();
      const initialQuantity = [3400, 400, 125, 68, 18, 96][index];
      const days = [16, 365, 25, 42, -12, null][index];
      await client.query(
        "INSERT INTO lots(id,product_id,warehouse_id,code,expires_on,location,quantity,cost_base) VALUES($1,$2,$3,$4,CASE WHEN $5::int IS NULL THEN NULL ELSE CURRENT_DATE+$5::int END,$6,$7,$8)",
        [
          lotId,
          id,
          mainWarehouse,
          "LO-" + String(index + 1).padStart(3, "0"),
          days,
          "Kệ A" + (index + 1),
          initialQuantity,
          values[9],
        ],
      );
      await client.query(
        "INSERT INTO stock_ledger(id,lot_id,delta,balance,reason,created_by) VALUES($1,$2,$3,$3,$4,$5)",
        [randomUUID(), lotId, initialQuantity, "Tồn đầu kỳ minh họa", ownerId],
      );
    }
    await client.query(
      "INSERT INTO partners(id,name,kind,phone,address,credit_limit) VALUES($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)",
      [
        randomUUID(),
        "Nguyễn Thị Thu",
        "CUSTOMER",
        "0901234567",
        "Cai Lậy, Tiền Giang",
        10000000,
        randomUUID(),
        "Công ty Vật tư Miền Tây",
        "SUPPLIER",
        "02733888888",
        "Tiền Giang",
        0,
      ],
    );
    await client.query("INSERT INTO settings(key,value) VALUES('store',$1)", [
      JSON.stringify({
        name: "AgriStock — Cửa hàng Mùa Vụ",
        address: "Cai Lậy, Tiền Giang",
        phone: "02733888888",
      }),
    ]);
    await client.query(
      "INSERT INTO settings(key,value) VALUES('_stitch_permissions_v1','true') ON CONFLICT DO NOTHING",
    );
    await audit(client, ownerId, "DEMO_SEEDED", null, {
      products: products.length,
      realBusinessData: false,
    });
  });
  return credentials;
}

if (require.main === module) {
  const db = new Database();
  db.onModuleInit()
    .then(() => seedDatabase(db))
    .then((credentials) => {
      const directory = resolve(__dirname, "../../..", ".local");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        resolve(directory, "initial-accounts.json"),
        JSON.stringify(
          {
            warning:
              "Mật khẩu khởi tạo riêng. Đổi sau lần đăng nhập đầu. Không chia sẻ tệp này.",
            accounts: credentials,
          },
          null,
          2,
        ),
      );
      console.log(
        "Đã tạo dữ liệu minh họa. Tài khoản khởi tạo nằm tại .local/initial-accounts.json.",
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => db.onModuleDestroy());
}
