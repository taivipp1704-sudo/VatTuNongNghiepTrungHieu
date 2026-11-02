export type CalendarPeriod = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export type ReportPeriod =
  | CalendarPeriod
  | "ROLLING_7"
  | "ROLLING_30"
  | "CUSTOM";
export type ReportSelection = {
  period: ReportPeriod;
  anchor: string;
  from?: string;
  through?: string;
};
export const periodNames: Record<CalendarPeriod, string> = {
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
  if (["DAY", "WEEK", "ROLLING_7", "ROLLING_30"].includes(period))
    date.setUTCDate(
      date.getUTCDate() +
        direction *
          (["WEEK", "ROLLING_7"].includes(period)
            ? 7
            : period === "ROLLING_30"
              ? 30
              : 1),
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
export function reportQuery(value: ReportSelection) {
  return Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v!))
    .join("&");
}
export function validCalendarDay(value: string) {
  const d = new Date(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01" &&
    value <= "2100-12-31"
  );
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
