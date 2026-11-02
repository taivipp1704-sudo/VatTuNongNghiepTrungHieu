import { BadRequestException, Injectable } from "@nestjs/common";
import { Database } from "./db";
import { User, requirePermission } from "./auth";
import { has } from "./operations";

export type ReportPeriod =
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "QUARTER"
  | "YEAR"
  | "ROLLING_7"
  | "ROLLING_30"
  | "CUSTOM";
const dayMs = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function reportRange(
  period?: ReportPeriod,
  anchor?: string,
  from?: string,
  through?: string,
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date((anchor || today) + "T00:00:00Z");
  if (
    Number.isNaN(date.getTime()) ||
    iso(date) !== (anchor || today) ||
    date.getUTCFullYear() < 2000 ||
    date.getUTCFullYear() > 2100
  )
    throw new BadRequestException(
      "Ngày báo cáo phải hợp lệ và nằm trong năm 2000–2100.",
    );
  let start = new Date(date),
    end = new Date(date),
    bucket = "day";
  if (period === "CUSTOM") {
    const valid = (value?: string) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const d = new Date(value + "T00:00:00Z");
      return (
        Number.isFinite(d.getTime()) &&
        iso(d) === value &&
        d.getUTCFullYear() >= 2000 &&
        d.getUTCFullYear() <= 2100
      );
    };
    if (!valid(from) || !valid(through))
      throw new BadRequestException(
        "Nhập ngày bắt đầu/kết thúc hợp lệ (YYYY-MM-DD).",
      );
    start = new Date(from! + "T00:00:00Z");
    end = new Date(new Date(through! + "T00:00:00Z").getTime() + dayMs);
    const days = (end.getTime() - start.getTime()) / dayMs;
    if (days < 1 || days > 366)
      throw new BadRequestException("Khoảng báo cáo từ 1 đến 366 ngày.");
    bucket = days > 92 ? "month" : "day";
  } else if (!period || period === "ROLLING_30" || period === "ROLLING_7") {
    start = new Date(
      date.getTime() - (period === "ROLLING_7" ? 6 : 29) * dayMs,
    );
    end = new Date(date.getTime() + dayMs);
  } else if (period === "DAY") {
    end = new Date(date.getTime() + dayMs);
    bucket = "hour";
  } else if (period === "WEEK") {
    start = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * dayMs);
    end = new Date(start.getTime() + 7 * dayMs);
  } else if (period === "MONTH") {
    start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  } else if (period === "QUARTER") {
    const month = Math.floor(date.getUTCMonth() / 3) * 3;
    start = new Date(Date.UTC(date.getUTCFullYear(), month, 1));
    end = new Date(Date.UTC(date.getUTCFullYear(), month + 3, 1));
    bucket = "month";
  } else {
    start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
    bucket = "month";
  }
  return {
    period: period || "ROLLING_30",
    anchor: iso(date),
    start: iso(start),
    end: iso(end),
    through: iso(new Date(end.getTime() - dayMs)),
    bucket,
  };
}

@Injectable()
export class Reports {
  constructor(private readonly db: Database) {}

