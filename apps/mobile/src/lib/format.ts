export const money = (value: number = 0) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) +
  " ₫";
export const number = (value: number = 0) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
export const day = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? value + "T00:00:00+07:00" : value,
      ).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "Không áp dụng";
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
export function daysUntil(value: string | null) {
  if (!value) return Infinity;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return Math.round(
    (Date.parse(value + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
}
