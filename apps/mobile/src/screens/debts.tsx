import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
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
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { day, fold, money } from "@/lib/format";
import { DataRow } from "@/types";
import { theme } from "@/theme";

export default function Debts() {
  const query = useApi<DataRow[]>("/debts", can("debts.view"));
  const command = useCommand();
  const [kind, setKind] = useState("RECEIVABLE");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [success, setSuccess] = useState("");
  const offline = useSession((state) => state.offline);
  if (!can("debts.view")) return <Denied />;
  const rows = (query.data || []).filter(
    (item) =>
      item.kind === kind && fold(item.partner_name).includes(fold(search)),
  );
  const total = rows.reduce((sum, item) => sum + item.balance, 0);
  const pay = async (item: DataRow) => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0 || value > item.balance) {
      command.setError("Nhập số tiền nguyên dương, không vượt số nợ còn lại.");
      return;
    }
    if (
      !(await confirmAction(
        kind === "RECEIVABLE" ? "Ghi nhận thu nợ" : "Ghi nhận trả nhà cung cấp",
        item.partner_name + " · " + money(value),
      ))
    )
      return;
    const result = await command.run<DataRow>("/debts/" + item.id + "/pay", {
      amount: value,
      method,
    });
    if (result) {
      setSelected("");
      setAmount("");
      setSuccess(
        "Đã ghi nhận thanh toán. Số nợ còn lại " + money(result.balance),
      );
    }
  };
  return (
    <FlatList
      style={{ backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: theme.space.lg,
        gap: theme.space.md,
        paddingBottom: theme.space.xxl,
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
      }}
      data={rows}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: theme.space.lg, paddingBottom: theme.space.md }}>
          <Select
            label="Sổ công nợ"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setSelected("");
              setAmount("");
            }}
            options={[
              { value: "RECEIVABLE", label: "Phải thu khách hàng" },
              { value: "PAYABLE", label: "Phải trả nhà cung cấp" },
            ]}
          />
          <Panel>
            <Caption>Còn nợ trong bộ lọc</Caption>
            <Label big>{money(total)}</Label>
            <Caption>
              {rows.filter((item) => item.overdue).length} khoản quá hạn
            </Caption>
          </Panel>
          <Field
            label="Tìm tên khách hàng / nhà cung cấp"
            value={search}
            onChangeText={setSearch}
          />
          <Notice>{success}</Notice>
          <Notice error>{command.error}</Notice>
          <QueryState query={query}>{null}</QueryState>
        </View>
      }
      ListEmptyComponent={
        query.data ? (
          <Empty message="Chưa có công nợ trong bộ lọc này." />
        ) : undefined
      }
      renderItem={({ item }) => (
        <Panel>
          <Row>
            <Label big>{item.partner_name}</Label>
            <Badge
              label={
                item.balance === 0
                  ? "Đã tất toán"
                  : item.overdue
                    ? "Quá hạn"
                    : "Đang theo dõi"
              }
              tone={item.overdue ? "danger" : "neutral"}
            />
          </Row>
          <Label big>{money(item.balance)}</Label>
          <Caption>
            Phát sinh {money(item.original)} · Hạn {day(item.due_on)}
          </Caption>
          <Caption>
            {item.order_code || "Phiếu nhập nhà cung cấp"} · {item.phone}
          </Caption>
          {item.balance > 0 && can("payments.create") ? (
            <Button
              title={
                selected === item.id
                  ? "Đóng thanh toán"
                  : kind === "RECEIVABLE"
                    ? "Thu nợ"
                    : "Trả nhà cung cấp"
              }
              secondary
              onPress={() => {
                setSelected(selected === item.id ? "" : item.id);
                setAmount("");
              }}
            />
          ) : null}
          {selected === item.id ? (
            <>
              <Field
                label="Số tiền thanh toán (đồng)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={String(item.balance)}
              />
              <Select
                label="Hình thức"
                value={method}
                onChange={setMethod}
                options={[
                  { value: "CASH", label: "Tiền mặt" },
                  { value: "TRANSFER", label: "Chuyển khoản" },
                ]}
              />
              <Button
                title="Xác nhận khoản thanh toán"
                onPress={() => pay(item)}
                pending={command.pending}
                disabled={offline || !amount}
              />
            </>
          ) : null}
          {item.payments.length ? (
            <>
              <Caption>Lịch sử thanh toán</Caption>
              {item.payments.map((payment: DataRow) => (
                <Row key={payment.id}>
                  <Caption>
                    {day(payment.createdAt)} ·{" "}
                    {payment.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                  </Caption>
                  <Label>{money(payment.amount)}</Label>
                </Row>
              ))}
            </>
          ) : null}
        </Panel>
      )}
    />
  );
}