  async financialSeries(
    scope: string[] | null,
    range: ReturnType<typeof reportRange>,
    own: string | null = null,
  ) {
    return (
      await this.db.pool.query(
        `
      WITH bounds AS (
        SELECT $1::date::timestamp lo, $2::date::timestamp hi
      ), scoped AS (
        SELECT o.*,COALESCE((SELECT sum((a->>'quantity')::numeric*(a->>'costBase')::numeric)
          FROM jsonb_array_elements(o.lines) l CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l->'allocations','[]')) a),0) cost
        FROM orders o WHERE ($3::uuid[] IS NULL OR o.warehouse_id=ANY($3)) AND ($4::uuid IS NULL OR o.created_by=$4)
      ), events AS (
        SELECT date_trunc($5,created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') t,total revenue,total gross,0::numeric returned,0::numeric collected,cost,1 orders,0 returns
          FROM scoped,bounds WHERE created_at>=lo AT TIME ZONE 'Asia/Ho_Chi_Minh' AND created_at<hi AT TIME ZONE 'Asia/Ho_Chi_Minh'
        UNION ALL
        SELECT date_trunc($5,returned_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),-total,0,total,0,-cost,0,1
          FROM scoped,bounds WHERE returned AND returned_at>=lo AT TIME ZONE 'Asia/Ho_Chi_Minh' AND returned_at<hi AT TIME ZONE 'Asia/Ho_Chi_Minh'
        UNION ALL
        SELECT date_trunc($5,p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),0,0,0,CASE WHEN p.direction='IN' THEN p.amount ELSE -p.amount END,0,0,0
          FROM payments p JOIN scoped o ON o.id=p.order_id CROSS JOIN bounds
          WHERE p.created_at>=lo AT TIME ZONE 'Asia/Ho_Chi_Minh' AND p.created_at<hi AT TIME ZONE 'Asia/Ho_Chi_Minh'
      ), bins AS (
        SELECT generate_series(date_trunc($5,lo),hi-interval '1 second',('1 '||$5)::interval) t FROM bounds
      ) SELECT to_char(b.t,'YYYY-MM-DD"T"HH24:MI:SS') bucket,
        COALESCE(sum(e.revenue),0)::numeric revenue,COALESCE(sum(e.gross),0)::numeric gross,
        COALESCE(sum(e.returned),0)::numeric returned,COALESCE(sum(e.collected),0)::numeric collected,
        COALESCE(sum(e.cost),0)::numeric cost,COALESCE(sum(e.orders),0)::int orders,COALESCE(sum(e.returns),0)::int returns
      FROM bins b LEFT JOIN events e ON e.t=b.t GROUP BY b.t ORDER BY b.t`,
        [range.start, range.end, scope, own, range.bucket],
      )
    ).rows;
  }

  async build(
    user: User,
    scope: string[] | null,
    period?: ReportPeriod,
    anchor?: string,
    from?: string,
    through?: string,
  ) {
    requirePermission(user, "reports.view");
    const range = reportRange(period, anchor, from, through);
    const [rows, topResult, statusResult] = await Promise.all([
      this.financialSeries(scope, range),
      this.db.pool.query(
        `WITH selected AS (
        SELECT o.*,1 sign FROM orders o WHERE o.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND o.created_at < ($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND ($3::uuid[] IS NULL OR o.warehouse_id=ANY($3))
        UNION ALL
        SELECT o.*,-1 sign FROM orders o WHERE o.returned AND o.returned_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND o.returned_at < ($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND ($3::uuid[] IS NULL OR o.warehouse_id=ANY($3))
      ) SELECT l->>'productId' id,l->>'name' name,round(sum(sign*(l->>'total')::numeric*total/NULLIF(subtotal,0)))::numeric revenue,
        sum(sign*(l->>'quantity')::numeric)::numeric quantity
        FROM selected CROSS JOIN LATERAL jsonb_array_elements(lines) l GROUP BY l->>'productId',l->>'name' ORDER BY revenue DESC NULLS LAST LIMIT 10`,
        [range.start, range.end, scope],
      ),
      this.db.pool.query(
        `SELECT count(*) FILTER(WHERE NOT returned AND paid<total)::int in_progress,
        count(*) FILTER(WHERE NOT returned AND paid=total)::int completed,
        COALESCE(sum(total-paid) FILTER(WHERE NOT returned),0)::numeric outstanding
        FROM orders WHERE created_at>=($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND created_at<($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND ($3::uuid[] IS NULL OR warehouse_id=ANY($3))`,
        [range.start, range.end, scope],
      ),
    ]);
    const totals = rows.reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        gross: sum.gross + row.gross,
        returned: sum.returned + row.returned,
        collected: sum.collected + row.collected,
        orders: sum.orders + row.orders,
        returns: sum.returns + row.returns,
        cost: sum.cost + row.cost,
      }),
      {
        revenue: 0,
        gross: 0,
        returned: 0,
        collected: 0,
        orders: 0,
        returns: 0,
        cost: 0,
      },
    );
    const { cost, ...publicTotals } = totals;
    return {
      range,
      totals: { ...publicTotals, ...statusResult.rows[0] },
      series: rows.map(({ cost: _cost, ...row }) => row),
      daily: rows.map(({ cost: _cost, ...row }) => ({
        ...row,
        day: row.bucket.slice(0, 10),
      })),
      top: topResult.rows.map((row) => ({ ...row, revenue: row.revenue ?? 0 })),
      ...(has(user, "reports.profit")
        ? {
            grossProfit: totals.revenue - cost,
            cost,
            grossMargin: totals.revenue
              ? ((totals.revenue - cost) / totals.revenue) * 100
              : null,
          }
        : {}),
    };
  }
}
