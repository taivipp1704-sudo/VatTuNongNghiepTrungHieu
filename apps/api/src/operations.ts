import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { Database, audit } from "./db";
import { User, requirePermission, requireWarehouse } from "./auth";
import { documentSchema, saleSchema } from "./validation";
import { Loyalty, loyaltyAmounts } from "./loyalty";
import { listPrice } from "./pricing";

type StockInput = z.infer<typeof documentSchema>;
type SaleInput = z.infer<typeof saleSchema>;
type Data = Record<string, any>;
const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;
const code = (prefix: string) =>
  prefix +
  "-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  randomUUID().slice(0, 4).toUpperCase();
export const has = (user: User, permission: string) =>
  user.owner || user.permissions.includes(permission);

export function sanitizeMoney<Result>(data: Result, user: User): Result {
  if (has(user, "inventory.cost.view")) return data;
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      /^(cost_base|costBase|cost|costTotal|profit|margin)$/.test(key)
        ? undefined
        : value,
    ),
  );
}

@Injectable()
export class Operations {
  constructor(
    private readonly db: Database,
    private readonly loyalty: Loyalty,
  ) {}

  async once<Result>(
    user: User,
    key: string | undefined,
    operation: string,
    input: unknown,
    work: (client: PoolClient) => Promise<Result>,
  ): Promise<Result> {
    if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      throw new BadRequestException("Thiếu Idempotency-Key hợp lệ.");
    const hash = createHash("sha256")
      .update(operation + JSON.stringify(input))
      .digest("hex");
    return this.db.transaction(async (client) => {
      const added = await client.query(
        "INSERT INTO idempotency(user_id,key,request_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key",
        [user.id, key, hash],
      );
      if (!added.rowCount) {
        const existing = (
          await client.query(
            "SELECT request_hash,response FROM idempotency WHERE user_id=$1 AND key=$2",
            [user.id, key],
          )
        ).rows[0];
        if (existing.request_hash !== hash)
          throw new ConflictException(
            "Mã gửi lại đã được dùng cho nội dung khác.",
          );
        return existing.response as Result;
      }
      const result = await work(client);
      await client.query(
        "UPDATE idempotency SET response=$3 WHERE user_id=$1 AND key=$2",
        [user.id, key, JSON.stringify(result)],
      );
      return result;
    });
  }

