import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { Database } from "./db";
import { listPrice } from "./pricing";
import { User, requirePermission, requireWarehouse } from "./auth";
import { loyaltySettingsSchema, loyaltyQuoteSchema } from "./validation";

export type LoyaltySettings = z.infer<typeof loyaltySettingsSchema>;
export const defaultLoyaltySettings: LoyaltySettings = {
  enabled: false,
  pointValue: 1000,
  earningTiming: "FULL_PAYMENT",
  earningBase: "AFTER_DISCOUNT",
  rounding: "FLOOR",
  redeemEnabled: false,
  minRedeemPoints: 1,
  maxRedeemPercent: 50,
  reverseEarnOnReturn: true,
  refundSpentOnReturn: true,
  tiersEnabled: true,
  tiers: [
    { name: "Thành viên", minimumPoints: 0 },
    { name: "Bạc", minimumPoints: 1000 },
    { name: "Vàng", minimumPoints: 5000 },
    { name: "Kim cương", minimumPoints: 15000 },
  ],
};
type Line = { total: number; loyaltyRate: number };
type Order = Record<string, any>;
const rounded = (
  numerator: bigint,
  denominator: bigint,
  mode: boolean | string,
) =>
  Number(
    (numerator +
      (mode === "CEIL"
        ? denominator - 1n
        : mode === true || mode === "NEAREST"
          ? denominator / 2n
          : 0n)) /
      denominator,
  );

export function loyaltyAmounts(
  lines: Line[],
  subtotal: number,
  discount: number,
  points: number,
  settings: LoyaltySettings,
  balance: number,
  hasCustomer: boolean,
) {
  const beforePoints = subtotal - discount;
  if (
    !Number.isSafeInteger(subtotal) ||
    !Number.isSafeInteger(beforePoints) ||
    subtotal <= 0 ||
    beforePoints <= 0 ||
    beforePoints > 1_000_000_000_000
  )
    throw new BadRequestException("Tổng tiền hoặc chiết khấu không hợp lệ.");
  let loyaltyDiscount = 0;
  if (points > 0) {
    if (!settings.enabled || !settings.redeemEnabled || !hasCustomer)
      throw new BadRequestException(
        "Cần chọn khách hàng và bật đổi điểm để sử dụng điểm.",
      );
    if (points < settings.minRedeemPoints || points > Math.max(balance, 0))
      throw new ConflictException(
        "Số điểm đổi chưa đạt mức tối thiểu hoặc vượt số dư. Tải lại điểm khách hàng.",
      );
    loyaltyDiscount = points * settings.pointValue;
    const maxDiscount = Number(
      (BigInt(beforePoints) *
        BigInt(Math.round(settings.maxRedeemPercent * 10000))) /
        1_000_000n,
    );
    if (!Number.isSafeInteger(loyaltyDiscount) || loyaltyDiscount > maxDiscount)
      throw new BadRequestException(
        "Giá trị đổi điểm vượt giới hạn giảm tiền của đơn này.",
      );
  }
  const total = beforePoints - loyaltyDiscount;
  let potentialPoints = 0;
  if (settings.enabled && hasCustomer) {
    const basis =
      settings.earningBase === "BEFORE_DISCOUNT"
        ? subtotal - loyaltyDiscount
        : total;
    const weighted = lines.reduce(
      (sum, line) =>
        sum + BigInt(line.total) * BigInt(Math.round(line.loyaltyRate * 10000)),
      0n,
    );
    potentialPoints = rounded(
      weighted * BigInt(basis),
      BigInt(subtotal) * 1_000_000n * BigInt(settings.pointValue),
      settings.rounding,
    );
  }
  return {
    subtotal,
    discount,
    total,
    loyaltyDiscount,
    redeemPoints: points,
    potentialPoints,
    availablePoints: balance,
  };
}

@Injectable()
export class Loyalty {
  constructor(private readonly db: Database) {}

  async settings(
    client: Pool | PoolClient = this.db.pool,
  ): Promise<LoyaltySettings> {
    const row = (
      await client.query("SELECT value FROM settings WHERE key='loyalty'")
    ).rows[0];
    return row
      ? loyaltySettingsSchema.parse(row.value)
      : { ...defaultLoyaltySettings };
  }

  async balance(client: Pool | PoolClient, customerId?: string) {
    if (!customerId) return 0;
    return (
      (
        await client.query(
          "SELECT balance FROM loyalty_accounts WHERE customer_id=$1",
          [customerId],
        )
      ).rows[0]?.balance ?? 0
    );
  }

