export function parseRate(value: string): number | undefined {
  const input = value.trim();
  if (!/^\d+(?:[.,]\d{0,4})?$/.test(input)) return;
  const rate = Number(input.replace(",", "."));
  if (rate < 0 || rate > 100 || !Number.isFinite(rate)) return;
  return rate;
}
export const rateLabel = (value = 0) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value) +
  "%";

export function productPoints(
  price: number,
  rate: number,
  settings?: import("@/types").LoyaltySettings,
) {
  if (!settings?.enabled || !Number.isSafeInteger(price) || price < 0) return 0;
  const denominator = 1_000_000n * BigInt(settings.pointValue),
    numerator = BigInt(price) * BigInt(Math.round(rate * 10000));
  return Number(
    (numerator +
      (settings.rounding === "CEIL"
        ? denominator - 1n
        : settings.rounding === "NEAREST"
          ? denominator / 2n
          : 0n)) /
      denominator,
  );
}
export function memberTier(
  customer: import("@/types").Partner,
  settings?: import("@/types").LoyaltySettings,
) {
  if (!settings?.tiersEnabled) return "Thành viên";
  return (
    [...settings.tiers]
      .reverse()
      .find((tier) => (customer.lifetime_earned || 0) >= tier.minimumPoints)
      ?.name || "Thành viên"
  );
}
