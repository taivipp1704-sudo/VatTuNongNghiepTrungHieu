import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Notice,
  Caption,
  Denied,
  Label,
  Page,
  Panel,
  QueryState,
  Row,
  Section,
} from "@/components/ui";
import { ChipTabs, IconButton, SectionHeading } from "@/components/pos-ui";
import { AppText } from "@/components/text";
import { RevenueChart } from "@/components/revenue-chart";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { day, money, number } from "@/lib/format";
import {
  bucketLabel,
  localToday,
  periodNames,
  ReportPeriod,
  shiftPeriod,
} from "@/lib/counter";
import { DataRow } from "@/types";
import { ReportRangePicker } from "@/components/report-range";
import { ManagementReport } from "@/components/management-reports";
import { reportQuery, ReportSelection } from "@/lib/counter";
import { exportCsv, exportTablePdf } from "@/lib/export";
import { theme } from "@/theme";

export default function Reports() {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState(
    params.section === "inventory" && can("inventory.view")
      ? "inventory"
      : params.section === "finance" && can("reports.finance")
        ? "finance"
        : "sales",
  );
  const [selection, setSelection] = useState<ReportSelection>({
    period: "MONTH",
    anchor: localToday(),
  });
  if (!can("reports.view")) return <Denied />;
  return (
    <Page>
      <Label big>Báo cáo cửa hàng</Label>
      <ChipTabs
        value={section}
        onChange={setSection}
        items={[
          { value: "sales", label: "Bán hàng" },
          ...(can("inventory.view")
            ? [{ value: "inventory", label: "Kho" }]
            : []),
          ...(can("reports.finance")
            ? [{ value: "finance", label: "Tài chính" }]
            : []),
        ]}
      />
      <ReportRangePicker value={selection} onChange={setSelection} />
      {section === "sales" ? (
        <SalesReport selection={selection} />
      ) : (
        <ManagementReport
          section={section as "inventory" | "finance"}
          selection={selection}
        />
      )}
    </Page>
  );
}

