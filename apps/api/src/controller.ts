import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { Database, audit } from "./db";
import {
  AuthRequest,
  AuthService,
  SessionGuard,
  hashPassword,
  permissionCatalog,
  requirePermission,
  requireWarehouse,
  verifyPassword,
} from "./auth";
import { Operations, has, sanitizeMoney } from "./operations";
import {
  amount,
  documentSchema,
  parse,
  partnerSchema,
  password,
  productSchema,
  loyaltyRate,
  loyaltySettingsSchema,
  loyaltyQuoteSchema,
  saleSchema,
  text,
  uuid,
} from "./validation";
import { Loyalty } from "./loyalty";
import { Photos } from "./photos";
import { Reports, reportRange } from "./reports";

const scopeOf = (request: AuthRequest) => {
  if (request.query.warehouseId) {
    const warehouse = parse(uuid, request.query.warehouseId);
    requireWarehouse(request.user, warehouse);
    return [warehouse];
  }
  return request.user.owner ? null : request.user.warehouseIds;
};

@Controller("api")
export class PublicController {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
  ) {}

  @Get("health")
  async health() {
    await this.db.pool.query("SELECT 1");
    return {
      status: "ok",
      service: "AgriStock",
      invoiceProvider: "NOT_CONFIGURED",
    };
  }

  @Post("auth/login")
  login(@Body() body: unknown) {
    const input = parse(
      z
        .object({
          username: z.string().trim().min(2).max(80),
          password: z.string().min(1).max(128),
        })
        .strict(),
      body,
    );
    return this.auth.login(input.username, input.password);
  }

  @Post("auth/forgot")
  forgot() {
    return {
      message: "Liên hệ chủ cửa hàng để đặt lại mật khẩu tài khoản nội bộ.",
    };
  }
}

