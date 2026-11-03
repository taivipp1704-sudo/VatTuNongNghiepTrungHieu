import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import {
  Badge,
  Button,
  Caption,
  Denied,
  Empty,
  Field,
  Label,
  Notice,
  Panel,
  QueryState,
  Row,
  Select,
  confirmAction,
} from "@/components/ui";
import { api, useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { day, fold, money, number } from "@/lib/format";
import { shareReceipt } from "@/lib/receipt";
import { Bootstrap, DataRow } from "@/types";
import { theme } from "@/theme";
import { AppText } from "@/components/text";
import {
  Avatar,
  ChipTabs,
  Icon,
  IconButton,
  SectionHeading,
} from "@/components/pos-ui";
import { exportCsv, exportTablePdf } from "@/lib/export";
import { SearchBar, FloatingAdd } from "@/components/store-ui";
import { ListPager } from "@/components/list-pager";
import { CalendarField } from "@/components/report-range";
import { counterStatus } from "@/lib/counter";
import { useScan } from "@/lib/scanner";
import { OrderConfirmationPhotos } from "@/components/delivery-photos";

const statusNames: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
  PAID: "Đã thu đủ",
  PARTIAL: "Thu một phần",
  UNPAID: "Chưa thu",
  REFUNDED: "Đã hoàn tiền",
};
const kindNames: Record<string, string> = {
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất kho",
  COUNT: "Kiểm kê",
  RETURN: "Nhận trả / cách ly",
  TRANSFER: "Điều chuyển",
  DISPOSAL: "Xuất hủy",
};
function List({
  query,
  header,
  render,
  footer,
  flat = false,
  fab,
}: {
  query: {
    data: DataRow[] | undefined;
    isPending: boolean;
    error: Error | null;
    fetchStatus: string;
    isRefetching: boolean;
    refetch: () => unknown;
  };
  header?: React.ReactNode;
  footer?: React.ReactNode;
  flat?: boolean;
  fab?: React.ReactNode;
  render: (item: DataRow) => React.ReactElement;
}) {
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{
          backgroundColor: flat ? theme.colors.paper : theme.colors.canvas,
        }}
        contentContainerStyle={{
          padding: flat ? 0 : theme.space.lg,
          gap: flat ? 0 : theme.space.md,
          paddingBottom: flat ? 96 : theme.space.xxl,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
        data={query.data || []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.space.lg, paddingBottom: theme.space.sm }}>
            {header}
            <QueryState query={query}>{null}</QueryState>
          </View>
        }
        ListEmptyComponent={
          query.data ? (
            <Empty message="Chưa có chứng từ trong phạm vi tài khoản." />
          ) : undefined
        }
        renderItem={({ item }) => render(item)}
        ListFooterComponent={
          footer ? (
            <View style={{ gap: 16, paddingTop: 16 }}>{footer}</View>
          ) : undefined
        }
      />
      {fab}
    </View>
  );
}

