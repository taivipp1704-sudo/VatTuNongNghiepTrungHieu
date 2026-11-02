import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Caption,
  Label,
  Notice,
  Panel,
  QueryState,
  Row,
  Select,
} from "./ui";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { day, money, number } from "@/lib/format";
import { reportQuery, ReportSelection } from "@/lib/counter";
import { exportCsv, exportTablePdf } from "@/lib/export";
import { DataRow } from "@/types";

export function ManagementReport({
  section,
  selection,
}: {
  section: "inventory" | "finance";
  selection: ReportSelection;
}) {
  const [page, setPage] = useState(1),
    [method, setMethod] = useState("ALL"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const range = reportQuery(selection);
  useEffect(() => setPage(1), [range, method, section]);
  const query = useApi<DataRow>(
    "/management/reports/" +
      section +
      "?" +
      range +
      (section === "finance" ? "&page=" + page + "&method=" + method : ""),
  );
  const data = query.data;
  const canCost =
    can("inventory.cost.view") &&
    data?.items.some((r: DataRow) => r.costTotal !== undefined);
  const headers =
    section === "inventory"
      ? [
          "SKU",
          "Hàng hóa",
          "Kho",
          "Đơn vị",
          "Đầu kỳ",
          "Nhập",
          "Xuất",
          "Cuối kỳ",
        ]
      : [
          "Ngày",
          "Chứng từ",
          "Đối tác",
          "Hướng",
          "Phương thức",
          "Số tiền",
          "Nhân viên",
          "Ghi chú",
        ];
  const rows = (data?.items ?? []).map((r: DataRow) =>
    section === "inventory"
      ? [
          r.sku,
          r.name,
          r.warehouse,
          r.unit,
          r.opening,
          r.incoming,
          r.outgoing,
          r.closing,
        ]
      : [
          day(r.created_at),
          r.reference,
          r.partner,
          r.direction === "IN" ? "Thu" : "Chi",
          r.method === "CASH" ? "Tiền mặt" : "Chuyển khoản",
          r.amount,
          r.employee,
          r.note,
        ],
  );
  const title =
    section === "inventory"
      ? "Báo cáo nhập xuất tồn"
      : "Báo cáo thu chi đã ghi nhận";
  const exportData = async (pdf: boolean) => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      if (pdf) await exportTablePdf(title, headers, rows);
      else
        await exportCsv(
          section === "inventory"
            ? "agristock-nhap-xuat-ton"
            : "agristock-thu-chi",
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
    <View style={{ gap: 16 }}>
      {section === "finance" ? (
        <Select
          label="Phương thức thu/chi"
          value={method}
          onChange={setMethod}
          options={[
            { value: "ALL", label: "Tất cả" },
            { value: "CASH", label: "Tiền mặt" },
            { value: "TRANSFER", label: "Chuyển khoản" },
          ]}
        />
      ) : null}
      <QueryState query={query}>
        {data ? (
          <>
            <Caption>
              {day(data.range.start)} – {day(data.range.through)}
            </Caption>
            {section === "inventory" ? (
              <Panel>
                <Label big>Nhập · Xuất · Tồn</Label>
                <Caption>
                  {number(data.skuCount)} mã hàng trong phạm vi kho
                </Caption>
                <Caption>
                  Số lượng theo đơn vị cơ sở của từng mặt hàng. Nhập/xuất gồm cả
                  kiểm kê, chuyển kho và trả hàng đã ghi sổ.
                </Caption>
                {canCost ? (
                  <Row>
                    <Caption>Giá trị tồn hiện tại theo lô</Caption>
                    <Label numeric>
                      {money(
                        data.items.reduce(
                          (sum: number, r: DataRow) => sum + (r.costTotal ?? 0),
                          0,
                        ),
                      )}
                    </Label>
                  </Row>
                ) : null}
              </Panel>
            ) : (
              <>
                <Panel>
                  <Row>
                    <Caption>Tổng thu trong kỳ</Caption>
                    <Label numeric tone="success">
                      {money(data.totals.received)}
                    </Label>
                  </Row>
                  <Row>
                    <Caption>Tổng chi trong kỳ</Caption>
                    <Label numeric tone="warning">
                      {money(data.totals.paid)}
                    </Label>
                  </Row>
                  <Row>
                    <Caption>Chênh lệch thu − chi</Caption>
                    <Label numeric>{money(data.totals.net)}</Label>
                  </Row>
                </Panel>
                <Panel>
                  <Row>
                    <Caption>Lũy kế ghi nhận trước kỳ</Caption>
                    <Label numeric>{money(data.totals.recorded_opening)}</Label>
                  </Row>
                  <Row>
                    <Caption>Lũy kế ghi nhận cuối kỳ</Caption>
                    <Label numeric>{money(data.totals.recordedClosing)}</Label>
                  </Row>
                  <Caption>
                    Chỉ gồm khoản tiền đã ghi trong ứng dụng, không thay số dư
                    tiền mặt/ngân hàng thực tế. Điều chỉnh sổ nợ không được tính
                    là thu/chi tiền.
                  </Caption>
                </Panel>
              </>
            )}
            {data.items.length ? (
              (section === "inventory"
                ? data.items.slice((page - 1) * 50, page * 50)
                : data.items
              ).map((r: DataRow) => (
                <Panel
                  key={
                    section === "inventory" ? r.id + ":" + r.warehouse_id : r.id
                  }
                >
                  {section === "inventory" ? (
                    <>
                      <Label>{r.name}</Label>
                      <Caption>
                        {r.sku} · {r.warehouse} · {r.unit}
                      </Caption>
                      <Row>
                        <Caption>Đầu kỳ</Caption>
                        <Label numeric>{number(r.opening)}</Label>
                      </Row>
                      <Row>
                        <Caption>Nhập / Xuất</Caption>
                        <Label numeric>
                          {number(r.incoming)} / {number(r.outgoing)}
                        </Label>
                      </Row>
                      <Row>
                        <Caption>Cuối kỳ</Caption>
                        <Label numeric>{number(r.closing)}</Label>
                      </Row>
                      <Caption>
                        Tồn hiện tại {number(r.actual)} · Đã giữ{" "}
                        {number(r.reserved)} · Vị trí {r.location || "Chưa đặt"}
                      </Caption>
                      {r.actual < r.min_stock ? (
                        <Caption>
                          Dưới tồn tối thiểu {number(r.min_stock)}
                        </Caption>
                      ) : r.max_stock !== null && r.actual > r.max_stock ? (
                        <Caption>Vượt tồn tối đa {number(r.max_stock)}</Caption>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Row>
                        <Label>
                          {r.direction === "IN" ? "Thu tiền" : "Chi tiền"}
                        </Label>
                        <Label
                          numeric
                          tone={r.direction === "IN" ? "success" : "warning"}
                        >
                          {money(r.amount)}
                        </Label>
                      </Row>
                      <Caption>
                        {r.reference || "Chưa có mã chứng từ"} ·{" "}
                        {r.partner || "Khách lẻ"}
                      </Caption>
                      <Caption>
                        {day(r.created_at)} · {r.warehouse} · {r.employee}
                      </Caption>
                      <Caption>
                        {r.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                        {r.note ? " · " + r.note : ""}
                      </Caption>
                    </>
                  )}
                </Panel>
              ))
            ) : (
              <Caption>Chưa có dữ liệu trong khoảng thời gian này.</Caption>
            )}
            {true ? (
              <>
                <Caption>
                  Trang {page} ·{" "}
                  {number(
                    section === "inventory" ? data.items.length : data.total,
                  )}{" "}
                  dòng
                </Caption>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      title="Trang trước"
                      disabled={page === 1}
                      onPress={() => setPage((p) => p - 1)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      title="Trang sau"
                      disabled={
                        page * 50 >=
                        (section === "inventory"
                          ? data.items.length
                          : data.total)
                      }
                      onPress={() => setPage((p) => p + 1)}
                    />
                  </View>
                </Row>
                <Caption>
                  {section === "finance"
                    ? "Tệp xuất gồm trang đang hiển thị."
                    : "Tệp xuất gồm toàn bộ các dòng đã tải (tối đa 5.000 dòng)."}
                </Caption>
              </>
            ) : null}
            <Notice error>{error}</Notice>
            <Button
              secondary
              title="Xuất Excel (CSV)"
              pending={busy}
              disabled={!rows.length}
              onPress={() => void exportData(false)}
            />
            <Button
              secondary
              title="Xuất PDF"
              pending={busy}
              disabled={!rows.length}
              onPress={() => void exportData(true)}
            />
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