@Controller("api")
@UseGuards(SessionGuard)
export class AppController {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly operations: Operations,
    private readonly loyalty: Loyalty,
    private readonly photos: Photos,
    private readonly reports: Reports,
  ) {}

  @Get("me")
  me(@Req() request: AuthRequest) {
    return request.user;
  }

  @Post("auth/logout")
  async logout(@Req() request: AuthRequest) {
    await this.db.pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      request.tokenHash,
    ]);
    await audit(this.db.pool, request.user.id, "LOGOUT", request.user.id);
    return { success: true };
  }

  @Post("auth/password")
  async changePassword(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = parse(
      z
        .object({ currentPassword: z.string().max(128), newPassword: password })
        .strict(),
      body,
    );
    const row = (
      await this.db.pool.query("SELECT password_hash FROM users WHERE id=$1", [
        request.user.id,
      ])
    ).rows[0];
    if (!(await verifyPassword(input.currentPassword, row.password_hash)))
      throw new BadRequestException("Mật khẩu hiện tại không đúng.");
    if (input.currentPassword === input.newPassword)
      throw new BadRequestException(
        "Chọn mật khẩu mới khác mật khẩu hiện tại.",
      );
    await this.db.transaction(async (client) => {
      await client.query(
        "UPDATE users SET password_hash=$2,must_change_password=false WHERE id=$1",
        [request.user.id, await hashPassword(input.newPassword)],
      );
      await client.query(
        "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2",
        [request.user.id, request.tokenHash],
      );
      await audit(client, request.user.id, "PASSWORD_CHANGED", request.user.id);
    });
    return this.auth.user(request.user.id);
  }

  @Get("bootstrap")
  async bootstrap(@Req() request: AuthRequest) {
    const warehouses = (
      await this.db.pool.query(
        "SELECT * FROM warehouses WHERE $1::uuid[] IS NULL OR id=ANY($1) ORDER BY name",
        [scopeOf(request)],
      )
    ).rows;
    const store = (
      await this.db.pool.query("SELECT value FROM settings WHERE key='store'")
    ).rows[0]?.value ?? { name: "AgriStock", address: "", phone: "" };
    return {
      user: request.user,
      warehouses,
      store,
      permissions: has(request.user, "roles.manage") ? permissionCatalog : [],
      invoiceProvider: "NOT_CONFIGURED",
    };
  }

  @Get("inventory")
  inventory(@Req() request: AuthRequest) {
    const search =
      typeof request.query.search === "string" ? request.query.search : "";
    const warehouse = request.query.warehouseId
      ? parse(uuid, request.query.warehouseId)
      : undefined;
    return this.operations.inventory(request.user, search, warehouse);
  }

  @Post("warehouses")
  async createWarehouse(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "settings.manage");
    const input = parse(
      z
        .object({ name: text, address: z.string().trim().max(300).default("") })
        .strict(),
      body,
    );
    return this.operations.once(
      request.user,
      key,
      "warehouses.create",
      input,
      async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('warehouse-admin'))",
        );
        if (
          (
            await client.query(
              "SELECT id FROM warehouses WHERE lower(name)=lower($1)",
              [input.name],
            )
          ).rowCount
        )
          throw new ConflictException("Tên kho đã tồn tại.");
        const id = randomUUID();
        await client.query(
          "INSERT INTO warehouses(id,name,address) VALUES($1,$2,$3)",
          [id, input.name, input.address],
        );
        await audit(client, request.user.id, "WAREHOUSE_CREATED", id, input);
        return { id, ...input };
      },
    );
  }

  @Patch("warehouses/:id")
  async updateWarehouse(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "settings.manage");
    const id = parse(uuid, rawId);
    requireWarehouse(request.user, id);
    const input = parse(
      z
        .object({ name: text, address: z.string().trim().max(300).default("") })
        .strict(),
      body,
    );
    return this.db.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('warehouse-admin'))",
      );
      const old = (
        await client.query("SELECT * FROM warehouses WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!old) throw new NotFoundException("Không tìm thấy kho.");
      if (
        (
          await client.query(
            "SELECT id FROM warehouses WHERE lower(name)=lower($1) AND id<>$2",
            [input.name, id],
          )
        ).rowCount
      )
        throw new ConflictException("Tên kho đã tồn tại.");
      await client.query(
        "UPDATE warehouses SET name=$2,address=$3 WHERE id=$1",
        [id, input.name, input.address],
      );
      await audit(client, request.user.id, "WAREHOUSE_UPDATED", id, {
        before: old,
        after: input,
      });
      return { id, ...input };
    });
  }

  @Post("products")
  async createProduct(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "products.manage");
    requirePermission(request.user, "inventory.cost.view");
    const input = parse(productSchema, body);
    if (input.loyaltyRate !== undefined)
      requirePermission(request.user, "loyalty.manage");
    const { imageUrl, ...legacyProductInput } = input;
    return this.operations.once(
      request.user,
      key,
      "products.create",
      imageUrl ? { ...legacyProductInput, imageUrl } : legacyProductInput,
      async (client) => {
        const id = randomUUID();
        await client.query(
          "INSERT INTO products(id,sku,barcode,name,category,base_unit,pack_unit,pack_factor,price_base,price_pack,cost_base,min_stock,track_lots,technical_info,loyalty_rate,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
          [
            id,
            input.sku,
            input.barcode || null,
            input.name,
            input.category,
            input.baseUnit,
            input.packUnit,
            input.packFactor,
            input.priceBase,
            input.pricePack,
            input.costBase,
            input.minStock,
            input.trackLots,
            input.technicalInfo,
            input.loyaltyRate ?? 0,
            input.imageUrl ?? "",
          ],
        );
        await this.photos.bindProduct(client, request.user, id, input.imageUrl);
        await audit(client, request.user.id, "PRODUCT_CREATED", id, input);
        return { id };
      },
    );
  }

  @Patch("products/:id")
  async updateProduct(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "products.manage");
    requirePermission(request.user, "inventory.cost.view");
    const id = parse(uuid, rawId);
    const input = parse(productSchema, body);
    if (input.loyaltyRate !== undefined)
      requirePermission(request.user, "loyalty.manage");
    return this.db.transaction(async (client) => {
      const old = (
        await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!old) throw new NotFoundException("Không tìm thấy hàng hóa.");
      if (
        old.base_unit !== input.baseUnit ||
        old.pack_factor !== input.packFactor ||
        old.pack_unit !== input.packUnit ||
        old.track_lots !== input.trackLots
      )
        throw new ConflictException(
          "Không đổi đơn vị/quy tắc lô của sản phẩm đã tạo. Tạo mã hàng mới để bảo toàn lịch sử.",
        );
      await client.query(
        "UPDATE products SET sku=$2,barcode=$3,name=$4,category=$5,price_base=$6,price_pack=$7,cost_base=$8,min_stock=$9,technical_info=$10,loyalty_rate=$11,image_url=$12 WHERE id=$1",
        [
          id,
          input.sku,
          input.barcode || null,
          input.name,
          input.category,
          input.priceBase,
          input.pricePack,
          input.costBase,
          input.minStock,
          input.technicalInfo,
          input.loyaltyRate ?? old.loyalty_rate,
          input.imageUrl ?? old.image_url,
        ],
      );
      await this.photos.bindProduct(
        client,
        request.user,
        id,
        input.imageUrl,
        old.image_url,
      );
      await audit(client, request.user.id, "PRODUCT_UPDATED", id, {
        before: old,
        after: input,
      });
      return { id };
    });
  }

  @Get("loyalty/settings")
  loyaltySettings() {
    return this.loyalty.settings();
  }

  @Patch("loyalty/settings")
  async saveLoyaltySettings(
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "loyalty.manage");
    const patch = parse(z.record(z.string(), z.unknown()), body);
    return this.db.transaction(async (client) => {
      // Serialize configuration changes even before the settings row exists.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('agristock:loyalty-settings'))",
      );
      const before = await this.loyalty.settings(client);
      const input = parse(loyaltySettingsSchema, { ...before, ...patch });
      await client.query(
        "INSERT INTO settings(key,value) VALUES('loyalty',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        [JSON.stringify(input)],
      );
      await audit(
        client,
        request.user.id,
        "LOYALTY_SETTINGS_CHANGED",
        "loyalty",
        { before, after: input },
      );
      return input;
    });
  }

  @Patch("products/:id/loyalty")
  async saveProductLoyalty(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "loyalty.manage");
    const id = parse(uuid, rawId);
    const input = parse(z.object({ rate: loyaltyRate }).strict(), body);
    return this.db.transaction(async (client) => {
      const old = (
        await client.query(
          "SELECT loyalty_rate FROM products WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!old) throw new NotFoundException("Không tìm thấy hàng hóa.");
      await client.query("UPDATE products SET loyalty_rate=$2 WHERE id=$1", [
        id,
        input.rate,
      ]);
      await audit(client, request.user.id, "PRODUCT_LOYALTY_CHANGED", id, {
        before: old.loyalty_rate,
        after: input.rate,
      });
      return { id, loyalty_rate: input.rate };
    });
  }

  @Post("loyalty/quote")
  loyaltyQuote(@Req() request: AuthRequest, @Body() body: unknown) {
    return this.loyalty.quote(request.user, parse(loyaltyQuoteSchema, body));
  }

  @Patch("products/loyalty/bulk")
  async bulkProductLoyalty(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "loyalty.manage");
    const input = parse(
      z
        .object({ ids: z.array(uuid).min(1).max(100), rate: loyaltyRate })
        .strict(),
      body,
    );
    return this.operations.once(
      request.user,
      key,
      "products.loyalty.bulk",
      input,
      async (client) => {
        const rows = (
          await client.query(
            "SELECT id,loyalty_rate FROM products WHERE id=ANY($1) ORDER BY id FOR UPDATE",
            [input.ids],
          )
        ).rows;
        if (rows.length !== new Set(input.ids).size)
          throw new NotFoundException(
            "Có mặt hàng không tồn tại. Tải lại danh sách trước khi sửa.",
          );
        await client.query(
          "UPDATE products SET loyalty_rate=$2 WHERE id=ANY($1)",
          [input.ids, input.rate],
        );
        for (const row of rows)
          await audit(
            client,
            request.user.id,
            "PRODUCT_LOYALTY_CHANGED",
            row.id,
            { before: row.loyalty_rate, after: input.rate, bulk: true },
          );
        return { updated: rows.length, rate: input.rate };
      },
    );
  }

  @Post("loyalty/customers/:id/adjust")
  async adjustCustomerPoints(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "loyalty.adjust");
    const id = parse(uuid, rawId);
    const input = parse(
      z
        .object({
          delta: z
            .number()
            .int()
            .min(-1_000_000_000)
            .max(1_000_000_000)
            .refine((v) => v !== 0),
          reason: z.string().trim().min(3).max(500),
        })
        .strict(),
      body,
    );
    return this.operations.once(
      request.user,
      key,
      "loyalty.adjust",
      { id, ...input },
      async (client) => {
        const customer = (
          await client.query(
            "SELECT id FROM partners WHERE id=$1 AND kind='CUSTOMER' FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!customer)
          throw new NotFoundException("Không tìm thấy khách hàng.");
        const before = await this.loyalty.balance(client, id);
        await this.loyalty.entry(
          client,
          request.user,
          { id: null, customer_id: id, warehouse_id: null },
          "ADJUST",
          input.delta,
          "adjust:" + request.user.id + ":" + key,
        );
        await client.query(
          "UPDATE loyalty_ledger SET note=$2 WHERE source_key=$1",
          ["adjust:" + request.user.id + ":" + key, input.reason],
        );
        const balance = await this.loyalty.balance(client, id);
        await audit(client, request.user.id, "LOYALTY_ADJUSTED", id, {
          before,
          balance,
          ...input,
        });
        return { id, balance };
      },
    );
  }

  @Get("loyalty/customers/:id")
  async customerLoyalty(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
  ) {
    if (!has(request.user, "sales.create"))
      requirePermission(request.user, "partners.view");
    const id = parse(uuid, rawId);
    const customer = (
      await this.db.pool.query(
        "SELECT id,name FROM partners WHERE id=$1 AND kind='CUSTOMER'",
        [id],
      )
    ).rows[0];
    if (!customer) throw new NotFoundException("Không tìm thấy khách hàng.");
    const entries = (
      await this.db.pool.query(
        "SELECT l.*,COALESCE(o.code,'Điều chỉnh') order_code FROM loyalty_ledger l LEFT JOIN orders o ON o.id=l.order_id WHERE l.customer_id=$1 AND ($2::uuid[] IS NULL OR l.warehouse_id IS NULL OR l.warehouse_id=ANY($2)) ORDER BY l.created_at DESC,l.id LIMIT 100",
        [id, scopeOf(request)],
      )
    ).rows;
    return {
      customer,
      balance: await this.loyalty.balance(this.db.pool, id),
      entries,
    };
  }

  @Get("loyalty/ledger")
  async pointsLedger(@Req() request: AuthRequest) {
    if (!has(request.user, "sales.view"))
      requirePermission(request.user, "audit.view");
    const own =
      has(request.user, "reports.view") || has(request.user, "audit.view")
        ? null
        : request.user.id;
    return (
      await this.db.pool.query(
        "SELECT l.*,COALESCE(o.code,'Điều chỉnh') order_code,p.name customer_name FROM loyalty_ledger l LEFT JOIN orders o ON o.id=l.order_id JOIN partners p ON p.id=l.customer_id WHERE ($1::uuid[] IS NULL OR l.warehouse_id IS NULL OR l.warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR l.created_by=$2) ORDER BY l.created_at DESC,l.id LIMIT 30",
        [scopeOf(request), own],
      )
    ).rows;
  }

  @Get("ledger/:id")
  async ledger(@Req() request: AuthRequest, @Param("id") rawId: string) {
    requirePermission(request.user, "inventory.view");
    const id = parse(uuid, rawId);
    const lot = (
      await this.db.pool.query("SELECT warehouse_id FROM lots WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!lot) throw new NotFoundException("Không tìm thấy lô.");
    requireWarehouse(request.user, lot.warehouse_id);
    return (
      await this.db.pool.query(
        "SELECT l.*,u.name actor FROM stock_ledger l JOIN users u ON u.id=l.created_by WHERE lot_id=$1 ORDER BY l.created_at DESC LIMIT 200",
        [id],
      )
    ).rows;
  }

  @Post("lots/:id/release")
  async releaseLot(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "inventory.approve");
    const id = parse(uuid, rawId);
    const input = parse(
      z.object({ reason: z.string().trim().min(3).max(500) }).strict(),
      body,
    );
    return this.operations.once(
      request.user,
      key,
      "lot.release",
      { id, ...input },
      async (client) => {
        const existing = (
          await client.query(
            "SELECT warehouse_id,product_id FROM lots WHERE id=$1",
            [id],
          )
        ).rows[0];
        if (!existing) throw new NotFoundException("Không tìm thấy lô.");
        requireWarehouse(request.user, existing.warehouse_id);
        await this.operations.locks(client, [
          existing.warehouse_id + ":" + existing.product_id,
        ]);
        const lot = (
          await client.query(
            "SELECT *,expires_on<CURRENT_DATE expired FROM lots WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (lot.state !== "QUARANTINE" || lot.expired)
          throw new ConflictException(
            "Chỉ mở bán lô đang cách ly và còn hạn sau khi đã kiểm tra thực tế.",
          );
        await client.query("UPDATE lots SET state='AVAILABLE' WHERE id=$1", [
          id,
        ]);
        await audit(client, request.user.id, "LOT_RELEASED", id, input);
        return { id, state: "AVAILABLE" };
      },
    );
  }

  @Get("documents")
  async documents(@Req() request: AuthRequest) {
    requirePermission(request.user, "inventory.view");
    const rows = (
      await this.db.pool.query(
        "SELECT d.*,u.name actor,w.name warehouse_name FROM stock_documents d JOIN users u ON u.id=d.created_by JOIN warehouses w ON w.id=d.warehouse_id WHERE $1::uuid[] IS NULL OR d.warehouse_id=ANY($1) ORDER BY d.created_at DESC LIMIT 200",
        [scopeOf(request)],
      )
    ).rows;
    return sanitizeMoney(rows, request.user);
  }

  @Post("documents")
  documentsCreate(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.operations.createDocument(
      request.user,
      parse(documentSchema, body),
      key,
    );
  }

  @Post("documents/:id/post")
  documentsPost(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.operations.postDocument(request.user, parse(uuid, id), key);
  }

  @Post("documents/:id/submit")
  async documentsSubmit(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
  ) {
    const id = parse(uuid, rawId);
    return this.db.transaction(async (client) => {
      const document = (
        await client.query(
          "SELECT * FROM stock_documents WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!document) throw new NotFoundException("Không tìm thấy phiếu.");
      requireWarehouse(request.user, document.warehouse_id);
      requirePermission(
        request.user,
        document.kind === "COUNT"
          ? "inventory.count.create"
          : ["RECEIPT", "RETURN"].includes(document.kind)
            ? "inventory.receipt.create"
            : "inventory.issue.create",
      );
      if (document.created_by !== request.user.id && !request.user.owner)
        throw new BadRequestException(
          "Chỉ người lập hoặc chủ cửa hàng gửi phiếu.",
        );
      if (document.status !== "DRAFT")
        throw new ConflictException("Phiếu không ở trạng thái nháp.");
      await client.query(
        "UPDATE stock_documents SET status='PENDING' WHERE id=$1",
        [id],
      );
      await audit(client, request.user.id, "STOCK_SUBMITTED", id);
      return { id, status: "PENDING" };
    });
  }

  @Post("documents/:id/cancel")
  async documentsCancel(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "inventory.approve");
    const id = parse(uuid, rawId);
    const input = parse(
      z.object({ reason: z.string().trim().min(3).max(500) }).strict(),
      body,
    );
    return this.db.transaction(async (client) => {
      const document = (
        await client.query(
          "SELECT * FROM stock_documents WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!document) throw new NotFoundException("Không tìm thấy phiếu.");
      requireWarehouse(request.user, document.warehouse_id);
      if (!["DRAFT", "PENDING"].includes(document.status))
        throw new ConflictException(
          "Phiếu đã ghi sổ cần tạo phiếu điều chỉnh, không hủy mất lịch sử.",
        );
      await client.query(
        "UPDATE stock_documents SET status='CANCELLED' WHERE id=$1",
        [id],
      );
      await audit(client, request.user.id, "STOCK_CANCELLED", id, input);
      return { id, status: "CANCELLED" };
    });
  }

  @Post("sales")
  async sale(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return sanitizeMoney(
      await this.operations.sale(request.user, parse(saleSchema, body), key),
      request.user,
    );
  }

  @Get("orders")
  async orders(@Req() request: AuthRequest) {
    requirePermission(request.user, "sales.view");
    const own =
      has(request.user, "reports.view") ||
      has(request.user, "sales.fulfillment")
        ? null
        : request.user.id;
    return sanitizeMoney(
      (
        await this.db.pool.query(
          "SELECT o.*,(SELECT d.id FROM debts d WHERE d.order_id=o.id AND d.kind='RECEIVABLE' AND d.balance>0 LIMIT 1) debt_id,p.name customer_name,u.name actor FROM orders o LEFT JOIN partners p ON p.id=o.customer_id JOIN users u ON u.id=o.created_by WHERE ($1::uuid[] IS NULL OR o.warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR o.created_by=$2) AND ($3::uuid IS NULL OR o.customer_id=$3) ORDER BY o.created_at DESC LIMIT 200",
          [
            scopeOf(request),
            own,
            request.query.customerId
              ? parse(uuid, request.query.customerId)
              : null,
          ],
        )
      ).rows,
      request.user,
    );
  }

  @Post("orders/:id/return")
  returnOrder(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    const input = parse(
      z
        .object({
          reason: z.string().trim().min(3).max(500),
          refundMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
        })
        .strict(),
      body,
    );
    return this.operations.returnOrder(
      request.user,
      parse(uuid, id),
      input.reason,
      key,
      input.refundMethod,
    );
  }

  @Patch("orders/:id/delivery")
  async updateDelivery(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "sales.fulfillment");
    const id = parse(uuid, rawId);
    const input = parse(
      z
        .object({
          status: z.enum([
            "PENDING_PACK",
            "PENDING_HANDOVER",
            "SHIPPING",
            "DELIVERED",
          ]),
          carrier: z.string().trim().max(100).default(""),
          trackingCode: z.string().trim().max(100).default(""),
        })
        .strict(),
      body,
    );
    return this.db.transaction(async (client) => {
      const order = (
        await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!order) throw new NotFoundException("Không tìm thấy đơn hàng.");
      requireWarehouse(request.user, order.warehouse_id);
      if (order.returned)
        throw new ConflictException("Không cập nhật giao hàng cho đơn đã trả.");
      await client.query(
        "UPDATE orders SET delivery_status=$2,carrier=$3,tracking_code=$4 WHERE id=$1",
        [id, input.status, input.carrier, input.trackingCode],
      );
      await audit(client, request.user.id, "ORDER_DELIVERY_CHANGED", id, {
        before: order.delivery_status,
        ...input,
      });
      return { id, ...input };
    });
  }

  @Get("partners")
  async partners(@Req() request: AuthRequest) {
    requirePermission(request.user, "partners.view");
    return (
      await this.db.pool.query(
        `SELECT p.*,COALESCE(a.balance,0) loyalty_balance,COALESCE(s.spend,0) lifetime_spend,COALESCE(s.pending,0) pending_points,COALESCE(d.balance,0) debt_balance,GREATEST(COALESCE(l.earned,0),0) lifetime_earned
        FROM partners p LEFT JOIN loyalty_accounts a ON a.customer_id=p.id
        LEFT JOIN (SELECT customer_id,SUM(total) FILTER(WHERE NOT returned)::numeric spend,
          SUM(GREATEST(COALESCE((loyalty_snapshot->>'potentialPoints')::numeric,0)-loyalty_earned,0)) FILTER(WHERE NOT returned)::numeric pending
          FROM orders WHERE ($1::uuid[] IS NULL OR warehouse_id=ANY($1)) GROUP BY customer_id) s ON s.customer_id=p.id
        LEFT JOIN (SELECT partner_id,SUM(balance)::numeric balance FROM debts WHERE ($1::uuid[] IS NULL OR warehouse_id=ANY($1)) GROUP BY partner_id) d ON d.partner_id=p.id
        LEFT JOIN (SELECT customer_id,SUM(delta) FILTER(WHERE kind IN ('EARN','RETURN_EARN'))::numeric earned FROM loyalty_ledger GROUP BY customer_id) l ON l.customer_id=p.id
        ORDER BY p.name LIMIT 500`,
        [scopeOf(request)],
      )
    ).rows;
  }

  @Get("partners/:id/purchases")
  async customerPurchases(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
  ) {
    requirePermission(request.user, "partners.view");
    requirePermission(request.user, "sales.view");
    const id = parse(uuid, rawId);
    const page = parse(
      z.coerce.number().int().min(1).max(10000),
      request.query.page ?? 1,
    );
    const partner = (
      await this.db.pool.query(
        "SELECT id,name FROM partners WHERE id=$1 AND kind='CUSTOMER'",
        [id],
      )
    ).rows[0];
    if (!partner) throw new NotFoundException("Không tìm thấy khách hàng.");
    const own =
      has(request.user, "reports.view") ||
      has(request.user, "sales.fulfillment")
        ? null
        : request.user.id;
    const params = [id, scopeOf(request), own];
    const [summary, orders] = await Promise.all([
      this.db.pool.query(
        `SELECT count(*)::int count,count(*) FILTER(WHERE NOT returned)::int orders,
        COALESCE(sum(total) FILTER(WHERE NOT returned),0)::numeric spent,
        COALESCE(sum(paid) FILTER(WHERE NOT returned),0)::numeric paid,
        COALESCE(sum(total-paid) FILTER(WHERE NOT returned),0)::numeric outstanding
        FROM orders WHERE customer_id=$1 AND ($2::uuid[] IS NULL OR warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR created_by=$3)`,
        params,
      ),
      this.db.pool.query(
        `SELECT id,code,created_at,total,paid,returned,payment_status,lines
        FROM orders WHERE customer_id=$1 AND ($2::uuid[] IS NULL OR warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR created_by=$3)
        ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET $4`,
        [...params, (page - 1) * 30],
      ),
    ]);
    return sanitizeMoney(
      {
        customer: partner,
        summary: summary.rows[0],
        page,
        pageSize: 30,
        orders: orders.rows,
      },
      request.user,
    );
  }

  @Post("partners")
  async partnersCreate(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "partners.manage");
    const input = parse(partnerSchema, body);
    if (input.creditLimit > 0)
      requirePermission(request.user, "partners.credit.manage");
    return this.operations.once(
      request.user,
      key,
      "partners.create",
      input,
      async (client) => {
        const id = randomUUID();
        await client.query(
          "INSERT INTO partners(id,name,kind,phone,address,tax_code,credit_limit) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            input.name,
            input.kind,
            input.phone,
            input.address,
            input.taxCode,
            input.creditLimit,
          ],
        );
        await audit(client, request.user.id, "PARTNER_CREATED", id, input);
        return { id };
      },
    );
  }

  @Patch("partners/:id")
  async partnerUpdate(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "partners.manage");
    const id = parse(uuid, rawId);
    const input = parse(partnerSchema, body);
    return this.db.transaction(async (client) => {
      const old = (
        await client.query("SELECT * FROM partners WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!old) throw new NotFoundException("Không tìm thấy đối tác.");
      if (old.kind !== input.kind)
        throw new BadRequestException(
          "Không đổi loại khách hàng/nhà cung cấp của hồ sơ đã tạo.",
        );
      if (old.credit_limit !== input.creditLimit)
        requirePermission(request.user, "partners.credit.manage");
      await client.query(
        "UPDATE partners SET name=$2,phone=$3,address=$4,tax_code=$5,credit_limit=$6 WHERE id=$1",
        [
          id,
          input.name,
          input.phone,
          input.address,
          input.taxCode,
          input.creditLimit,
        ],
      );
      await audit(client, request.user.id, "PARTNER_UPDATED", id, {
        before: old,
        after: input,
      });
      return { id };
    });
  }

  @Get("debts")
  async debts(@Req() request: AuthRequest) {
    requirePermission(request.user, "debts.view");
    const own =
      has(request.user, "reports.view") || has(request.user, "payments.create")
        ? null
        : request.user.id;
    return (
      await this.db.pool.query(
        `SELECT d.*,p.name partner_name,p.phone,o.code order_code,d.due_on<CURRENT_DATE AND d.balance>0 overdue,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pay.id,'amount',pay.amount,'method',pay.method,'createdAt',pay.created_at) ORDER BY pay.created_at DESC) FROM payments pay WHERE pay.debt_id=d.id),'[]') payments
      FROM debts d JOIN partners p ON p.id=d.partner_id LEFT JOIN orders o ON o.id=d.order_id
      WHERE ($1::uuid[] IS NULL OR d.warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR o.created_by=$2)
      ORDER BY d.balance>0 DESC,d.due_on LIMIT 300`,
        [scopeOf(request), own],
      )
    ).rows;
  }

  @Post("debts/:id/pay")
  debtPay(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    const input = parse(
      z
        .object({
          amount: amount.positive(),
          method: z.enum(["CASH", "TRANSFER"]),
        })
        .strict(),
      body,
    );
    return this.operations.payDebt(
      request.user,
      parse(uuid, id),
      input.amount,
      input.method,
      key,
    );
  }

  @Get("invoices")
  async invoices(@Req() request: AuthRequest) {
    requirePermission(request.user, "invoices.view");
    const own = has(request.user, "reports.view") ? null : request.user.id;
    return sanitizeMoney(
      (
        await this.db.pool.query(
          "SELECT i.*,o.code order_code,o.lines,o.subtotal,o.discount,o.loyalty_discount,o.loyalty_spent,o.loyalty_earned,o.loyalty_snapshot,o.total,o.paid,o.payment_status,o.delivery_status,o.returned,p.name customer_name,p.tax_code,p.address,p.phone FROM invoices i JOIN orders o ON o.id=i.order_id LEFT JOIN partners p ON p.id=o.customer_id WHERE ($1::uuid[] IS NULL OR o.warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR o.created_by=$2) ORDER BY i.created_at DESC LIMIT 200",
          [scopeOf(request), own],
        )
      ).rows,
      request.user,
    );
  }

  @Post("invoices/:id/issue")
  async invoiceIssue(@Req() request: AuthRequest, @Param("id") id: string) {
    requirePermission(request.user, "invoices.issue");
    const invoice = (
      await this.db.pool.query(
        "SELECT o.warehouse_id FROM invoices i JOIN orders o ON o.id=i.order_id WHERE i.id=$1",
        [parse(uuid, id)],
      )
    ).rows[0];
    if (!invoice) throw new NotFoundException("Không tìm thấy chứng từ.");
    requireWarehouse(request.user, invoice.warehouse_id);
    throw new ServiceUnavailableException(
      "Chưa cấu hình nhà cung cấp hóa đơn điện tử. Bạn có thể in phiếu bán PDF nội bộ.",
    );
  }

  @Get("dashboard")
  async dashboard(@Req() request: AuthRequest) {
    const scope = scopeOf(request);
    const own = has(request.user, "reports.view") ? null : request.user.id;
    const sales =
      has(request.user, "sales.view") || has(request.user, "reports.view")
        ? (
            await this.db.pool.query(
              "SELECT COUNT(*)::int orders,COALESCE(sum(total),0)::numeric revenue,COALESCE(sum(paid),0)::numeric collected FROM orders WHERE NOT returned AND created_at::date=CURRENT_DATE AND ($1::uuid[] IS NULL OR warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR created_by=$2)",
              [scope, own],
            )
          ).rows[0]
        : null;
    const stock = has(request.user, "inventory.view")
      ? (
          await this.db.pool.query(
            "SELECT COUNT(*) FILTER(WHERE expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+90 AND quantity>0)::int expiring,COUNT(*) FILTER(WHERE expires_on<CURRENT_DATE AND quantity>0)::int expired FROM lots WHERE $1::uuid[] IS NULL OR warehouse_id=ANY($1)",
            [scope],
          )
        ).rows[0]
      : null;
    const pending = has(request.user, "inventory.view")
      ? (
          await this.db.pool.query(
            "SELECT COUNT(*)::int count FROM stock_documents WHERE status='PENDING' AND ($1::uuid[] IS NULL OR warehouse_id=ANY($1))",
            [scope],
          )
        ).rows[0].count
      : null;
    const debts =
      has(request.user, "debts.view") &&
      (has(request.user, "payments.create") ||
        has(request.user, "reports.view"))
        ? (
            await this.db.pool.query(
              "SELECT COALESCE(sum(balance) FILTER(WHERE kind='RECEIVABLE'),0)::numeric receivable,COALESCE(sum(balance) FILTER(WHERE kind='PAYABLE'),0)::numeric payable,COUNT(*) FILTER(WHERE due_on<CURRENT_DATE AND balance>0)::int overdue FROM debts WHERE $1::uuid[] IS NULL OR warehouse_id=ANY($1)",
              [scope],
            )
          ).rows[0]
        : null;
    const todaySeries = sales
      ? await this.reports.financialSeries(scope, reportRange("DAY"), own)
      : [];
    if (sales) {
      sales.orders = todaySeries.reduce((sum, row) => sum + row.orders, 0);
      sales.revenue = todaySeries.reduce((sum, row) => sum + row.revenue, 0);
      sales.collected = todaySeries.reduce(
        (sum, row) => sum + row.collected,
        0,
      );
    }
    return {
      sales,
      stock,
      pending,
      debts,
      jobs: (
        await this.db.pool.query(
          "SELECT COUNT(*) FILTER(WHERE NOT returned AND paid<total)::int unpaid,COUNT(*) FILTER(WHERE NOT returned AND paid=total)::int completed,COUNT(*) FILTER(WHERE NOT returned AND delivery_status='PENDING_PACK')::int pack,COUNT(*) FILTER(WHERE NOT returned AND delivery_status='PENDING_HANDOVER')::int handover,COUNT(*) FILTER(WHERE NOT returned AND delivery_status='SHIPPING')::int shipping,COUNT(*) FILTER(WHERE returned)::int returned FROM orders WHERE created_at>=CURRENT_DATE-89 AND ($1::uuid[] IS NULL OR warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR created_by=$2)",
          [scope, own],
        )
      ).rows[0],
      yesterday: sales
        ? (
            await this.db.pool.query(
              "SELECT COALESCE(sum(total),0)::numeric revenue FROM orders WHERE NOT returned AND created_at::date=CURRENT_DATE-1 AND ($1::uuid[] IS NULL OR warehouse_id=ANY($1)) AND ($2::uuid IS NULL OR created_by=$2)",
              [scope, own],
            )
          ).rows[0].revenue
        : null,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get("reports")
  async report(@Req() request: AuthRequest) {
    const query = parse(
      z
        .object({
          period: z
            .enum(["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"])
            .optional(),
          anchor: z.iso.date().optional(),
          warehouseId: uuid.optional(),
        })
        .strict(),
      request.query,
    );
    return this.reports.build(
      request.user,
      scopeOf(request),
      query.period,
      query.anchor,
    );
  }

  @Get("admin/users")
  async users(@Req() request: AuthRequest) {
    requirePermission(request.user, "users.manage");
    return (
      await this.db.pool.query(
        "SELECT u.id,u.username,u.name,u.owner,u.active,u.must_change_password,u.warehouse_ids,COALESCE(array_agg(ur.role_id) FILTER(WHERE ur.role_id IS NOT NULL),'{}') role_ids FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id ORDER BY u.owner DESC,u.name",
      )
    ).rows;
  }

  @Post("admin/users")
  async userCreate(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "users.manage");
    const input = parse(
      z
        .object({
          username: z
            .string()
            .trim()
            .regex(/^[a-zA-Z0-9_.-]{3,40}$/),
          name: text,
          password,
          roleIds: z.array(uuid).max(10),
          warehouseIds: z.array(uuid).max(20),
        })
        .strict(),
      body,
    );
    return this.operations.once(
      request.user,
      key,
      "users.create",
      { ...input, password: undefined },
      async (client) => {
        const roles = (
          await client.query("SELECT * FROM roles WHERE id=ANY($1)", [
            input.roleIds,
          ])
        ).rows;
        if (
          roles.length !== new Set(input.roleIds).size ||
          roles.some(
            (role) =>
              role.protected ||
              (!request.user.owner &&
                role.permissions.some(
                  (permission: string) =>
                    !request.user.permissions.includes(permission),
                )),
          )
        )
          throw new BadRequestException(
            "Role không hợp lệ hoặc vượt quyền quản lý.",
          );
        const warehouses = (
          await client.query("SELECT id FROM warehouses WHERE id=ANY($1)", [
            input.warehouseIds,
          ])
        ).rows;
        if (warehouses.length !== new Set(input.warehouseIds).size)
          throw new BadRequestException("Kho không hợp lệ.");
        input.warehouseIds.forEach((id) => requireWarehouse(request.user, id));
        const id = randomUUID();
        await client.query(
          "INSERT INTO users(id,username,name,password_hash,warehouse_ids) VALUES($1,$2,$3,$4,$5)",
          [
            id,
            input.username.toLowerCase(),
            input.name,
            await hashPassword(input.password),
            input.warehouseIds,
          ],
        );
        for (const roleId of new Set(input.roleIds))
          await client.query(
            "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)",
            [id, roleId],
          );
        await audit(client, request.user.id, "USER_CREATED", id, {
          username: input.username,
          roleIds: input.roleIds,
          warehouseIds: input.warehouseIds,
        });
        return { id };
      },
    );
  }

  @Patch("admin/users/:id")
  async userUpdate(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "users.manage");
    const id = parse(uuid, rawId);
    const input = parse(
      z
        .object({
          active: z.boolean(),
          roleIds: z.array(uuid).max(10),
          warehouseIds: z.array(uuid).max(20),
        })
        .strict(),
      body,
    );
    return this.db.transaction(async (client) => {
      const target = (
        await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!target) throw new NotFoundException("Không tìm thấy nhân viên.");
      if (target.owner)
        throw new BadRequestException(
          "Không thay đổi quyền hoặc khóa tài khoản chủ cửa hàng tại đây.",
        );
      if (!request.user.owner) {
        target.warehouse_ids.forEach((warehouseId: string) =>
          requireWarehouse(request.user, warehouseId),
        );
        const existingRoles = (
          await client.query(
            "SELECT r.permissions FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1",
            [id],
          )
        ).rows;
        if (
          existingRoles.some((role) =>
            role.permissions.some(
              (permission: string) =>
                !request.user.permissions.includes(permission),
            ),
          )
        )
          throw new BadRequestException(
            "Tài khoản vượt phạm vi quyền quản lý.",
          );
      }
      const roles = (
        await client.query("SELECT * FROM roles WHERE id=ANY($1)", [
          input.roleIds,
        ])
      ).rows;
      if (
        roles.length !== new Set(input.roleIds).size ||
        roles.some(
          (role) =>
            role.protected ||
            (!request.user.owner &&
              role.permissions.some(
                (permission: string) =>
                  !request.user.permissions.includes(permission),
              )),
        )
      )
        throw new BadRequestException("Không được gán role vượt quyền.");
      const warehouses = (
        await client.query("SELECT id FROM warehouses WHERE id=ANY($1)", [
          input.warehouseIds,
        ])
      ).rows;
      if (warehouses.length !== new Set(input.warehouseIds).size)
        throw new BadRequestException("Kho không hợp lệ.");
      input.warehouseIds.forEach((warehouseId) =>
        requireWarehouse(request.user, warehouseId),
      );
      await client.query(
        "UPDATE users SET active=$2,warehouse_ids=$3 WHERE id=$1",
        [id, input.active, input.warehouseIds],
      );
      await client.query("DELETE FROM user_roles WHERE user_id=$1", [id]);
      for (const roleId of new Set(input.roleIds))
        await client.query(
          "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)",
          [id, roleId],
        );
      await client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(client, request.user.id, "USER_UPDATED", id, {
        before: { active: target.active, warehouseIds: target.warehouse_ids },
        after: input,
      });
      return { id };
    });
  }

  @Post("admin/users/:id/reset-password")
  async resetPassword(@Req() request: AuthRequest, @Param("id") rawId: string) {
    requirePermission(request.user, "users.manage");
    if (!request.user.owner)
      throw new BadRequestException("Chủ cửa hàng thực hiện đặt lại mật khẩu.");
    const id = parse(uuid, rawId);
    const temporaryPassword = randomBytes(18).toString("base64url");
    await this.db.transaction(async (client) => {
      const target = (
        await client.query("SELECT owner FROM users WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!target || target.owner)
        throw new BadRequestException(
          "Không đặt lại mật khẩu chủ cửa hàng tại đây.",
        );
      await client.query(
        "UPDATE users SET password_hash=$2,must_change_password=true WHERE id=$1",
        [id, await hashPassword(temporaryPassword)],
      );
      await client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(client, request.user.id, "PASSWORD_RESET", id);
    });
    return { temporaryPassword };
  }

  @Get("admin/roles")
  async roles(@Req() request: AuthRequest) {
    if (!has(request.user, "users.manage"))
      requirePermission(request.user, "roles.manage");
    return (
      await this.db.pool.query(
        "SELECT * FROM roles ORDER BY protected DESC,name",
      )
    ).rows;
  }

  @Post("admin/roles")
  async roleSave(@Req() request: AuthRequest, @Body() body: unknown) {
    requirePermission(request.user, "roles.manage");
    const input = parse(
      z
        .object({
          id: uuid.optional(),
          name: text,
          permissions: z.array(z.enum(permissionCatalog)).max(100),
        })
        .strict(),
      body,
    );
    if (
      !request.user.owner &&
      input.permissions.some(
        (permission) => !request.user.permissions.includes(permission),
      )
    )
      throw new BadRequestException("Không thể cấp quyền ngoài quyền của bạn.");
    return this.db.transaction(async (client) => {
      const id = input.id ?? randomUUID();
      const old = (
        await client.query("SELECT * FROM roles WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (input.id && !old) throw new NotFoundException("Không tìm thấy role.");
      if (
        old?.protected ||
        (old &&
          !request.user.owner &&
          old.permissions.some(
            (permission: string) =>
              !request.user.permissions.includes(permission),
          ))
      )
        throw new BadRequestException(
          "Role được bảo vệ hoặc vượt quyền quản lý.",
        );
      await client.query(
        "INSERT INTO roles(id,name,permissions) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=$2,permissions=$3",
        [id, input.name, [...new Set(input.permissions)]],
      );
      await audit(client, request.user.id, "ROLE_CHANGED", id, {
        before: old ?? null,
        after: input,
      });
      return { id };
    });
  }

  @Get("admin/audit")
  async auditLog(@Req() request: AuthRequest) {
    requirePermission(request.user, "audit.view");
    return sanitizeMoney(
      (
        await this.db.pool.query(
          "SELECT a.*,u.name actor FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200",
        )
      ).rows,
      request.user,
    );
  }

  @Post("settings/store")
  async settings(@Req() request: AuthRequest, @Body() body: unknown) {
    requirePermission(request.user, "settings.manage");
    const input = parse(
      z
        .object({
          name: text,
          address: z.string().max(300),
          phone: z.string().max(30),
        })
        .strict(),
      body,
    );
    await this.db.transaction(async (client) => {
      await client.query(
        "INSERT INTO settings(key,value) VALUES('store',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
        [JSON.stringify(input)],
      );
      await audit(client, request.user.id, "STORE_UPDATED", "store", input);
    });
    return input;
  }
}
