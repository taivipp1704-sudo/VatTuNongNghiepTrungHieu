import { useState } from "react";
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
import { exportCsv, exportTablePdf } from "@/lib/export";
import { theme } from "@/theme";

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("MONTH");
  const [anchor, setAnchor] = useState(localToday());
  const [metric, setMetric] = useState("revenue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useApi<DataRow>(
    "/reports?period=" + period + "&anchor=" + anchor,
    can("reports.view"),
  );
  if (!can("reports.view")) return <Denied />;
  const data = query.data;
  const title = data
    ? day(data.range.start) + " – " + day(data.range.through)
    : "Đang tải kỳ báo cáo";
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
        bucketLabel(item.bucket, period),
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
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={{ gap: 6 }}>
        <SectionHeading
          title="Doanh thu cửa hàng"
          action="Hiện tại"
          onPress={() => setAnchor(localToday())}
        />
        <Caption>Theo ngày, tuần, tháng, quý hoặc năm · giờ Việt Nam</Caption>
      </View>
      <ChipTabs
        compact
        items={Object.entries(periodNames).map(([value, label]) => ({
          value,
          label,
        }))}
        value={period}
        onChange={(v) => setPeriod(v as ReportPeriod)}
      />
      <Panel>
        <Row>
          <IconButton
            name="chevron-left"
            label="Kỳ báo cáo trước"
            onPress={() => setAnchor(shiftPeriod(anchor, period, -1))}
          />
          <View style={{ flex: 1, alignItems: "center" }}>
            <AppText style={{ fontWeight: "600", textAlign: "center" }}>
              {title}
            </AppText>
          </View>
          <IconButton
            name="chevron-right"
            label="Kỳ báo cáo tiếp theo"
            onPress={() => setAnchor(shiftPeriod(anchor, period, 1))}
          />
        </Row>
      </Panel>
      <QueryState query={query}>
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
              <AppText
                style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}
              >
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
                  <Label>{money(data.totals.revenue - data.grossProfit)}</Label>
                </Row>
              ) : null}
            </Panel>
            <Panel>
              <Label big>Biểu đồ {periodNames[period].toLowerCase()}</Label>
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
                period={period}
              />
              <Caption>
                Doanh thu ghi ngày bán, trả hàng ghi ngày trả. Thực thu ghi ngày
                nhận hoặc hoàn tiền; có thể gồm thu nợ đơn cũ.
              </Caption>
            </Panel>
            <Section title="Chi tiết theo mốc">
              {data.series.filter(
                (item: DataRow) =>
                  item.gross || item.returned || item.collected,
              ).length ? (
                data.series
                  .filter(
                    (item: DataRow) =>
                      item.gross || item.returned || item.collected,
                  )
                  .map((item: DataRow) => (
                    <Panel key={item.bucket}>
                      <Row>
                        <Label>{bucketLabel(item.bucket, period)}</Label>
                        <Label>{money(item.revenue)}</Label>
                      </Row>
                      <Caption>
                        {item.orders} đơn · Thực thu {money(item.collected)} ·
                        Trả {money(item.returned)}
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
    </Page>
  );
}
