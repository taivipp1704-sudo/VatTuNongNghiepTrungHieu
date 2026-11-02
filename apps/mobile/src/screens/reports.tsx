import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
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
import { StoreRow } from "@/components/store-ui";
import { Icon } from "@/components/pos-ui";
import { Bootstrap } from "@/types";
import { useWarehouse } from "@/lib/warehouse";
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
    period: "DAY",
    anchor: localToday(),
  });
  const [rangeOpen, setRangeOpen] = useState(false);
  const bootstrap = useApi<Bootstrap>("/bootstrap"),
    warehouseId = useWarehouse((v) => v.warehouseId);
  const warehouseName =
    bootstrap.data?.warehouses.find((w) => w.id === warehouseId)?.name ||
    "Kho đang chọn";
  if (!can("reports.view")) return <Denied />;
  const entries = [
    { value: "sales", label: "BÁN HÀNG" },
    ...(can("inventory.view") ? [{ value: "inventory", label: "KHO" }] : []),
    ...(can("reports.finance")
      ? [{ value: "finance", label: "TÀI CHÍNH" }]
      : []),
  ];
  const rangeLabel =
    selection.period === "DAY" && selection.anchor === localToday()
      ? "Hôm nay"
      : selection.period === "CUSTOM"
        ? day(selection.from!) + " – " + day(selection.through!)
        : (periodNames[selection.period as keyof typeof periodNames] ||
            "Tùy chọn") +
          " · " +
          (selection.period === "MONTH" ? selection.anchor.slice(5, 7) + "/" + selection.anchor.slice(0, 4) : selection.period === "QUARTER" ? "Q" + Math.ceil(Number(selection.anchor.slice(5, 7)) / 3) + "/" + selection.anchor.slice(0, 4) : selection.period === "YEAR" ? selection.anchor.slice(0, 4) : day(selection.anchor));
  return (
    <Page edgeToEdge>
      <View
        style={{
          backgroundColor: theme.colors.hero,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: theme.colors.glassBorder,
            borderRadius: 8,
            padding: 3,
          }}
        >
          {entries.map((entry) => (
            <Pressable
              key={entry.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === entry.value }}
              onPress={() => setSection(entry.value)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 6,
                backgroundColor:
                  section === entry.value ? theme.colors.paper : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText
                numberOfLines={1}
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    section === entry.value
                      ? theme.colors.text
                      : theme.colors.onPrimary,
                }}
              >
                {entry.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn thời gian báo cáo"
            onPress={() => setRangeOpen(!rangeOpen)}
            style={{
              flex: 1,
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <AppText
              numberOfLines={1}
              style={{
                fontSize: 14,
                color: theme.colors.onPrimary,
                flexShrink: 1,
              }}
            >
              {rangeLabel}
            </AppText>
            <Icon
              name="chevron-down"
              color={theme.colors.onPrimary}
              size={18}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn kho báo cáo"
            onPress={() => router.push("/warehouse-picker")}
            style={{ maxWidth: "50%", minHeight: 44, justifyContent: "center" }}
          >
            <AppText
              numberOfLines={1}
              style={{ fontSize: 13, color: theme.colors.onPrimary }}
            >
              {warehouseName}
            </AppText>
          </Pressable>
        </View>
      </View>
      {rangeOpen ? (
        <View style={{ padding: 16 }}>
          <ReportRangePicker
            value={selection}
            onChange={(value) => {
              setSelection(value);
              setRangeOpen(false);
            }}
          />
        </View>
      ) : null}
      {section === "sales" ? (
        <SalesReport selection={selection} />
      ) : (
        <View style={{ padding: 16 }}>
          <ManagementReport
            section={section as "inventory" | "finance"}
            selection={selection}
          />
        </View>
      )}
    </Page>
  );
}

function SalesReport({ selection }: { selection: ReportSelection }) {
  const period = selection.period;
  const [metric, setMetric] = useState("revenue");
  const [heroMetric, setHeroMetric] = useState(
      can("reports.profit") ? "profit" : "revenue",
    ),
    [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useApi<DataRow>(
    "/reports?" + reportQuery(selection),
    can("reports.view"),
  );
  if (!can("reports.view")) return <Denied />;
  const data = query.data;
  const hasProfit =
    can("reports.profit") &&
    data?.grossProfit !== undefined &&
    data?.cost !== undefined;
  const selectedHero =
    heroMetric === "profit" && !hasProfit ? "revenue" : heroMetric;
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
      if (detail === "profit") {
        if (!hasProfit)
          throw new Error("Kết nối máy chủ để tải lại dữ liệu lợi nhuận.");
        const profitHeaders = [
          "Kỳ",
          "Doanh số",
          "Trả hàng",
          "Doanh thu thuần",
          "Giá vốn",
          "Lãi gộp",
          "Biên lãi (%)",
        ];
        const profitRows = [
          [
            title,
            data.totals.gross,
            data.totals.returned,
            data.totals.revenue,
            data.cost,
            data.grossProfit,
            data.grossMargin ?? "",
          ],
        ];
        if (pdf)
          await exportTablePdf("Lợi nhuận " + title, profitHeaders, profitRows);
        else
          await exportCsv(
            "agristock-loi-nhuan-" + data.range.start,
            profitHeaders,
            profitRows,
          );
        return;
      }
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
    <View style={{ padding: 16, gap: 16 }}>
      <QueryState query={query}>
        {data ? <Caption>{title}</Caption> : null}
        {data ? (
          <>
            <View
              style={{
                backgroundColor: theme.colors.paper,
                borderRadius: 10,
                padding: 20,
                gap: 14,
                boxShadow: "0px 3px 10px rgba(0,0,0,0.08)",
              }}
            >
              <View
                style={{ alignItems: "center", gap: 7, paddingVertical: 18 }}
              >
                <Icon
                  name="chart-line"
                  size={35}
                  color={theme.colors.primary}
                />
                <AppText
                  style={{ fontSize: 15, fontWeight: "600", marginTop: 10 }}
                >
                  {selectedHero === "profit"
                    ? "LỢI NHUẬN GỘP"
                    : selectedHero === "collected"
                      ? "TIỀN THỰC THU"
                      : "DOANH THU THUẦN"}
                </AppText>
                <AppText
                  variant="amount"
                  style={{
                    fontSize: 30,
                    lineHeight: 40,
                    fontWeight: "700",
                    color: theme.colors.primary,
                  }}
                >
                  {money(
                    selectedHero === "profit"
                      ? data.grossProfit
                      : selectedHero === "collected"
                        ? data.totals.collected
                        : data.totals.revenue,
                  )}
                </AppText>
                {selectedHero === "profit" ? (
                  <AppText style={{ fontSize: 15, fontWeight: "600" }}>
                    Tỷ suất LN:{" "}
                    {data.grossMargin == null
                      ? "---"
                      : number(data.grossMargin) + "%"}
                  </AppText>
                ) : (
                  <Caption>
                    {selectedHero === "collected"
                      ? "Thu tiền − hoàn tiền trong kỳ"
                      : "Doanh số − trả hàng trong kỳ"}
                  </Caption>
                )}
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: theme.colors.border,
                  paddingVertical: 16,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Caption>Doanh thu</Caption>
                  <Label numeric>{money(data.totals.revenue)}</Label>
                </View>
                <View style={{ flex: 1, gap: 5, alignItems: "flex-end" }}>
                  <Caption>{hasProfit ? "Giá vốn" : "Chưa thanh toán"}</Caption>
                  <Label numeric>
                    {money(hasProfit ? data.cost : data.totals.outstanding)}
                  </Label>
                </View>
              </View>
              <Caption>
                {selectedHero === "profit"
                  ? "Lợi nhuận gộp = Doanh thu thuần − Giá vốn theo lô đã xuất."
                  : selectedHero === "collected"
                    ? "Theo ngày nhận/hoàn tiền, có thể gồm thu nợ đơn cũ."
                    : "Doanh thu theo ngày bán, trả hàng theo ngày nhận trả."}
              </Caption>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {[
                  ...(hasProfit
                    ? [{ value: "profit", label: "Lợi nhuận" }]
                    : []),
                  { value: "revenue", label: "Doanh thu" },
                  { value: "collected", label: "Thực thu" },
                ].map((entry) => (
                  <Pressable
                    key={entry.value}
                    accessibilityRole="button"
                    accessibilityLabel={"Chỉ số " + entry.label}
                    accessibilityState={{
                      selected: selectedHero === entry.value,
                    }}
                    onPress={() => setHeroMetric(entry.value)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          selectedHero === entry.value
                            ? theme.colors.primary
                            : theme.colors.border,
                      }}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
            {!detail ? (
              <>
                <SectionHeading title="XEM BÁO CÁO CHI TIẾT" />
                <View style={{ gap: 12 }}>
                  <StoreRow
                    title="Báo cáo doanh thu"
                    icon="chart-box-outline"
                    subtitle="Doanh thu cửa hàng theo kỳ"
                    onPress={() => {
                      setDetail("revenue");
                      setMetric("revenue");
                    }}
                  />
                  {hasProfit ? (
                    <StoreRow
                      title="Báo cáo lợi nhuận"
                      icon="calculator-variant-outline"
                      subtitle="Doanh thu, giá vốn và lãi gộp"
                      onPress={() => setDetail("profit")}
                    />
                  ) : null}
                  <StoreRow
                    title="Báo cáo thanh toán"
                    icon="cash-multiple"
                    subtitle="Tiền đã nhận và hoàn trong kỳ"
                    onPress={() => {
                      setDetail("payments");
                      setMetric("collected");
                    }}
                  />
                </View>
              </>
            ) : (
              <Button
                secondary
                title="Quay lại danh sách báo cáo"
                onPress={() => setDetail("")}
              />
            )}
            {detail === "profit" && hasProfit ? (
              <Panel>
                <Label big>Đối chiếu lợi nhuận</Label>
                <Row>
                  <Caption>Doanh số trước trả hàng</Caption>
                  <Label numeric>{money(data.totals.gross)}</Label>
                </Row>
                <Row>
                  <Caption>Trả hàng</Caption>
                  <Label numeric>{money(data.totals.returned)}</Label>
                </Row>
                <Row>
                  <Caption>Doanh thu thuần</Caption>
                  <Label numeric>{money(data.totals.revenue)}</Label>
                </Row>
                <Row>
                  <Caption>Giá vốn lô đã xuất</Caption>
                  <Label numeric>{money(data.cost)}</Label>
                </Row>
                <Row>
                  <Caption>Lợi nhuận gộp</Caption>
                  <Label numeric>{money(data.grossProfit)}</Label>
                </Row>
                <Caption>
                  Phiếu bán hiện chưa tính thuế. Giá vốn được tính theo lô hàng đã xuất.
                </Caption>
              </Panel>
            ) : null}
            {detail && detail !== "profit" ? (
              <>
                <Panel>
                  <Label big>
                    Biểu đồ{" "}
                    {(
                      periodNames[period as keyof typeof periodNames] ||
                      "tùy chỉnh"
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
                    Doanh thu ghi ngày bán, trả hàng ghi ngày trả. Thực thu ghi
                    ngày nhận hoặc hoàn tiền; có thể gồm thu nợ đơn cũ.
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
                            <Label>
                              {bucketLabel(item.bucket, chartPeriod)}
                            </Label>
                            <Label>{money(item.revenue)}</Label>
                          </Row>
                          <Caption>
                            {item.orders} đơn · Thực thu {money(item.collected)}{" "}
                            · Trả {money(item.returned)}
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
              </>
            ) : null}
            {detail ? (
              <>
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
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