export function Documents() {
  const query = useApi<DataRow[]>("/documents", can("inventory.view"));
  const [filter, setFilter] = useState("ALL");
  const command = useCommand();
  const user = useSession((state) => state.user);
  const offline = useSession((state) => state.offline);
  const [expanded, setExpanded] = useState("");
  if (!can("inventory.view")) return <Denied />;
  const post = async (item: DataRow) => {
    if (
      await confirmAction(
        "Ghi sổ " + item.code,
        "Thao tác sẽ thay đổi tồn kho và tạo lịch sử không thể xóa.",
      )
    )
      await command.run(
        "/documents/" + item.id + "/post",
        {},
        "POST",
        "post_" + item.id,
      );
  };
  const filtered = {
    ...query,
    data: query.data?.filter(
      (item) => filter === "ALL" || item.status === filter,
    ),
  };
  return (
    <List
      query={filtered}
      header={
        <>
          {can("inventory.receipt.create") ? (
            <Button
              title="Tạo phiếu nhập"
              onPress={() =>
                router.push({
                  pathname: "/stock-form",
                  params: { kind: "RECEIPT" },
                })
              }
            />
          ) : null}
          {can("inventory.count.create") ? (
            <Button
              title="Kiểm kê thực tế"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/stock-form",
                  params: { kind: "COUNT" },
                })
              }
            />
          ) : null}
          <Select
            label="Trạng thái phiếu"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "Tất cả" },
              { value: "DRAFT", label: "Bản nháp" },
              { value: "PENDING", label: "Chờ duyệt" },
              { value: "POSTED", label: "Đã ghi sổ" },
              { value: "CANCELLED", label: "Đã hủy" },
            ]}
          />
          <Notice error>{command.error}</Notice>
        </>
      }
      render={(item) => (
        <Panel>
          <Row>
            <Badge label={kindNames[item.kind] || item.kind} />
            <Badge
              label={statusNames[item.status]}
              tone={
                item.status === "PENDING"
                  ? "warning"
                  : item.status === "POSTED"
                    ? "positive"
                    : "neutral"
              }
            />
          </Row>
          <Label big>{item.code}</Label>
          <Caption>
            {item.warehouse_name} · {day(item.created_at)} · {item.actor}
          </Caption>
          <Label>{item.reason}</Label>
          <Button
            title={
              expanded === item.id
                ? "Ẩn chi tiết"
                : item.lines.length + " dòng hàng · Xem chi tiết"
            }
            secondary
            onPress={() => setExpanded(expanded === item.id ? "" : item.id)}
          />
          {expanded === item.id
            ? item.lines.map((line: DataRow, index: number) => (
                <View key={index}>
                  <Label>{line.name}</Label>
                  <Caption>
                    {number(line.baseQuantity)} {line.baseUnit} ·{" "}
                    {line.lotCode || "Lô đã chọn"}
                  </Caption>
                  {line.costBase !== undefined ? (
                    <Caption>
                      Giá vốn {money(line.costBase)} / {line.baseUnit}
                    </Caption>
                  ) : null}
                </View>
              ))
            : null}
          {item.status === "PENDING" &&
          can("inventory.approve") &&
          (user?.owner || item.created_by !== user?.id) ? (
            <Button
              title="Duyệt & ghi sổ"
              onPress={() => post(item)}
              pending={command.pending}
              disabled={offline}
            />
          ) : null}
          {item.status === "DRAFT" &&
          (user?.owner || item.created_by === user?.id) ? (
            <Button
              title="Gửi duyệt"
              secondary
              onPress={async () => {
                if (
                  await confirmAction(
                    "Gửi duyệt " + item.code,
                    "Phiếu sẽ vào danh sách chờ duyệt.",
                  )
                )
                  await command.run("/documents/" + item.id + "/submit", {});
              }}
              pending={command.pending}
              disabled={offline}
            />
          ) : null}
          {["DRAFT", "PENDING"].includes(item.status) &&
          can("inventory.approve") ? (
            <Button
              title="Hủy phiếu chưa ghi sổ"
              secondary
              onPress={async () => {
                if (
                  await confirmAction(
                    "Hủy " + item.code,
                    "Phiếu sẽ được giữ trong lịch sử với trạng thái đã hủy.",
                  )
                )
                  await command.run("/documents/" + item.id + "/cancel", {
                    reason: "Hủy phiếu từ ứng dụng quản trị",
                  });
              }}
              disabled={offline}
              pending={command.pending}
            />
          ) : null}
        </Panel>
      )}
    />
  );
}