function SalesReport({ selection }: { selection: ReportSelection }) {
  const period = selection.period;
  const [metric, setMetric] = useState("revenue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useApi<DataRow>(
    "/reports?" + reportQuery(selection),
    can("reports.view"),
  );
  if (!can("reports.view")) return <Denied />;
  const data = query.data;
  const title = data
    ? day(data.range.start) + " – " + day(data.range.through)
    : "Đang tải kỳ báo cáo";
  const chartPeriod = data?.range.bucket === "month" ? "YEAR" : period;
  const exportData = async (pdf: boolean) => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const headers = [
        "Mốc",
        "Đơn bán",
        "Doanh số",
        "Trả hàng",
        "Doanh thu thuần",
        "Thực thu",
      ];
      const rows = data.series.map((item: DataRow) => [
        bucketLabel(item.bucket, chartPeriod),
        item.orders,
        item.gross,
        item.returned,
        item.revenue,
        item.collected,
      ]);
      if (pdf) await exportTablePdf("Doanh thu " + title, headers, rows);
      else
        await exportCsv(
          "agristock-doanh-thu-" + data.range.start,
          headers,
          rows,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được báo cáo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <QueryState query={query}>
      {data ? <Caption>{title}</Caption> : null}
      {data ? (
        <>
          <View
            style={{
              backgroundColor: theme.colors.hero,
              borderRadius: theme.radius.lg,
              padding: 20,
              gap: 10,
            }}
          >
            <AppText style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}>
              DOANH THU THUẦN
            </AppText>
            <AppText
              variant="amount"
              style={{
                color: theme.colors.onPrimary,
                fontSize: 29,
                lineHeight: 40,
                fontWeight: "700",
              }}
            >
              {money(data.totals.revenue)}
            </AppText>
            <AppText
              style={{
                color: theme.colors.onHeroMuted,
                fontSize: 12,
                lineHeight: 19,
              }}
            >
              Doanh số {money(data.totals.gross)} − trả hàng{" "}
              {money(data.totals.returned)}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Panel tone="info">
                <Caption>Tiền thực thu</Caption>
                <Label numeric tone="info">
                  {money(data.totals.collected)}
                </Label>
                <Caption>Thu tiền − hoàn tiền trong kỳ</Caption>
              </Panel>
            </View>
            <View style={{ flex: 1 }}>
              <Panel tone="warning">
                <Caption>Chưa thanh toán</Caption>
                <Label numeric tone="warning">
                  {money(data.totals.outstanding)}
                </Label>
                <Caption>Còn nợ trên đơn lập trong kỳ</Caption>
              </Panel>
            </View>
          </View>
          <Panel>
            <Row>
              <Caption>{number(data.totals.orders)} đơn bán</Caption>
              <Caption>{number(data.totals.returns)} đơn trả</Caption>
            </Row>
            <Row>
              <Caption>
                Đang giao dịch: {number(data.totals.in_progress)}
              </Caption>
              <Caption>Hoàn thành: {number(data.totals.completed)}</Caption>
            </Row>
            {can("reports.profit") && data.grossProfit !== undefined ? (
              <Row>
                <Caption>Lãi gộp sau giảm giá và trả hàng</Caption>
                <Label
                  numeric
                  tone={data.grossProfit < 0 ? "danger" : "success"}
                >
                  {money(data.grossProfit)}
                </Label>
              </Row>
            ) : null}
            {can("reports.profit") && data.grossProfit !== undefined ? (
              <Row>
                <Caption>Giá vốn hàng đã bán sau trả hàng</Caption>
                <Label numeric>
                  {money(data.totals.revenue - data.grossProfit)}
                </Label>
              </Row>
            ) : null}
          </Panel>
          {can("reports.profit") && data.grossMargin !== undefined ? (
            <Caption>
              Biên lãi gộp:{" "}
              {data.grossMargin === null
                ? "Không tính khi doanh thu bằng 0"
                : number(data.grossMargin) + "%"}
              . Giá vốn theo lô thực tế đã xuất.
            </Caption>
          ) : null}
          <Panel>
            <Label big>
              Biểu đồ{" "}
              {(
                periodNames[period as keyof typeof periodNames] || "tùy chỉnh"
              ).toLowerCase()}
            </Label>
            <ChipTabs
              items={[
                { value: "revenue", label: "Doanh thu" },
                { value: "collected", label: "Thực thu" },
              ]}
              value={metric}
              onChange={setMetric}
            />
            <RevenueChart
              points={data.series}
              metric={metric as "revenue" | "collected"}
              period={chartPeriod}
            />
            <Caption>
              Doanh thu ghi ngày bán, trả hàng ghi ngày trả. Thực thu ghi ngày
              nhận hoặc hoàn tiền; có thể gồm thu nợ đơn cũ.
            </Caption>
          </Panel>
          <Section title="Chi tiết theo mốc">
            {data.series.filter(
              (item: DataRow) => item.gross || item.returned || item.collected,
            ).length ? (
              data.series
                .filter(
                  (item: DataRow) =>
                    item.gross || item.returned || item.collected,
                )
                .map((item: DataRow) => (
                  <Panel key={item.bucket}>
                    <Row>
                      <Label>{bucketLabel(item.bucket, chartPeriod)}</Label>
                      <Label>{money(item.revenue)}</Label>
                    </Row>
                    <Caption>
                      {item.orders} đơn · Thực thu {money(item.collected)} · Trả{" "}
                      {money(item.returned)}
                    </Caption>
                  </Panel>
                ))
            ) : (
              <Caption>Chưa có giao dịch trong kỳ này.</Caption>
            )}
          </Section>
          <Section title="Mặt hàng theo doanh thu thuần">
            {data.top.length ? (
              data.top.map((item: DataRow) => (
                <Panel key={item.id || item.name}>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Label>{item.name}</Label>
                      <Caption>
                        {number(item.quantity)} đơn vị cơ sở sau trả hàng
                      </Caption>
                    </View>
                    <Label>{money(item.revenue)}</Label>
                  </Row>
                </Panel>
              ))
            ) : (
              <Caption>Chưa có mặt hàng trong kỳ.</Caption>
            )}
          </Section>
          <Notice error>{error}</Notice>
          <Button
            title="Xuất báo cáo Excel (CSV)"
            secondary
            pending={busy}
            onPress={() => void exportData(false)}
          />
          <Button
            title="Xuất báo cáo PDF"
            secondary
            pending={busy}
            onPress={() => void exportData(true)}
          />
        </>
      ) : null}
    </QueryState>
  );
}
