export type ReportPeriod = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export const periodNames: Record<ReportPeriod, string> = {
  DAY: "Ngày",
  WEEK: "Tuần",
  MONTH: "Tháng",
  QUARTER: "Quý",
  YEAR: "Năm",
};
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function shiftPeriod(
  anchor: string,
  period: ReportPeriod,
  direction: number,
) {
  const date = new Date(anchor + "T00:00:00Z");
  if (period === "DAY" || period === "WEEK")
    date.setUTCDate(
      date.getUTCDate() + direction * (period === "WEEK" ? 7 : 1),
    );
  else if (period === "YEAR") {
    date.setUTCMonth(0, 1);
    date.setUTCFullYear(date.getUTCFullYear() + direction);
  } else {
    date.setUTCDate(1);
    date.setUTCMonth(
      date.getUTCMonth() + direction * (period === "QUARTER" ? 3 : 1),
    );
  }
  return date.toISOString().slice(0, 10);
}
export function counterStatus(order: {
  returned?: boolean;
  paid: number;
  total: number;
}) {
  return order.returned
    ? "Đã trả hàng"
    : order.paid >= order.total
      ? "Hoàn thành"
      : "Đang giao dịch";
}
export function bucketLabel(bucket: string, period: string) {
  return period === "DAY"
    ? bucket.slice(11, 13) + "h"
    : ["YEAR", "QUARTER"].includes(period)
      ? "Tháng " + Number(bucket.slice(5, 7))
      : Number(bucket.slice(8, 10)) + "/" + Number(bucket.slice(5, 7));
}
