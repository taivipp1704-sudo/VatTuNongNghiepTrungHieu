import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Database, audit } from "./db";
import {
  AuthRequest,
  SessionGuard,
  requirePermission,
  requireWarehouse,
} from "./auth";
import { Operations, has, sanitizeMoney } from "./operations";
import { parse, uuid } from "./validation";
import { reportRange } from "./reports";

const rangeQuery = z
  .object({
    period: z
      .enum([
        "DAY",
        "WEEK",
        "MONTH",
        "QUARTER",
        "YEAR",
        "ROLLING_7",
        "ROLLING_30",
        "CUSTOM",
      ])
      .optional(),
    anchor: z.iso.date().optional(),
    from: z.iso.date().optional(),
    through: z.iso.date().optional(),
    warehouseId: uuid.optional(),
  })
  .strict();
function scope(request: AuthRequest) {
  if (request.query.warehouseId) {
    const id = parse(uuid, request.query.warehouseId);
    requireWarehouse(request.user, id);
    return [id];
  }
  return request.user.owner ? null : request.user.warehouseIds;
}
const rangeOf = (q: z.infer<typeof rangeQuery>) =>
  reportRange(q.period, q.anchor, q.from, q.through);

@Controller("api/management")
@UseGuards(SessionGuard)
export class ManagementController {
  constructor(
    private readonly db: Database,
    private readonly operations: Operations,
  ) {}

  @Get("products/:id/stock")
  async stock(@Req() request: AuthRequest, @Param("id") rawId: string) {
    requirePermission(request.user, "inventory.view");
    const id = parse(uuid, rawId),
      scoped = scope(request);
    const product = (
      await this.db.pool.query("SELECT * FROM products WHERE id=$1", [id])
    ).rows[0];
    if (!product) throw new NotFoundException("Không tìm thấy hàng hóa.");
    const rows = (
      await this.db.pool.query(
        `SELECT w.id,w.name,COALESCE(p.location,'') location,
      COALESCE(p.min_stock,$3::numeric) min_stock,p.max_stock,
      COALESCE(s.actual,0)::numeric actual,COALESCE(s.reserved,0)::numeric reserved,COALESCE(s.available,0)::numeric available,
      CASE WHEN s.actual>0 THEN round(s.value/s.actual) ELSE $4::numeric END "costBase",
      COALESCE(i.incoming,0)::numeric incoming
      FROM warehouses w LEFT JOIN product_warehouse_preferences p ON p.warehouse_id=w.id AND p.product_id=$1
      LEFT JOIN LATERAL(SELECT sum(quantity) actual,sum(reserved) reserved,sum(quantity*cost_base) value,
        sum(CASE WHEN state='AVAILABLE' AND (expires_on IS NULL OR expires_on>=CURRENT_DATE) THEN quantity-reserved ELSE 0 END) available
        FROM lots WHERE warehouse_id=w.id AND product_id=$1) s ON true
      LEFT JOIN LATERAL(SELECT sum((l->>'baseQuantity')::numeric) incoming FROM stock_documents d
        CROSS JOIN LATERAL jsonb_array_elements(d.lines) l WHERE d.warehouse_id=w.id AND d.kind='RECEIPT' AND d.status='PENDING' AND l->>'productId'=$1::text) i ON true
      WHERE ($2::uuid[] IS NULL OR w.id=ANY($2)) ORDER BY w.name`,
        [id, scoped, product.min_stock, product.cost_base],
      )
    ).rows;
    return sanitizeMoney({ warehouses: rows }, request.user);
  }