export function Orders() {
  const params = useLocalSearchParams<{
    filter?: string;
    customerId?: string;
    search?: string;
  }>();
  const dashboard = useApi<DataRow>("/dashboard");
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const command = useCommand();
  const scan = useScan();
  const offline = useSession((state) => state.offline);
  const [expanded, setExpanded] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(params.search || "");
  const [filter, setFilter] = useState(params.filter || "all");
  const [page, setPage] = useState(1),
    [sort, setSort] = useState("NEWEST"),
    [from, setFrom] = useState(""),
    [through, setThrough] = useState(""),
    [dates, setDates] = useState(""),
    [dateOpen, setDateOpen] = useState(false);
  useEffect(() => {
    setPage(1);
    setExpanded("");
  }, [search, filter, params.customerId, sort, dates]);
  const query = useApi<DataRow[]>(
    "/orders?limit=50&page=" +
      page +
      "&status=" +
      filter +
      "&search=" +
      encodeURIComponent(search) +
      "&sort=" +
      sort +
      (params.customerId ? "&customerId=" + params.customerId : "") +
      dates,
    can("sales.view"),
  );

  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [collectionMethod, setCollectionMethod] = useState("CASH");
  const [exportBusy, setExportBusy] = useState(false);
  useEffect(() => {
    if (params.filter) setFilter(params.filter);
  }, [params.filter]);
  useEffect(() => {
    if (scan.target === "orders" && scan.code) {
      setSearch(scan.code);
      scan.clear();
    }
  }, [scan.target, scan.code]);
  if (!can("sales.view")) return <Denied />;
  const rows = (query.data || [])
    .filter((item) =>
      fold(
        item.code +
          " " +
          (item.customer_name || "") +
          " " +
          (item.customer_phone || ""),
      ).includes(fold(search)),
    )
    .filter(
      (item) =>
        filter === "all" ||
        (filter === "RETURNED"
          ? item.returned
          : filter === "PAID"
            ? !item.returned && item.paid >= item.total
            : filter === "UNPAID"
              ? !item.returned && item.paid < item.total
              : !item.returned && item.paid >= item.total),
    );
  const filters = [
    { value: "all", label: "Tất cả" },
    { value: "PAID", label: "Hoàn thành" },
    { value: "UNPAID", label: "Đang giao dịch" },
    { value: "RETURNED", label: "Đã trả hàng" },
  ];
  const open = (item: DataRow) => {
    setExpanded(expanded === item.id ? "" : item.id);
    setReason("");
    setCollectionAmount(String(Math.max(0, item.total - item.paid)));
    setCollectionMethod("CASH");
  };
  const print = async (item: DataRow) => {
    setExportBusy(true);
    try {
      const invoices = await api<DataRow[]>("/invoices");
      const invoice = invoices.find((i) => i.order_id === item.id);
      if (!invoice || !bootstrap.data)
        throw new Error("Không tìm thấy phiếu bán để in.");
      await shareReceipt(invoice, bootstrap.data.store);
    } catch (e) {
      command.setError(e instanceof Error ? e.message : "Không mở được phiếu.");
    } finally {
      setExportBusy(false);
    }
  };
  const headers = [
    "Mã đơn",
    "Khách hàng",
    "Ngày",
    "Tổng tiền",
    "Đã thu",
    "Giảm bằng điểm",
    "Điểm đã cộng lúc bán",
    "Trạng thái",
  ];
  const exportRows = rows.map((item) => [
    item.code,
    item.customer_name || "Khách lẻ",
    day(item.created_at),
    item.total,
    item.paid,
    item.loyalty_discount || 0,
    item.loyalty_earned || 0,
    counterStatus(item as any),
  ]);
  const exportData = async (pdf: boolean) => {
    setExportBusy(true);
    try {
      if (pdf) await exportTablePdf("Danh sách đơn hàng", headers, exportRows);
      else await exportCsv("agristock-don-hang", headers, exportRows);
    } catch (e) {
      command.setError(
        e instanceof Error ? e.message : "Không xuất được dữ liệu.",
      );
    } finally {
      setExportBusy(false);
    }
  };
  const footer = (
    <>
      <ListPager
        page={page}
        total={query.data?.[0]?.list_total ?? 0}
        onChange={setPage}
      />
      <Panel>
        <Label>Công cụ POS & báo cáo nhanh</Label>
        <Button
          title="Xuất Excel (CSV)"
          secondary
          onPress={() => void exportData(false)}
          pending={exportBusy}
          disabled={!rows.length}
        />
        <Button
          title="Xuất danh sách PDF"
          secondary
          onPress={() => void exportData(true)}
          pending={exportBusy}
          disabled={!rows.length}
        />
        <Caption>
          Xuất trang đang lọc, tối đa 50 đơn. Phiếu PDF có thể chia sẻ hoặc in
          qua Android. Lịch sử điểm nằm trong hồ sơ khách hàng.
        </Caption>
      </Panel>
    </>
  );
  return (
    <List
      flat
      fab={
        can("sales.create") ? (
          <FloatingAdd
            label="Tạo đơn bán"
            onPress={() => router.push("/pos")}
          />
        ) : undefined
      }
      query={{ ...query, data: query.data ? rows : undefined }}
      footer={footer}
      header={
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <SearchBar
              label="Tìm mã đơn, tên hoặc SĐT khách"
              value={search}
              onChange={setSearch}
              placeholder="Nhập tên, SĐT hoặc mã đơn"
              onScan={() =>
                router.push({ pathname: "/scan", params: { target: "orders" } })
              }
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>

              <ChipTabs
                value={filter}
                onChange={setFilter}
                items={[filters.find((v) => v.value === filter) ?? filters[0]]}
              />
            </View>
            <IconButton
              name="filter-variant"
              label="Lọc đơn hàng"
              onPress={() => setFiltersOpen(!filtersOpen)}
            />
          </View>
          {filtersOpen ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Select
                label="Trạng thái đơn hàng"
                value={filter}
                onChange={setFilter}
                options={filters}
              />
              <Select
                label="Sắp xếp đơn hàng"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "NEWEST", label: "Mới nhất" },
                  { value: "OLDEST", label: "Cũ nhất" },
                  { value: "TOTAL", label: "Giá trị cao nhất" },
                ]}
              />
              <Button
                secondary
                title={dateOpen ? "Đóng bộ lọc ngày" : "Lọc theo ngày bán"}
                onPress={() => setDateOpen(!dateOpen)}
              />
              {dateOpen ? (
                <Panel>
                  <CalendarField
                    label="Từ ngày"
                    value={from}
                    onChange={setFrom}
                  />
                  <CalendarField
                    label="Đến ngày"
                    value={through}
                    onChange={setThrough}
                  />
                  <Caption>Tối đa 366 ngày, gồm cả ngày kết thúc.</Caption>
                  <Button
                    title="Áp dụng ngày"
                    disabled={!from || !through}
                    onPress={() =>
                      setDates(
                        "&from=" +
                          encodeURIComponent(from) +
                          "&through=" +
                          encodeURIComponent(through),
                      )
                    }
                  />
                  <Button
                    secondary
                    title="Bỏ lọc ngày"
                    onPress={() => {
                      setDates("");
                      setFrom("");
                      setThrough("");
                    }}
                  />
                </Panel>
              ) : null}
            </View>
          ) : null}
          {query.data ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: theme.colors.canvas,
              }}
            >
              <Caption>
                {number(query.data[0]?.list_total ?? 0)} đơn hàng
              </Caption>
            </View>
          ) : null}
          <Notice error>{command.error}</Notice>
        </>
      }
      render={(item) => (
        <View
          testID={"order-" + item.id}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.paper,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Mở đơn " + item.code}
            onPress={() => open(item)}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 13,
              minHeight: 88,
              flexDirection: "row",
              gap: 12,
              backgroundColor: pressed ? theme.colors.soft : theme.colors.paper,
            })}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <AppText style={{ fontSize: 16, fontWeight: "600" }}>
                {item.code}
              </AppText>
              <AppText
                numberOfLines={1}
                style={{ fontSize: 14, color: theme.colors.muted }}
              >
                {item.customer_name || "Khách lẻ"}
              </AppText>
              <AppText style={{ fontSize: 12, color: theme.colors.muted }}>
                {day(item.created_at)} ·{" "}
                {new Date(item.created_at).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6, maxWidth: 128 }}>
              <AppText variant="amount" style={{ fontSize: 16 }}>
                {money(item.total)}
              </AppText>
              <AppText
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: item.returned
                    ? theme.colors.danger
                    : item.paid < item.total
                      ? theme.colors.warning
                      : theme.colors.muted,
                }}
              >
                {counterStatus(item as any)}
              </AppText>
            </View>
          </Pressable>
          {expanded === item.id ? (
            <View
              style={{
                padding: 16,
                gap: 12,
                backgroundColor: theme.colors.canvas,
              }}
            >
              <Caption>
                Đã thu {money(item.paid)} · Thu ngân: {item.actor} · Điểm đã
                cộng: {number(item.loyalty_earned || 0)}
              </Caption>
              <Caption>{item.note || "Không có ghi chú đơn."}</Caption>
              {item.lines.map((line: DataRow, index: number) => (
                <Row key={index}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 13, fontWeight: "600" }}>
                      {line.name}
                    </AppText>
                    <Caption>
                      {number(line.quantity)} {line.unitLabel} ×{" "}
                      {money(line.unitPrice)}
                    </Caption>
                  </View>
                  <Label numeric>{money(line.total)}</Label>
                </Row>
              ))}
              {can("invoices.view") ? (
                <Button
                  title="In / chia sẻ phiếu bán"
                  secondary
                  onPress={() => void print(item)}
                  pending={exportBusy}
                />
              ) : null}
              {!item.returned && item.paid < item.total ? (
                <Panel>
                  <Label>Đang giao dịch</Label>
                  <Caption>
                    Còn phải thu {money(item.total - item.paid)}. Thu đủ tiền sẽ
                    tự chuyển Hoàn thành.
                  </Caption>
                  {can("payments.create") && item.debt_id ? (
                    <>
                      <Field
                        label="Số tiền nhận thêm"
                        value={collectionAmount}
                        onChangeText={setCollectionAmount}
                        keyboardType="numeric"
                      />
                      <Select
                        label="Cách nhận tiền"
                        value={collectionMethod}
                        onChange={setCollectionMethod}
                        options={[
                          { value: "CASH", label: "Tiền mặt" },
                          { value: "TRANSFER", label: "Chuyển khoản" },
                        ]}
                      />
                      <Button
                        title="Xác nhận thu tiền"
                        pending={command.pending}
                        disabled={offline || !Number(collectionAmount)}
                        onPress={async () => {
                          const amount = Number(collectionAmount);
                          if (
                            !Number.isSafeInteger(amount) ||
                            amount <= 0 ||
                            amount > item.total - item.paid
                          ) {
                            command.setError(
                              "Nhập số tiền dương và không vượt số còn phải thu.",
                            );
                            return;
                          }
                          if (
                            await confirmAction(
                              "Nhận tiền đơn " + item.code,
                              money(amount),
                            )
                          ) {
                            const result = await command.run<DataRow>(
                              "/debts/" + item.debt_id + "/pay",
                              { amount, method: collectionMethod },
                            );
                            if (result)
                              setCollectionAmount(String(result.balance ?? 0));
                          }
                        }}
                      />
                    </>
                  ) : (
                    <Caption>
                      Nhân viên được cấp quyền ghi nhận thu/chi công nợ có thể
                      thu tiền cho đơn này.
                    </Caption>
                  )}
                </Panel>
              ) : null}
              {can("sales.return") && !item.returned ? (
                <>
                  <Notice>
                    Trả toàn bộ đơn, hoàn tiền thực thu và xử lý điểm theo quy
                    tắc đã lưu của đơn. Hàng về khu cách ly.
                  </Notice>
                  <ReturnReason value={reason} onChange={setReason} />
                  <Select
                    label="Hình thức hoàn tiền"
                    value={refundMethod}
                    onChange={setRefundMethod}
                    options={[
                      { value: "CASH", label: "Tiền mặt" },
                      { value: "TRANSFER", label: "Chuyển khoản" },
                    ]}
                  />
                  <Button
                    title="Trả toàn bộ & hoàn tiền"
                    secondary
                    onPress={async () => {
                      if (reason.trim().length < 3) {
                        command.setError("Nhập lý do trả hàng.");
                        return;
                      }
                      if (
                        !(await confirmAction(
                          "Trả toàn bộ " + item.code,
                          "Hoàn " +
                            money(item.paid) +
                            ", xóa nợ còn lại, xử lý điểm theo quy tắc đã bán và đưa hàng vào cách ly.",
                        ))
                      )
                        return;
                      const result = await command.run(
                        "/orders/" + item.id + "/return",
                        { reason, refundMethod },
                      );
                      if (result) setReason("");
                    }}
                    pending={command.pending}
                    disabled={offline}
                  />
                </>
              ) : null}
              <OrderConfirmationPhotos orderId={item.id} returned={Boolean(item.returned)} />
            </View>
          ) : null}
        </View>
      )}
    />
  );
}

