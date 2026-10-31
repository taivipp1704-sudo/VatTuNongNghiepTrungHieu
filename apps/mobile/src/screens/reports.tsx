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
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { day, money } from "@/lib/format";
import { DataRow } from "@/types";
import { exportCsv, exportTablePdf } from "@/lib/export";
import { theme } from "@/theme";

export default function Reports() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useApi<DataRow>("/reports", can("reports.view"));
  if (!can("reports.view")) return <Denied />;
  const data = query.data;
  const exportData = async (pdf: boolean) => {
    setBusy(true);
    setError("");
    try {
      const headers = [
        "Ngày",
        "Số đơn",
        "Doanh số sau giảm",
        "Đã thu trên các đơn",
      ];
      const rows = (data?.daily || []).map((item: DataRow) => [
        day(item.day),
        item.orders,
        item.revenue,
        item.collected,
      ]);
      if (pdf) await exportTablePdf("Báo cáo doanh số 30 ngày", headers, rows);
      else await exportCsv("agristock-doanh-so", headers, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được báo cáo.");
    } finally {
      setBusy(false);
    }
  };
  const maximum = Math.max(
    1,
    ...(data?.daily || []).map((item: DataRow) => item.revenue),
  );
  return (
    <Page onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Caption>
        30 ngày gần nhất · Đơn trả hàng không tính vào doanh số.
      </Caption>
      <QueryState query={query}>
        <Notice error>{error}</Notice>
        <Button
          title="Xuất báo cáo Excel (CSV)"
          secondary
          pending={busy}
          onPress={() => void exportData(false)}
          disabled={!data?.daily.length}
        />
        <Button
          title="Xuất báo cáo PDF"
          secondary
          pending={busy}
          onPress={() => void exportData(true)}
          disabled={!data?.daily.length}
        />
        <Panel>
          <Caption>Doanh số đã bán</Caption>
          <Label big>
            {money(
              data?.daily.reduce(
                (sum: number, item: DataRow) => sum + item.revenue,
                0,
              ) || 0,
            )}
          </Label>
          {can("reports.profit") && data?.grossProfit !== undefined ? (
            <>
              <Caption>Lãi gộp sau chiết khấu</Caption>
              <Label big>{money(data.grossProfit)}</Label>
            </>
          ) : null}
        </Panel>
        <Section title="Doanh số theo ngày">
          {data?.daily.length ? (
            data.daily.map((item: DataRow) => (
              <Panel key={item.day}>
                <Row>
                  <Label>{day(item.day)}</Label>
                  <Label>{money(item.revenue)}</Label>
                </Row>
                <Caption>
                  {item.orders} đơn · Thu trên các đơn {money(item.collected)}
                </Caption>
                <View
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: theme.colors.soft,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 7,
                      width: (Math.max(0, (item.revenue / maximum) * 100) +
                        "%") as `${number}%`,
                      backgroundColor: theme.colors.primary,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </Panel>
            ))
          ) : (
            <Caption>Chưa có đơn trong kỳ.</Caption>
          )}
        </Section>
        <Section title="Mặt hàng bán chạy trước chiết khấu">
          {data?.top.map((item: DataRow) => (
            <Panel key={item.name}>
              <Label>{item.name}</Label>
              <Label>{money(item.revenue)}</Label>
            </Panel>
          ))}
        </Section>
      </QueryState>
    </Page>
  );
}