  @Patch("products/:id/warehouse")
  async saveStockPreferences(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    requirePermission(request.user, "products.manage");
    const id = parse(uuid, rawId),
      input = parse(
        z
          .object({
            warehouseId: uuid,
            location: z.string().trim().max(100),
            minStock: z.number().min(0).max(1e9),
            maxStock: z.number().min(0).max(1e9).nullable(),
          })
          .strict(),
        body,
      );
    requireWarehouse(request.user, input.warehouseId);
    if (input.maxStock !== null && input.maxStock < input.minStock)
      throw new BadRequestException(
        "Tồn tối đa phải từ tồn tối thiểu trở lên.",
      );
    return this.db.transaction(async (client) => {
      if (
        !(
          await client.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rowCount
      )
        throw new NotFoundException("Không tìm thấy hàng hóa.");
      const before = (
        await client.query(
          "SELECT * FROM product_warehouse_preferences WHERE product_id=$1 AND warehouse_id=$2",
          [id, input.warehouseId],
        )
      ).rows[0];
      await client.query(
        `INSERT INTO product_warehouse_preferences(product_id,warehouse_id,location,min_stock,max_stock) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(product_id,warehouse_id) DO UPDATE SET location=EXCLUDED.location,min_stock=EXCLUDED.min_stock,max_stock=EXCLUDED.max_stock`,
        [id, input.warehouseId, input.location, input.minStock, input.maxStock],
      );
      await audit(client, request.user.id, "WAREHOUSE_PRODUCT_SETTINGS", id, {
        before,
        after: input,
      });
      return { id };
    });
  }

  @Get("products/:id/history")
  async stockHistory(@Req() request: AuthRequest, @Param("id") rawId: string) {
    requirePermission(request.user, "inventory.view");
    const id = parse(uuid, rawId),
      page = parse(
        z.coerce.number().int().min(1).max(10000),
        request.query.page ?? 1,
      );
    const rows = (
      await this.db.pool.query(
        `SELECT g.id,g.created_at,g.delta,g.balance,g.reason,l.code lot,l.state,w.name warehouse,u.name employee,
      COALESCE(o.code,d.code,'') reference,p.base_unit unit,count(*) OVER()::int total
      FROM stock_ledger g JOIN lots l ON l.id=g.lot_id JOIN products p ON p.id=l.product_id JOIN warehouses w ON w.id=l.warehouse_id
      JOIN users u ON u.id=g.created_by LEFT JOIN orders o ON o.id=g.order_id LEFT JOIN stock_documents d ON d.id=g.document_id
      WHERE l.product_id=$1 AND ($2::uuid[] IS NULL OR l.warehouse_id=ANY($2)) ORDER BY g.created_at DESC,g.id DESC LIMIT 30 OFFSET $3`,
        [id, scope(request), (page - 1) * 30],
      )
    ).rows;
    return { items: rows, page, pageSize: 30, total: rows[0]?.total ?? 0 };
  }

  @Get("partners/:id/ledger")
  async partnerLedger(@Req() request: AuthRequest, @Param("id") rawId: string) {
    requirePermission(request.user, "partners.view");
    requirePermission(request.user, "debts.view");
    const id = parse(uuid, rawId),
      scoped = scope(request),
      page = parse(
        z.coerce.number().int().min(1).max(10000),
        request.query.page ?? 1,
      );
    const partner = (
      await this.db.pool.query("SELECT id,kind FROM partners WHERE id=$1", [id])
    ).rows[0];
    if (!partner || partner.kind !== "CUSTOMER")
      throw new NotFoundException("Không tìm thấy khách hàng.");
    const own =
      has(request.user, "reports.view") ||
      has(request.user, "payments.create") ||
      has(request.user, "partners.balance.adjust")
        ? null
        : request.user.id;
    const result = await this.db.pool.query(
      `WITH selected AS(SELECT * FROM orders WHERE customer_id=$1 AND ($2::uuid[] IS NULL OR warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR created_by=$3)),
      events AS(
        SELECT id,created_at,total delta,code reference,'Bán hàng' action,created_by,0 seq FROM selected
        UNION ALL SELECT p.id,p.created_at,CASE WHEN p.direction='IN' THEN -p.amount ELSE p.amount END,o.code,
          CASE WHEN p.direction='IN' THEN 'Thu tiền' ELSE 'Hoàn tiền' END,p.created_by,1 FROM payments p JOIN selected o ON o.id=p.order_id
        UNION ALL SELECT id,returned_at,-total,code,'Trả hàng',created_by,2 FROM selected WHERE returned AND returned_at IS NOT NULL
        UNION ALL SELECT id,created_at,delta,'Điều chỉnh',reason,created_by,3 FROM partner_adjustments WHERE partner_id=$1 AND ($2::uuid[] IS NULL OR warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR created_by=$3)
      ), running AS(SELECT e.*,u.name employee,sum(delta) OVER(ORDER BY e.created_at,e.seq,e.id)::numeric balance FROM events e JOIN users u ON u.id=e.created_by)
      SELECT r.*,count(*) OVER()::int total,sum(delta) OVER()::numeric current_balance FROM running r ORDER BY created_at DESC,seq DESC,id DESC LIMIT 30 OFFSET $4`,
      [id, scoped, own, (page - 1) * 30],
    );
    // A page beyond the last row must still return the account's current balance.
    const balance = (
      await this.db.pool.query(
        `SELECT COALESCE((SELECT sum(d.balance) FROM debts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.partner_id=$1 AND d.kind='RECEIVABLE' AND ($2::uuid[] IS NULL OR d.warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR o.created_by=$3)),0)
      +COALESCE((SELECT sum(delta) FROM partner_adjustments WHERE partner_id=$1 AND ($2::uuid[] IS NULL OR warehouse_id=ANY($2)) AND ($3::uuid IS NULL OR created_by=$3)),0) balance`,
        [id, scoped, own],
      )
    ).rows[0].balance;
    return {
      items: result.rows,
      page,
      pageSize: 30,
      total: result.rows[0]?.total ?? 0,
      balance,
      ownOnly: own !== null,
    };
  }

  @Post("partners/:id/balance")
  async adjustBalance(
    @Req() request: AuthRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    requirePermission(request.user, "partners.balance.adjust");
    requirePermission(request.user, "debts.view");
    const id = parse(uuid, rawId),
      input = parse(
        z
          .object({
            warehouseId: uuid,
            newBalance: z.number().int().min(-1e12).max(1e12),
            reason: z.string().trim().min(3).max(500),
          })
          .strict(),
        body,
      );
    requireWarehouse(request.user, input.warehouseId);
    return this.operations.once(
      request.user,
      key,
      "partners.balance.adjust",
      { id, ...input },
      async (client) => {
        const partner = (
          await client.query(
            "SELECT kind FROM partners WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (partner?.kind !== "CUSTOMER")
          throw new NotFoundException("Không tìm thấy khách hàng.");
        const before = (
          await client.query(
            `SELECT COALESCE((SELECT sum(balance) FROM debts WHERE partner_id=$1 AND warehouse_id=$2 AND kind='RECEIVABLE'),0)+COALESCE((SELECT sum(delta) FROM partner_adjustments WHERE partner_id=$1 AND warehouse_id=$2),0) balance`,
            [id, input.warehouseId],
          )
        ).rows[0].balance;
        const delta = input.newBalance - before;
        if (
          !Number.isSafeInteger(delta) ||
          Math.abs(delta) > 1e12 ||
          delta === 0
        )
          throw new BadRequestException(
            "Số dư mới phải khác số dư hiện tại và nằm trong giới hạn cho phép.",
          );
        const entry = randomUUID();
        await client.query(
          "INSERT INTO partner_adjustments(id,partner_id,warehouse_id,delta,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)",
          [entry, id, input.warehouseId, delta, input.reason, request.user.id],
        );
        await audit(client, request.user.id, "PARTNER_BALANCE_ADJUSTED", id, {
          warehouseId: input.warehouseId,
          before,
          after: input.newBalance,
          delta,
          reason: input.reason,
        });
        return { id: entry, balance: input.newBalance };
      },
    );
  }

  @Get("reports/inventory")
  async inventoryReport(@Req() request: AuthRequest) {
    requirePermission(request.user, "reports.view");
    requirePermission(request.user, "inventory.view");
    const q = parse(rangeQuery, request.query),
      range = rangeOf(q);
    const items = (
      await this.db.pool.query(
        `WITH movement AS(SELECT l.product_id,l.warehouse_id,
      sum(g.delta) FILTER(WHERE g.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) after_start,
      sum(g.delta) FILTER(WHERE g.created_at>=($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) after_end,
      sum(GREATEST(g.delta,0)) FILTER(WHERE g.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND g.created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) incoming,
      sum(GREATEST(-g.delta,0)) FILTER(WHERE g.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND g.created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) outgoing
      FROM stock_ledger g JOIN lots l ON l.id=g.lot_id WHERE NOT g.is_reconciliation AND ($3::uuid[] IS NULL OR l.warehouse_id=ANY($3)) GROUP BY l.product_id,l.warehouse_id
      ), balances AS(SELECT product_id,warehouse_id,sum(quantity) actual,sum(reserved) reserved,sum(quantity*cost_base) "costTotal" FROM lots WHERE ($3::uuid[] IS NULL OR warehouse_id=ANY($3)) GROUP BY product_id,warehouse_id)
      SELECT p.id,p.sku,p.name,p.base_unit unit,w.id warehouse_id,w.name warehouse,
      COALESCE(b.actual,0)-COALESCE(m.after_start,0) opening,COALESCE(m.incoming,0) incoming,COALESCE(m.outgoing,0) outgoing,
      COALESCE(b.actual,0)-COALESCE(m.after_end,0) closing,COALESCE(b.actual,0) actual,COALESCE(b.reserved,0) reserved,
      COALESCE(b."costTotal",0) "costTotal",COALESCE(pref.min_stock,p.min_stock) min_stock,pref.max_stock,COALESCE(pref.location,'') location
      FROM products p CROSS JOIN warehouses w LEFT JOIN balances b ON b.product_id=p.id AND b.warehouse_id=w.id
      LEFT JOIN movement m ON m.product_id=p.id AND m.warehouse_id=w.id LEFT JOIN product_warehouse_preferences pref ON pref.product_id=p.id AND pref.warehouse_id=w.id
      WHERE p.active AND ($3::uuid[] IS NULL OR w.id=ANY($3)) ORDER BY p.name,w.name LIMIT 5000`,
        [range.start, range.end, scope(request)],
      )
    ).rows;
    return sanitizeMoney(
      { range, items, skuCount: new Set(items.map((r) => r.id)).size },
      request.user,
    );
  }

  @Get("reports/finance")
  async financeReport(@Req() request: AuthRequest) {
    requirePermission(request.user, "reports.view");
    requirePermission(request.user, "reports.finance");
    const q = parse(
        rangeQuery.extend({
          method: z.enum(["ALL", "CASH", "TRANSFER"]).default("ALL"),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        }),
        request.query,
      ),
      range = rangeOf(q);
    const parameters = [range.start, range.end, scope(request), q.method];
    const where =
      "($3::uuid[] IS NULL OR p.warehouse_id=ANY($3)) AND ($4='ALL' OR p.method=$4)";
    const totals = (
      await this.db.pool.query(
        `SELECT COALESCE(sum(CASE WHEN p.direction='IN' THEN p.amount ELSE -p.amount END) FILTER(WHERE p.created_at<($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')),0)::numeric recorded_opening,
      COALESCE(sum(p.amount) FILTER(WHERE p.direction='IN' AND p.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND p.created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')),0)::numeric received,
      COALESCE(sum(p.amount) FILTER(WHERE p.direction='OUT' AND p.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND p.created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')),0)::numeric paid
      FROM payments p WHERE ${where}`,
        parameters,
      )
    ).rows[0];
    const rows = (
      await this.db.pool.query(
        `SELECT p.*,w.name warehouse,u.name employee,COALESCE(o.code,d.code,'') reference,c.name partner,count(*) OVER()::int total
      FROM payments p JOIN warehouses w ON w.id=p.warehouse_id JOIN users u ON u.id=p.created_by LEFT JOIN debts debt ON debt.id=p.debt_id
      LEFT JOIN orders o ON o.id=COALESCE(p.order_id,debt.order_id) LEFT JOIN stock_documents d ON d.id=debt.document_id LEFT JOIN partners c ON c.id=COALESCE(o.customer_id,debt.partner_id)
      WHERE ${where} AND p.created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND p.created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY p.created_at DESC,p.id DESC LIMIT 50 OFFSET $5`,
        [...parameters, (q.page - 1) * 50],
      )
    ).rows;
    return {
      range,
      totals: {
        ...totals,
        net: totals.received - totals.paid,
        recordedClosing:
          totals.recorded_opening + totals.received - totals.paid,
      },
      items: rows,
      total: rows[0]?.total ?? 0,
      page: q.page,
      pageSize: 50,
    };
  }
}