function ReturnReason({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <Field label="Lý do trả hàng" value={value} onChangeText={onChange} />;
}

export function Invoices() {
  const query = useApi<DataRow[]>("/invoices", can("invoices.view"));
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  if (!can("invoices.view")) return <Denied />;
  const print = async (item: DataRow) => {
    setBusy(item.id);
    setError("");
    try {
      await shareReceipt(
        item,
        bootstrap.data?.store || { name: "HTAgri", address: "", phone: "" },
      );
    } catch {
      setError(
        "Không tạo hoặc chia sẻ được PDF. Kiểm tra dịch vụ in/chia sẻ trên thiết bị.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <List
      query={query}
      header={
        <>
          <Notice>
            Phiếu bán nội bộ có thể in/chia sẻ PDF. Chưa cấu hình nhà cung cấp
            hóa đơn điện tử.
          </Notice>
          <Notice error>{error}</Notice>
        </>
      }
      render={(item) => (
        <Panel>
          <Row>
            <Label big>{item.code}</Label>
            <Badge
              label={
                item.status === "CANCELLED" ? "Đơn đã trả" : "Phiếu nội bộ"
              }
            />
          </Row>
          <Caption>
            Đơn {item.order_code} · {day(item.created_at)}
          </Caption>
          <Label>{item.customer_name || "Khách lẻ"}</Label>
          {item.tax_code ? <Caption>MST {item.tax_code}</Caption> : null}
          <Label big numeric>
            {money(item.total)}
          </Label>
          <Caption>
            {counterStatus(item as any)} ·{" "}
            {item.delivery_status === "RETURNED"
              ? "Đã trả hàng"
              : "Đã xuất kho"}
          </Caption>
          <Button
            title="In / chia sẻ phiếu PDF"
            secondary
            onPress={() => print(item)}
            pending={busy === item.id}
          />
          {can("invoices.issue") ? (
            <>
              <Button
                title="Phát hành hóa đơn điện tử"
                onPress={() => {}}
                disabled
              />
              <Caption>Cần cấu hình nhà cung cấp trước khi phát hành.</Caption>
            </>
          ) : null}
        </Panel>
      )}
    />
  );
}