  async quote(user: User, input: z.infer<typeof loyaltyQuoteSchema>) {
    requirePermission(user, "sales.create");
    if (input.priceBook === "WHOLESALE")
      requirePermission(user, "sales.wholesale");
    requireWarehouse(user, input.warehouseId);
    if (input.discount > 0) requirePermission(user, "sales.discount");
    if (input.redeemPoints > 0) requirePermission(user, "loyalty.redeem");
    if (
      input.customerId &&
      !(
        await this.db.pool.query(
          "SELECT id FROM partners WHERE id=$1 AND kind='CUSTOMER' AND profile->>'active' IS DISTINCT FROM 'false'",
          [input.customerId],
        )
      ).rowCount
    )
      throw new NotFoundException("Không tìm thấy khách hàng.");
    const lines: Line[] = [];
    let subtotal = 0;
    for (const item of input.lines) {
      const product = (
        await this.db.pool.query(
          "SELECT * FROM products WHERE id=$1 AND active",
          [item.productId],
        )
      ).rows[0];
      if (!product) throw new NotFoundException("Không tìm thấy hàng hóa.");
      const defaultPrice = listPrice(product, item.unit, input.priceBook);
      const unitPrice = item.unitPrice ?? defaultPrice;
      if (unitPrice !== defaultPrice)
        requirePermission(user, "sales.price.edit");
      const total = Math.round(item.quantity * unitPrice);
      subtotal += total;
      lines.push({ total, loyaltyRate: product.loyalty_rate });
    }
    const settings = await this.settings();
    const balance = await this.balance(this.db.pool, input.customerId);
    return {
      ...loyaltyAmounts(
        lines,
        subtotal,
        input.discount,
        input.redeemPoints,
        settings,
        balance,
        Boolean(input.customerId),
      ),
      settings,
    };
  }

  // Callers lock the partner before any order/debt/stock rows, including returns.
  async entry(
    client: PoolClient,
    user: User,
    order: Order,
    kind: string,
    delta: number,
    sourceKey: string,
  ) {
    if (!delta || !order.customer_id) return;
    await client.query(
      "INSERT INTO loyalty_accounts(customer_id) VALUES($1) ON CONFLICT DO NOTHING",
      [order.customer_id],
    );
    const row = (
      await client.query(
        "SELECT balance FROM loyalty_accounts WHERE customer_id=$1 FOR UPDATE",
        [order.customer_id],
      )
    ).rows[0];
    const balance = row.balance + delta;
    if (!Number.isSafeInteger(balance))
      throw new BadRequestException("Số dư điểm vượt giới hạn cho phép.");
    await client.query(
      "UPDATE loyalty_accounts SET balance=$2 WHERE customer_id=$1",
      [order.customer_id, balance],
    );
    await client.query(
      "INSERT INTO loyalty_ledger(id,customer_id,order_id,warehouse_id,delta,balance,kind,source_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        randomUUID(),
        order.customer_id,
        order.id,
        order.warehouse_id,
        delta,
        balance,
        kind,
        sourceKey,
        user.id,
      ],
    );
  }

  async accrue(client: PoolClient, user: User, order: Order) {
    const snapshot = order.loyalty_snapshot;
    if (!order.customer_id || !snapshot?.settings?.enabled || order.returned)
      return 0;
    const settings: LoyaltySettings = snapshot.settings;
    const potential = snapshot.potentialPoints || 0;
    const target =
      settings.earningTiming === "ORDER" || order.paid === order.total
        ? potential
        : settings.earningTiming === "PROPORTIONAL" && order.total > 0
          ? rounded(
              BigInt(potential) * BigInt(order.paid),
              BigInt(order.total),
              false,
            )
          : 0;
    const delta = target - (order.loyalty_earned || 0);
    if (delta <= 0) return 0;
    await this.entry(
      client,
      user,
      order,
      "EARN",
      delta,
      "earn:" + order.id + ":" + target,
    );
    await client.query("UPDATE orders SET loyalty_earned=$2 WHERE id=$1", [
      order.id,
      target,
    ]);
    return delta;
  }

  async reverse(client: PoolClient, user: User, order: Order) {
    // A spent earning can make the balance negative; future earnings offset it.
    // This permits a valid return without allowing points to be earned twice.
    if (order.loyalty_snapshot?.settings?.reverseEarnOnReturn !== false)
      await this.entry(
        client,
        user,
        order,
        "RETURN_EARN",
        -order.loyalty_earned,
        "return-earn:" + order.id,
      );
    if (order.loyalty_snapshot?.settings?.refundSpentOnReturn !== false)
      await this.entry(
        client,
        user,
        order,
        "RETURN_REDEEM",
        order.loyalty_spent,
        "return-redeem:" + order.id,
      );
  }
}
