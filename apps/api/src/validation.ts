import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export const uuid = z.uuid();
export const text = z.string().trim().min(1).max(200);
export const amount = z.number().int().min(0).max(1_000_000_000_000);
export const quantity = z
  .number()
  .positive()
  .max(1_000_000)
  .refine(
    (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001,
    "Tối đa 3 chữ số thập phân.",
  );
export const date = z.iso.date();
export const password = z
  .string()
  .min(12, "Mật khẩu cần ít nhất 12 ký tự.")
  .max(128);

export function parse<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues
        .map((issue) => issue.path.join(".") + ": " + issue.message)
        .join("; "),
    );
  return result.data;
}

export const loyaltyRate = z
  .number()
  .min(0)
  .max(100)
  .refine(
    (value) => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001,
    "Tỷ lệ tích điểm có tối đa 4 chữ số thập phân.",
  );
export const productDetailsSchema = z
  .object({
    wholesaleBase: amount.nullable().optional(),
    wholesalePack: amount.nullable().optional(),
    weightGrams: z.number().min(0).max(100000000).default(0),
    dimensions: z.string().trim().max(100).default(""),
    sellable: z.boolean().default(true),
  })
  .strict();
export const partnerProfileSchema = z
  .object({
    code: z.string().trim().max(40).default(""),
    email: z.union([z.email(), z.literal("")]).default(""),
    group: z.string().trim().max(80).default("Bán lẻ"),
    birthday: date.nullable().default(null),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
    discountPercent: loyaltyRate.default(0),
    priceBook: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
    assignedStaff: z.string().trim().max(120).default(""),
    active: z.boolean().default(true),
    addresses: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(80),
            address: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    contacts: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            phone: z.string().trim().max(30),
            email: z.union([z.email(), z.literal("")]).default(""),
          })
          .strict(),
      )
      .max(10)
      .default([]),
  })
  .strict();
export const productSchema = z
  .object({
    sku: text,
    barcode: z.string().trim().max(100).optional(),
    name: text,
    category: text,
    baseUnit: text,
    packUnit: text,
    packFactor: quantity,
    priceBase: amount,
    pricePack: amount,
    costBase: amount,
    minStock: z.number().min(0).max(1_000_000),
    trackLots: z.boolean(),
    technicalInfo: z.string().max(3000).default(""),
    details: productDetailsSchema.optional(),
    loyaltyRate: loyaltyRate.optional(),
    imageUrl: z
      .string()
      .max(2000)
      .refine((value) => {
        if (
          !value ||
          /^\/api\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            value,
          )
        )
          return true;
        try {
          const url = new URL(value);
          return (
            ["https:", "http:"].includes(url.protocol) &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      }, "Ảnh cần URL HTTP/HTTPS không chứa thông tin đăng nhập.")
      .optional(),
  })
  .strict();
export const partnerSchema = z
  .object({
    name: text,
    kind: z.enum(["CUSTOMER", "SUPPLIER"]),
    phone: z.string().max(30).default(""),
    address: z.string().max(300).default(""),
    taxCode: z.string().max(30).default(""),
    creditLimit: amount.default(0),
    profile: partnerProfileSchema.optional(),
  })
  .strict();
export const stockLineSchema = z.object({
  productId: uuid,
  lotId: uuid.optional(),
  lotCode: z.string().trim().max(100).optional(),
  quantity: z.number().min(0).max(1_000_000),
  unit: z.enum(["BASE", "PACK"]).default("BASE"),
  expiresOn: date.optional(),
  costBase: amount.optional(),
  location: z.string().max(100).default(""),
});
export const documentSchema = z
  .object({
    kind: z.enum([
      "RECEIPT",
      "ISSUE",
      "COUNT",
      "RETURN",
      "TRANSFER",
      "DISPOSAL",
    ]),
    warehouseId: uuid,
    destinationId: uuid.optional(),
    partnerId: uuid.optional(),
    lines: z.array(stockLineSchema).min(1).max(100),
    reason: z.string().trim().min(3).max(500),
    status: z.enum(["DRAFT", "PENDING"]).default("PENDING"),
  })
  .strict();
export const saleSchema = z
  .object({
    warehouseId: uuid,
    customerId: uuid.optional(),
    priceBook: z.enum(["RETAIL", "WHOLESALE"]).optional(),
    lines: z
      .array(
        z
          .object({
            productId: uuid,
            quantity,
            unit: z.enum(["BASE", "PACK"]),
            unitPrice: amount.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    discount: amount.default(0),
    paid: amount,
    method: z.enum(["CASH", "TRANSFER", "CREDIT"]),
    dueOn: date.optional(),
    redeemPoints: amount.default(0),
    expectedTotal: amount.optional(),
    note: z.string().trim().max(500).optional(),
    deliveryStatus: z
      .enum(["PENDING_PACK", "PENDING_HANDOVER", "SHIPPING", "DELIVERED"])
      .optional(),
  })
  .strict();
export const loyaltySettingsSchema = z
  .object({
    enabled: z.boolean(),
    pointValue: amount.min(1).max(1_000_000_000),
    earningTiming: z.enum(["ORDER", "FULL_PAYMENT", "PROPORTIONAL"]),
    earningBase: z.enum(["AFTER_DISCOUNT", "BEFORE_DISCOUNT"]),
    rounding: z.enum(["FLOOR", "NEAREST", "CEIL"]),
    redeemEnabled: z.boolean(),
    minRedeemPoints: amount,
    maxRedeemPercent: loyaltyRate,
    reverseEarnOnReturn: z.boolean().default(true),
    refundSpentOnReturn: z.boolean().default(true),
    tiersEnabled: z.boolean().default(true),
    tiers: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(30),
            minimumPoints: amount,
          })
          .strict(),
      )
      .min(1)
      .max(6)
      .default([
        { name: "Thành viên", minimumPoints: 0 },
        { name: "Bạc", minimumPoints: 1000 },
        { name: "Vàng", minimumPoints: 5000 },
        { name: "Kim cương", minimumPoints: 15000 },
      ]),
  })
  .strict()
  .refine(
    (value) =>
      value.tiers[0].minimumPoints === 0 &&
      value.tiers.every(
        (tier, index) =>
          index === 0 ||
          tier.minimumPoints > value.tiers[index - 1].minimumPoints,
      ) &&
      new Set(value.tiers.map((tier) => tier.name)).size === value.tiers.length,
    "Hạng đầu cần mốc 0, các mốc tăng dần và tên không trùng.",
  );
export const loyaltyQuoteSchema = saleSchema.omit({
  paid: true,
  method: true,
  dueOn: true,
  expectedTotal: true,
  note: true,
  deliveryStatus: true,
});