  async locks(client: PoolClient, keys: string[]) {
    for (const key of [...new Set(keys)].sort())
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [key],
      );
  }

  async inventory(
    user: User,
    search = "",
    warehouseId?: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      filter?: string;
      ids?: string[];
    } = {},
  ) {
    requirePermission(user, "inventory.view");
    if (warehouseId) requireWarehouse(user, warehouseId);
    const scope = warehouseId
      ? [warehouseId]
      : user.owner
        ? null
        : user.warehouseIds;
    const rows = (
      await this.db.pool.query(
        `
      SELECT p.*,count(*) OVER()::int list_total,COALESCE(pref.min_stock,p.min_stock) min_stock,pref.max_stock,COALESCE(pref.location,'') storage_location,COALESCE(jsonb_agg(jsonb_build_object(
        'id',l.id,'code',l.code,'warehouseId',l.warehouse_id,'warehouseName',w.name,'location',l.location,
        'expiresOn',l.expires_on,'state',l.state,'quantity',l.quantity,'reserved',l.reserved,'costBase',l.cost_base,
        'available',CASE WHEN l.state='AVAILABLE' AND (l.expires_on IS NULL OR l.expires_on>=CURRENT_DATE) THEN l.quantity-l.reserved ELSE 0 END
      ) ORDER BY l.expires_on NULLS LAST) FILTER(WHERE l.id IS NOT NULL),'[]') lots
      FROM products p LEFT JOIN lots l ON l.product_id=p.id AND ($1::uuid[] IS NULL OR l.warehouse_id=ANY($1))
      LEFT JOIN warehouses w ON w.id=l.warehouse_id
      LEFT JOIN product_warehouse_preferences pref ON pref.product_id=p.id AND pref.warehouse_id=$3
      WHERE p.active AND (p.name ILIKE $2 OR p.sku ILIKE $2 OR p.barcode ILIKE $2 OR p.id::text ILIKE $2 OR p.id=ANY($8::uuid[])) AND ($4='all' OR p.category=$4)
      GROUP BY p.id,pref.product_id,pref.warehouse_id
      HAVING $5='all' OR ($5='low' AND COALESCE(sum(CASE WHEN l.state='AVAILABLE' AND (l.expires_on IS NULL OR l.expires_on>=CURRENT_DATE) THEN l.quantity-l.reserved ELSE 0 END),0)<COALESCE(pref.min_stock,p.min_stock))
       OR ($5='soon' AND bool_or(l.quantity>0 AND l.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+90)) OR ($5='expired' AND bool_or(l.quantity>0 AND l.expires_on<CURRENT_DATE))
      ORDER BY (p.id=ANY($8::uuid[])) DESC,p.name,p.id LIMIT $6 OFFSET $7`,
        [
          scope,
          "%" + search.slice(0, 100) + "%",
          warehouseId ?? null,
          options.category ?? "all",
          options.filter ?? "all",
          options.limit ?? 500,
          ((options.page ?? 1) - 1) * (options.limit ?? 500),
          options.ids ?? [],
        ],
      )
    ).rows;
    return sanitizeMoney(
      rows.map((product) => ({
        ...product,
        details:
          has(user, "sales.wholesale") || has(user, "products.manage")
            ? product.details
            : {
                ...product.details,
                wholesaleBase: undefined,
                wholesalePack: undefined,
              },
        available: product.lots.reduce(
          (total: number, lot: Data) => total + lot.available,
          0,
        ),
        actual: product.lots.reduce(
          (total: number, lot: Data) => total + lot.quantity,
          0,
        ),
      })),
      user,
    );
  }

  async product(client: PoolClient, id: string) {
    const row = (
      await client.query("SELECT * FROM products WHERE id=$1 AND active", [id])
    ).rows[0];
    if (!row)
      throw new NotFoundException("Sản phẩm không tồn tại hoặc đã ngừng bán.");
    return row;
  }

  baseQuantity(product: Data, quantity: number, unit: string) {
    if (
      (unit === "PACK" ||
        !["kg", "lít", "l"].includes(product.base_unit.toLowerCase())) &&
      !Number.isInteger(quantity)
    )
      throw new BadRequestException("Đơn vị này cần số lượng nguyên.");
    const result = roundQuantity(
      quantity * (unit === "PACK" ? product.pack_factor : 1),
    );
    if (
      !Number.isFinite(result) ||
      result < 0 ||
      result > 1_000_000_000 ||
      Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001
    )
      throw new BadRequestException("Số lượng không hợp lệ.");
    return result;
  }

  async ledger(
    client: PoolClient,
    user: User,
    lotId: string,
    delta: number,
    reason: string,
    documentId?: string,
    orderId?: string,
  ) {
    const lot = (
      await client.query(
        "UPDATE lots SET quantity=quantity+$2 WHERE id=$1 AND quantity+$2>=reserved RETURNING quantity",
        [lotId, delta],
      )
    ).rows[0];
    if (!lot)
      throw new ConflictException(
        "Tồn kho đã thay đổi hoặc không đủ để xuất. Vui lòng tải lại.",
      );
    await client.query(
      "INSERT INTO stock_ledger(id,lot_id,document_id,order_id,delta,balance,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        lotId,
        documentId ?? null,
        orderId ?? null,
        delta,
        lot.quantity,
        reason,
        user.id,
      ],
    );
  }

  async createDocument(user: User, input: StockInput, key?: string) {
    const permission =
      input.kind === "RECEIPT" || input.kind === "RETURN"
        ? "inventory.receipt.create"
        : input.kind === "COUNT"
          ? "inventory.count.create"
          : "inventory.issue.create";
    requirePermission(user, permission);
    requireWarehouse(user, input.warehouseId);
    if (input.kind === "TRANSFER") {
      if (!input.destinationId || input.destinationId === input.warehouseId)
        throw new BadRequestException("Chọn một kho đích khác kho xuất.");
      requireWarehouse(user, input.destinationId);
    }
    return this.once(user, key, "stock.create", input, async (client) => {
      const lines = [];
      const usedLots = new Set<string>();
      for (const line of input.lines) {
        const product = await this.product(client, line.productId);
        if (line.costBase !== undefined)
          requirePermission(user, "inventory.cost.view");
        const baseQuantity = this.baseQuantity(
          product,
          line.quantity,
          line.unit,
        );
        if (input.kind !== "COUNT" && baseQuantity <= 0)
          throw new BadRequestException("Số lượng cần lớn hơn 0.");
        if (
          ["ISSUE", "COUNT", "TRANSFER", "DISPOSAL"].includes(input.kind) &&
          !line.lotId
        )
          throw new BadRequestException("Chọn lô hàng cần xử lý.");
        if (
          ["RECEIPT", "RETURN"].includes(input.kind) &&
          product.track_lots &&
          (!line.lotCode || !line.expiresOn)
        )
          throw new BadRequestException(
            "Sản phẩm theo lô cần số lô và hạn sử dụng.",
          );
        const identity = line.lotId ?? line.productId + ":" + line.lotCode;
        if (usedLots.has(identity))
          throw new BadRequestException(
            "Gộp các dòng cùng sản phẩm và lô trước khi gửi.",
          );
        usedLots.add(identity);
        lines.push({
          ...line,
          baseQuantity,
          name: product.name,
          baseUnit: product.base_unit,
          costBase: line.costBase ?? product.cost_base,
        });
      }
      if (input.partnerId) {
        const partner = (
          await client.query("SELECT kind FROM partners WHERE id=$1", [
            input.partnerId,
          ])
        ).rows[0];
        if (
          !partner ||
          (input.kind === "RECEIPT" && partner.kind !== "SUPPLIER")
        )
          throw new BadRequestException(
            "Chọn nhà cung cấp hợp lệ cho phiếu nhập.",
          );
      }
      const id = randomUUID();
      const documentCode = code(
        input.kind === "RECEIPT" ? "PN" : input.kind === "COUNT" ? "KK" : "PX",
      );
      await client.query(
        "INSERT INTO stock_documents(id,code,kind,warehouse_id,destination_id,partner_id,lines,reason,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          documentCode,
          input.kind,
          input.warehouseId,
          input.destinationId ?? null,
          input.partnerId ?? null,
          JSON.stringify(lines),
          input.reason,
          input.status,
          user.id,
        ],
      );
      await audit(client, user.id, "STOCK_CREATED", id, {
        kind: input.kind,
        status: input.status,
      });
      return { id, code: documentCode, status: input.status };
    });
  }

  async postDocument(user: User, id: string, key?: string) {
    requirePermission(user, "inventory.approve");
    return this.once(user, key, "stock.post", { id }, async (client) => {
      const document = (
        await client.query(
          "SELECT * FROM stock_documents WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!document) throw new NotFoundException("Không tìm thấy phiếu.");
      requireWarehouse(user, document.warehouse_id);
      if (document.destination_id)
        requireWarehouse(user, document.destination_id);
      if (document.status !== "PENDING")
        throw new ConflictException("Chỉ ghi sổ phiếu đang chờ duyệt.");
      if (!user.owner && document.created_by === user.id)
        throw new ConflictException(
          "Người lập phiếu không tự duyệt. Gửi chủ cửa hàng duyệt.",
        );
      const lines: Data[] = document.lines;
      await this.locks(
        client,
        lines.flatMap((line) => [
          document.warehouse_id + ":" + line.productId,
          ...(document.destination_id
            ? [document.destination_id + ":" + line.productId]
            : []),
        ]),
      );
      let payable = 0;
      for (const line of lines) {
        if (document.kind === "RECEIPT" || document.kind === "RETURN") {
          const lotCode =
            document.kind === "RETURN"
              ? "TRA-" + id.slice(0, 8) + "-" + (line.lotCode || "LE")
              : line.lotCode || "KHONG-LO";
          let lot = (
            await client.query(
              "SELECT * FROM lots WHERE product_id=$1 AND warehouse_id=$2 AND code=$3 FOR UPDATE",
              [line.productId, document.warehouse_id, lotCode],
            )
          ).rows[0];
          if (!lot) {
            lot = { id: randomUUID() };
            await client.query(
              "INSERT INTO lots(id,product_id,warehouse_id,code,expires_on,location,state,cost_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                lot.id,
                line.productId,
                document.warehouse_id,
                lotCode,
                line.expiresOn ?? null,
                line.location,
                document.kind === "RETURN" ? "QUARANTINE" : "AVAILABLE",
                line.costBase,
              ],
            );
          } else if (
            String(lot.expires_on ?? "") !== String(line.expiresOn ?? "") ||
            lot.cost_base !== line.costBase
          ) {
            throw new ConflictException(
              "Lô đã tồn tại với hạn sử dụng hoặc giá vốn khác. Tạo mã lô nhập riêng.",
            );
          }
          await this.ledger(
            client,
            user,
            lot.id,
            line.baseQuantity,
            document.reason,
            id,
          );
          payable += Math.round(line.baseQuantity * line.costBase);
        } else {
          const lot = (
            await client.query(
              "SELECT *,expires_on<CURRENT_DATE expired FROM lots WHERE id=$1 FOR UPDATE",
              [line.lotId],
            )
          ).rows[0];
          if (
            !lot ||
            lot.product_id !== line.productId ||
            lot.warehouse_id !== document.warehouse_id
          )
            throw new BadRequestException(
              "Lô không thuộc sản phẩm và kho của phiếu.",
            );
          if (
            !["COUNT", "DISPOSAL"].includes(document.kind) &&
            (lot.state !== "AVAILABLE" || lot.expired)
          )
            throw new ConflictException(
              "Lô hết hạn/cách ly không được xuất thông thường.",
            );
          const delta =
            document.kind === "COUNT"
              ? roundQuantity(line.baseQuantity - lot.quantity)
              : -line.baseQuantity;
          await this.ledger(client, user, lot.id, delta, document.reason, id);
          if (document.kind === "TRANSFER") {
            let target = (
              await client.query(
                "SELECT * FROM lots WHERE product_id=$1 AND warehouse_id=$2 AND code=$3 FOR UPDATE",
                [lot.product_id, document.destination_id, lot.code],
              )
            ).rows[0];
            if (!target) {
              target = { id: randomUUID() };
              await client.query(
                "INSERT INTO lots(id,product_id,warehouse_id,code,expires_on,location,state,cost_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
                [
                  target.id,
                  lot.product_id,
                  document.destination_id,
                  lot.code,
                  lot.expires_on,
                  line.location,
                  lot.state,
                  lot.cost_base,
                ],
              );
            } else if (
              target.expires_on !== lot.expires_on ||
              target.state !== lot.state ||
              target.cost_base !== lot.cost_base
            )
              throw new ConflictException("Lô tại kho nhận có thông tin khác.");
            await this.ledger(
              client,
              user,
              target.id,
              -delta,
              document.reason,
              id,
            );
          }
        }
      }
      if (document.kind === "RECEIPT" && document.partner_id && payable > 0) {
        if (!Number.isSafeInteger(payable) || payable > 1_000_000_000_000)
          throw new BadRequestException("Giá trị phiếu vượt giới hạn.");
        await client.query(
          "INSERT INTO debts(id,partner_id,warehouse_id,document_id,kind,original,balance,due_on) VALUES($1,$2,$3,$4,'PAYABLE',$5,$5,CURRENT_DATE+30)",
          [
            randomUUID(),
            document.partner_id,
            document.warehouse_id,
            id,
            payable,
          ],
        );
      }
      await client.query(
        "UPDATE stock_documents SET status='POSTED',posted_by=$2,posted_at=now() WHERE id=$1",
        [id, user.id],
      );
      await audit(client, user.id, "STOCK_POSTED", id, {
        ownerSelfApproved: document.created_by === user.id,
      });
      return { id, status: "POSTED" };
    });
  }

  async sale(user: User, input: SaleInput, key?: string) {
    requirePermission(user, "sales.create");
    requireWarehouse(user, input.warehouseId);
    if (input.discount > 0) requirePermission(user, "sales.discount");
    if (input.redeemPoints > 0) requirePermission(user, "loyalty.redeem");
    if (input.method === "CREDIT" && input.paid !== 0)
      throw new BadRequestException("Đơn ghi nợ cần số tiền đã thu bằng 0.");
    // Quote guards and a zero redemption do not change the business request.
    // Keep hashes compatible with pending requests from APKs before loyalty.
    const {
      expectedTotal: _expectedTotal,
      redeemPoints,
      note,
      deliveryStatus,
      ...legacyInput
    } = input;
    const replayInput = {
      ...legacyInput,
      ...(redeemPoints ? { redeemPoints } : {}),
      ...(note ? { note } : {}),
      ...(deliveryStatus && deliveryStatus !== "DELIVERED"
        ? { deliveryStatus }
        : {}),
    };
    return this.once(
      user,
      key,
      "sales.confirm",
      replayInput,
      async (client) => {
        if (input.customerId) {
          const partner = (
            await client.query(
              "SELECT * FROM partners WHERE id=$1 AND kind='CUSTOMER' FOR UPDATE",
              [input.customerId],
            )
          ).rows[0];
          if (!partner)
            throw new BadRequestException("Khách hàng không tồn tại.");
          if (partner.profile?.active === false)
            throw new BadRequestException("Khách hàng đang ngừng giao dịch.");
        }
        await this.locks(
          client,
          input.lines.map((line) => input.warehouseId + ":" + line.productId),
        );
        const orderId = randomUUID();
        const lines: Data[] = [];
        let subtotal = 0;
        for (const line of input.lines) {
          const product = await this.product(client, line.productId);
          const baseQuantity = this.baseQuantity(
            product,
            line.quantity,
            line.unit,
          );
          if (input.priceBook === "WHOLESALE")
            requirePermission(user, "sales.wholesale");
          const defaultPrice = listPrice(product, line.unit, input.priceBook);
          const unitPrice = line.unitPrice ?? defaultPrice;
          if (unitPrice !== defaultPrice)
            requirePermission(user, "sales.price.edit");
          let remaining = baseQuantity;
          const lots = (
            await client.query(
              "SELECT * FROM lots WHERE product_id=$1 AND warehouse_id=$2 AND state='AVAILABLE' AND (expires_on IS NULL OR expires_on>=CURRENT_DATE) AND quantity>reserved ORDER BY expires_on NULLS LAST,id FOR UPDATE",
              [product.id, input.warehouseId],
            )
          ).rows;
          const allocations: Data[] = [];
          for (const lot of lots) {
            const taken = Math.min(
              remaining,
              roundQuantity(lot.quantity - lot.reserved),
            );
            if (taken <= 0) continue;
            const updated = (
              await client.query(
                "UPDATE lots SET quantity=quantity-$2 WHERE id=$1 RETURNING quantity",
                [lot.id, taken],
              )
            ).rows[0];
            allocations.push({
              lotId: lot.id,
              quantity: taken,
              costBase: lot.cost_base,
              balance: updated.quantity,
            });
            remaining = roundQuantity(remaining - taken);
            if (remaining === 0) break;
          }
          if (remaining > 0)
            throw new ConflictException(
              product.name +
                ": không đủ tồn khả dụng. Vui lòng tải lại giỏ hàng.",
            );
          const total = Math.round(line.quantity * unitPrice);
          subtotal += total;
          lines.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: line.quantity,
            unit: line.unit,
            unitLabel:
              line.unit === "PACK" ? product.pack_unit : product.base_unit,
            baseQuantity,
            unitPrice,
            total,
            loyaltyRate: product.loyalty_rate,
            allocations,
          });
        }
        const settings = await this.loyalty.settings(client);
        const pointsBalance = await this.loyalty.balance(
          client,
          input.customerId,
        );
        const amounts = loyaltyAmounts(
          lines as { total: number; loyaltyRate: number }[],
          subtotal,
          input.discount,
          input.redeemPoints,
          settings,
          pointsBalance,
          Boolean(input.customerId),
        );
        const { total, loyaltyDiscount } = amounts;
        if (input.expectedTotal !== undefined && input.expectedTotal !== total)
          throw new ConflictException(
            "Giá hoặc cấu hình đổi điểm đã thay đổi. Tải lại tổng tiền trước khi xác nhận.",
          );
        if (
          !Number.isSafeInteger(total) ||
          total < 0 ||
          total > 1_000_000_000_000 ||
          input.paid > total
        )
          throw new BadRequestException(
            "Tổng tiền/chiết khấu/số tiền đã thu không hợp lệ.",
          );
        if (input.paid < total && !input.customerId)
          throw new BadRequestException(
            "Đơn chưa thu đủ cần chọn khách hàng có hồ sơ.",
          );
        if (input.paid < total && input.customerId) {
          const partner = (
            await client.query(
              "SELECT credit_limit FROM partners WHERE id=$1",
              [input.customerId],
            )
          ).rows[0];
          const debt = (
            await client.query(
              "SELECT COALESCE((SELECT sum(balance) FROM debts WHERE partner_id=$1 AND kind='RECEIVABLE'),0)+COALESCE((SELECT sum(delta) FROM partner_adjustments WHERE partner_id=$1),0) total",
              [input.customerId],
            )
          ).rows[0].total;
          if (debt + total - input.paid > partner.credit_limit)
            throw new ConflictException(
              "Đơn làm vượt hạn mức nợ của khách hàng.",
            );
        }
        const orderCode = code("DH");
        await client.query(
          "INSERT INTO orders(id,code,customer_id,warehouse_id,lines,subtotal,discount,total,paid,payment_method,payment_status,created_by,loyalty_snapshot,loyalty_spent,loyalty_discount,note,delivery_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
          [
            orderId,
            orderCode,
            input.customerId ?? null,
            input.warehouseId,
            JSON.stringify(lines),
            subtotal,
            input.discount,
            total,
            input.paid,
            input.method,
            input.paid === total
              ? "PAID"
              : input.paid > 0
                ? "PARTIAL"
                : "UNPAID",
            user.id,
            JSON.stringify({
              settings,
              potentialPoints: amounts.potentialPoints,
            }),
            input.redeemPoints,
            loyaltyDiscount,
            input.note ?? "",
            input.deliveryStatus ?? "DELIVERED",
          ],
        );
        const loyaltyOrder = {
          id: orderId,
          customer_id: input.customerId,
          warehouse_id: input.warehouseId,
          total,
          paid: input.paid,
          loyalty_snapshot: {
            settings,
            potentialPoints: amounts.potentialPoints,
          },
          loyalty_earned: 0,
        };
        await this.loyalty.entry(
          client,
          user,
          loyaltyOrder,
          "REDEEM",
          -input.redeemPoints,
          "redeem:" + orderId,
        );
        const earnedPoints = await this.loyalty.accrue(
          client,
          user,
          loyaltyOrder,
        );
        for (const line of lines)
          for (const allocation of line.allocations) {
            await client.query(
              "INSERT INTO stock_ledger(id,lot_id,order_id,delta,balance,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                randomUUID(),
                allocation.lotId,
                orderId,
                -allocation.quantity,
                allocation.balance,
                "Xuất bán " + orderCode,
                user.id,
              ],
            );
          }
        if (input.paid > 0)
          await client.query(
            "INSERT INTO payments(id,order_id,warehouse_id,amount,direction,method,created_by) VALUES($1,$2,$3,$4,'IN',$5,$6)",
            [
              randomUUID(),
              orderId,
              input.warehouseId,
              input.paid,
              input.method,
              user.id,
            ],
          );
        if (input.paid < total)
          await client.query(
            "INSERT INTO debts(id,partner_id,warehouse_id,order_id,kind,original,balance,due_on) VALUES($1,$2,$3,$4,'RECEIVABLE',$5,$5,COALESCE($6::date,CURRENT_DATE+30))",
            [
              randomUUID(),
              input.customerId,
              input.warehouseId,
              orderId,
              total - input.paid,
              input.dueOn ?? null,
            ],
          );
        const invoiceId = randomUUID();
        await client.query(
          "INSERT INTO invoices(id,order_id,code) VALUES($1,$2,$3)",
          [invoiceId, orderId, code("PB")],
        );
        await audit(client, user.id, "SALE_CONFIRMED", orderId, {
          total,
          paid: input.paid,
        });
        return {
          id: orderId,
          code: orderCode,
          invoiceId,
          subtotal,
          discount: input.discount,
          loyalty_discount: loyaltyDiscount,
          loyalty_spent: input.redeemPoints,
          loyalty_earned: earnedPoints,
          loyalty_potential: amounts.potentialPoints,
          total,
          paid: input.paid,
          debt: total - input.paid,
          lines: sanitizeMoney(lines, user),
          payment_status:
            input.paid === total
              ? "PAID"
              : input.paid > 0
                ? "PARTIAL"
                : "UNPAID",
        };
      },
    );
  }

  async payDebt(
    user: User,
    id: string,
    amount: number,
    method: string,
    key?: string,
  ) {
    requirePermission(user, "payments.create");
    return this.once(
      user,
      key,
      "debt.pay",
      { id, amount, method },
      async (client) => {
        const initial = (
          await client.query("SELECT partner_id FROM debts WHERE id=$1", [id])
        ).rows[0];
        if (!initial) throw new NotFoundException("Không tìm thấy khoản nợ.");
        await client.query("SELECT id FROM partners WHERE id=$1 FOR UPDATE", [
          initial.partner_id,
        ]);
        const debt = (
          await client.query("SELECT * FROM debts WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (!debt) throw new NotFoundException("Không tìm thấy khoản nợ.");
        requireWarehouse(user, debt.warehouse_id);
        if (amount <= 0 || amount > debt.balance)
          throw new BadRequestException(
            "Số tiền cần lớn hơn 0 và không vượt số nợ còn lại.",
          );
        const balance = debt.balance - amount;
        await client.query("UPDATE debts SET balance=$2 WHERE id=$1", [
          id,
          balance,
        ]);
        await client.query(
          "INSERT INTO payments(id,debt_id,order_id,warehouse_id,amount,direction,method,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            randomUUID(),
            id,
            debt.order_id,
            debt.warehouse_id,
            amount,
            debt.kind === "RECEIVABLE" ? "IN" : "OUT",
            method,
            user.id,
          ],
        );
        if (debt.order_id) {
          const order = (
            await client.query(
              "UPDATE orders SET paid=paid+$2,payment_status=CASE WHEN paid+$2=total THEN 'PAID' ELSE 'PARTIAL' END WHERE id=$1 RETURNING *",
              [debt.order_id, amount],
            )
          ).rows[0];
          await this.loyalty.accrue(client, user, order);
        }
        await audit(client, user.id, "DEBT_PAID", id, {
          amount,
          balance,
          method,
        });
        return { id, balance };
      },
    );
  }

  async returnOrder(
    user: User,
    id: string,
    reason: string,
    key?: string,
    refundMethod: "CASH" | "TRANSFER" = "CASH",
  ) {
    requirePermission(user, "sales.return");
    return this.once(
      user,
      key,
      "sales.return",
      { id, reason, refundMethod },
      async (client) => {
        const initial = (
          await client.query("SELECT customer_id FROM orders WHERE id=$1", [id])
        ).rows[0];
        if (!initial) throw new NotFoundException("Không tìm thấy đơn.");
        if (initial.customer_id)
          await client.query("SELECT id FROM partners WHERE id=$1 FOR UPDATE", [
            initial.customer_id,
          ]);
        const debts = (
          await client.query(
            "SELECT * FROM debts WHERE order_id=$1 FOR UPDATE",
            [id],
          )
        ).rows;
        const order = (
          await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rows[0];
        requireWarehouse(user, order.warehouse_id);
        if (order.returned)
          throw new ConflictException("Đơn đã được trả hàng.");
        const lines: Data[] = order.lines;
        await this.locks(
          client,
          lines.map((line) => order.warehouse_id + ":" + line.productId),
        );
        for (const line of lines)
          for (const allocation of line.allocations) {
            const original = (
              await client.query("SELECT * FROM lots WHERE id=$1", [
                allocation.lotId,
              ])
            ).rows[0];
            const lotId = randomUUID();
            await client.query(
              "INSERT INTO lots(id,product_id,warehouse_id,code,expires_on,state,cost_base) VALUES($1,$2,$3,$4,$5,'QUARANTINE',$6)",
              [
                lotId,
                line.productId,
                order.warehouse_id,
                "TRA-" + randomUUID().slice(0, 12),
                original.expires_on,
                allocation.costBase,
              ],
            );
            await this.ledger(
              client,
              user,
              lotId,
              allocation.quantity,
              "Trả đơn " + order.code + ": " + reason,
              undefined,
              id,
            );
          }
        for (const debt of debts)
          await client.query("UPDATE debts SET balance=0 WHERE id=$1", [
            debt.id,
          ]);
        if (order.paid > 0)
          await client.query(
            "INSERT INTO payments(id,order_id,warehouse_id,amount,direction,method,note,created_by) VALUES($1,$2,$3,$4,'OUT',$5,$6,$7)",
            [
              randomUUID(),
              id,
              order.warehouse_id,
              order.paid,
              refundMethod,
              "Hoàn tiền: " + reason,
              user.id,
            ],
          );
        await this.loyalty.reverse(client, user, order);
        await client.query(
          "UPDATE orders SET returned=true,returned_at=now(),delivery_status='RETURNED',payment_status='REFUNDED' WHERE id=$1",
          [id],
        );
        await client.query(
          "UPDATE invoices SET status='CANCELLED' WHERE order_id=$1",
          [id],
        );
        await audit(client, user.id, "ORDER_RETURNED", id, {
          reason,
          refund: order.paid,
          refundMethod,
        });
        return { id, refund: order.paid, status: "RETURNED" };
      },
    );
  }
}
