import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Caption,
  Field,
  Label,
  Notice,
  Panel,
  QueryState,
  Row,
  Select,
  Toggle,
  confirmAction,
} from "./ui";
import { ChipTabs } from "./pos-ui";
import { CalendarField } from "./report-range";
import { CustomerPurchases } from "./customer-purchases";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { useWarehouse } from "@/lib/warehouse";
import { DataRow, Partner } from "@/types";
import { day, money } from "@/lib/format";
import { parseRate } from "@/lib/loyalty";

export function CustomerProfile({ partner }: { partner: Partner }) {
  const [tab, setTab] = useState("info"),
    [editing, setEditing] = useState(false);
  const profile = partner.profile ?? {};
  useEffect(() => {
    setTab("info");
    setEditing(false);
  }, [partner.id]);
  return (
    <View style={{ gap: 14 }}>
      <ChipTabs
        compact
        value={tab}
        onChange={setTab}
        items={[
          { value: "info", label: "Thông tin" },
          ...(can("debts.view") ? [{ value: "debt", label: "Công nợ" }] : []),
          ...(can("sales.view")
            ? [{ value: "history", label: "Lịch sử" }]
            : []),
        ]}
      />
      {tab === "info" ? (
        <>
          <Caption>
            Mã: {profile.code || "KH" + partner.id.slice(0, 6).toUpperCase()} ·{" "}
            {profile.active === false ? "Ngừng giao dịch" : "Đang giao dịch"}
          </Caption>
          <Caption>
            {partner.phone || "Chưa có SĐT"} ·{" "}
            {profile.email || "Chưa có email"}
          </Caption>
          <Caption>
            Nhóm: {profile.group || "Bán lẻ"} · Bảng giá:{" "}
            {profile.priceBook === "WHOLESALE" ? "Bán sỉ" : "Bán lẻ"}
          </Caption>
          <Caption>
            Chiết khấu đề xuất: {profile.discountPercent ?? 0}% · Phụ trách:{" "}
            {profile.assignedStaff || "Chưa gán"}
          </Caption>
          <Caption>
            Sinh nhật: {profile.birthday ? day(profile.birthday) : "Chưa đặt"} ·{" "}
            {profile.gender === "MALE"
              ? "Nam"
              : profile.gender === "FEMALE"
                ? "Nữ"
                : "Khác / Chưa đặt"}
          </Caption>
          <Caption>
            MST: {partner.tax_code || "Chưa có"} · Địa chỉ:{" "}
            {partner.address || "Chưa có"}
          </Caption>
          {(profile.addresses ?? []).map((a, i) => (
            <Caption key={i}>
              {a.label}: {a.address}
            </Caption>
          ))}
          {(profile.contacts ?? []).map((c, i) => (
            <Caption key={i}>
              Liên hệ: {c.name} · {c.phone} · {c.email}
            </Caption>
          ))}
          {can("partners.manage") ? (
            <Button
              secondary
              title={
                editing
                  ? "Đóng thông tin bổ sung"
                  : "Sửa nhóm, bảng giá và liên hệ"
              }
              onPress={() => setEditing(!editing)}
            />
          ) : null}
          {editing ? (
            <ProfileEditor
              key={partner.id}
              partner={partner}
              onDone={() => setEditing(false)}
            />
          ) : null}
        </>
      ) : tab === "history" ? (
        <CustomerPurchases customerId={partner.id} />
      ) : (
        <CustomerLedger partner={partner} />
      )}
    </View>
  );
}
function ProfileEditor({
  partner,
  onDone,
}: {
  partner: Partner;
  onDone: () => void;
}) {
  const p = partner.profile ?? {};
  const [form, setForm] = useState({
    code: p.code ?? "",
    email: p.email ?? "",
    group: p.group ?? "Bán lẻ",
    birthday: p.birthday ?? "",
    gender: p.gender ?? "OTHER",
    discount: String(p.discountPercent ?? 0),
    priceBook: p.priceBook ?? "RETAIL",
    assignedStaff: p.assignedStaff ?? "",
    active: p.active !== false,
    addresses: p.addresses ?? [],
    contacts: p.contacts ?? [],
  });
  const command = useCommand(),
    offline = useSession((s) => s.offline);
  const save = async () => {
    const discountPercent = parseRate(form.discount || "0");
    if (discountPercent === undefined) {
      command.setError("Chiết khấu cần từ 0 đến 100%, tối đa 4 số thập phân.");
      return;
    }
    const result = await command.run(
      "/partners/" + partner.id,
      {
        name: partner.name,
        kind: partner.kind,
        phone: partner.phone,
        address: partner.address,
        taxCode: partner.tax_code,
        creditLimit: partner.credit_limit,
        profile: {
          code: form.code,
          email: form.email,
          group: form.group,
          birthday: form.birthday || null,
          gender: form.gender,
          discountPercent,
          priceBook: form.priceBook,
          assignedStaff: form.assignedStaff,
          active: form.active,
          addresses: form.addresses,
          contacts: form.contacts,
        },
      },
      "PATCH",
    );
    if (result) onDone();
  };
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Mã khách hàng"
        value={form.code}
        onChangeText={(code) => setForm({ ...form, code })}
      />
      <Field
        label="Email"
        value={form.email}
        onChangeText={(email) => setForm({ ...form, email })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Nhóm khách hàng"
        value={form.group}
        onChangeText={(group) => setForm({ ...form, group })}
      />
      <CalendarField
        label="Ngày sinh (có thể để trống)"
        minimumYear={1900}
        value={form.birthday}
        onChange={(birthday) => setForm({ ...form, birthday })}
      />
      <Select
        label="Giới tính"
        value={form.gender}
        onChange={(gender) =>
          setForm({ ...form, gender: gender as typeof form.gender })
        }
        options={[
          { value: "OTHER", label: "Khác / Chưa đặt" },
          { value: "MALE", label: "Nam" },
          { value: "FEMALE", label: "Nữ" },
        ]}
      />
      <Select
        label="Bảng giá đề xuất khi bán"
        value={form.priceBook}
        onChange={(priceBook) =>
          setForm({ ...form, priceBook: priceBook as typeof form.priceBook })
        }
        options={[
          { value: "RETAIL", label: "Bán lẻ" },
          { value: "WHOLESALE", label: "Bán sỉ" },
        ]}
      />
      <Field
        label="Chiết khấu đề xuất (%)"
        value={form.discount}
        onChangeText={(discount) => setForm({ ...form, discount })}
        keyboardType="decimal-pad"
      />
      <Caption>
        Nhân viên chỉ áp dụng được giá sỉ hoặc chiết khấu khi được cấp quyền
        tương ứng.
      </Caption>
      <Field
        label="Nhân viên phụ trách"
        value={form.assignedStaff}
        onChangeText={(assignedStaff) => setForm({ ...form, assignedStaff })}
      />
      <Toggle
        label="Cho phép giao dịch mới với khách"
        value={form.active}
        onChange={(active) => setForm({ ...form, active })}
      />
      <Label>Sổ địa chỉ</Label>
      {form.addresses.map((a, i) => (
        <Panel key={i}>
          <Field
            label="Tên địa chỉ"
            value={a.label}
            onChangeText={(label) =>
              setForm({
                ...form,
                addresses: form.addresses.map((v, j) =>
                  j === i ? { ...v, label } : v,
                ),
              })
            }
          />
          <Field
            label="Địa chỉ"
            value={a.address}
            onChangeText={(address) =>
              setForm({
                ...form,
                addresses: form.addresses.map((v, j) =>
                  j === i ? { ...v, address } : v,
                ),
              })
            }
          />
          <Button
            secondary
            title="Xóa địa chỉ"
            onPress={() =>
              setForm({
                ...form,
                addresses: form.addresses.filter((_, j) => j !== i),
              })
            }
          />
        </Panel>
      ))}
      <Button
        secondary
        title="Thêm địa chỉ"
        disabled={form.addresses.length >= 10}
        onPress={() =>
          setForm({
            ...form,
            addresses: [
              ...form.addresses,
              { label: "Địa chỉ " + (form.addresses.length + 1), address: "" },
            ],
          })
        }
      />
      <Label>Người liên hệ</Label>
      {form.contacts.map((c, i) => (
        <Panel key={i}>
          {(
            [
              ["name", "Tên liên hệ"],
              ["phone", "Số điện thoại"],
              ["email", "Email"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={c[key]}
              onChangeText={(value) =>
                setForm({
                  ...form,
                  contacts: form.contacts.map((v, j) =>
                    j === i ? { ...v, [key]: value } : v,
                  ),
                })
              }
            />
          ))}
          <Button
            secondary
            title="Xóa liên hệ"
            onPress={() =>
              setForm({
                ...form,
                contacts: form.contacts.filter((_, j) => j !== i),
              })
            }
          />
        </Panel>
      ))}
      <Button
        secondary
        title="Thêm liên hệ"
        disabled={form.contacts.length >= 10}
        onPress={() =>
          setForm({
            ...form,
            contacts: [...form.contacts, { name: "", phone: "", email: "" }],
          })
        }
      />
      <Notice error>{command.error}</Notice>
      <Button
        title="Lưu thông tin bổ sung"
        pending={command.pending}
        disabled={offline}
        onPress={() => void save()}
      />
    </View>
  );
}
function CustomerLedger({ partner }: { partner: Partner }) {
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState(false),
    [balance, setBalance] = useState(""),
    [reason, setReason] = useState("");
  const warehouse = useWarehouse((s) => s.warehouseId),
    offline = useSession((s) => s.offline),
    command = useCommand();
  const query = useApi<DataRow>(
    `/management/partners/${partner.id}/ledger?page=${page}`,
  );
  useEffect(() => {
    setPage(1);
    setEditing(false);
    setReason("");
  }, [partner.id, warehouse]);
  const save = async () => {
    if (
      !(await confirmAction(
        "Điều chỉnh sổ công nợ",
        `Đặt dư nợ của ${partner.name} tại kho đang chọn thành ${money(Number(balance))}. Đây là bút toán điều chỉnh, không ghi thu tiền và không tất toán đơn hàng.`,
      ))
    )
      return;
    const result = await command.run(
      `/management/partners/${partner.id}/balance`,
      { warehouseId: warehouse, newBalance: Number(balance), reason },
    );
    if (result) {
      setEditing(false);
      setReason("");
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <QueryState query={query}>
        {query.data ? (
          <>
            <Label big numeric>
              Dư nợ: {money(query.data.balance)}
            </Label>
            <Caption>
              Số dương: còn phải thu · Số âm: ghi có trên sổ. Trong phạm vi kho
              và quyền tài khoản.
            </Caption>
            {query.data.ownOnly ? (
              <Caption>Chỉ hiển thị giao dịch do tài khoản này lập.</Caption>
            ) : null}
            {can("partners.balance.adjust") && !query.data.ownOnly ? (
              <Button
                secondary
                title={editing ? "Đóng điều chỉnh" : "Điều chỉnh số dư sổ nợ"}
                onPress={() => {
                  setBalance(String(query.data!.balance));
                  setEditing(!editing);
                }}
              />
            ) : null}
            {editing ? (
              <Panel>
                <Field
                  label="Dư nợ mới tại kho đang chọn (đồng)"
                  value={balance}
                  onChangeText={setBalance}
                  keyboardType="numbers-and-punctuation"
                />
                <Field
                  label="Lý do điều chỉnh"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Caption>
                  Khoản ghi có không tự đổi thành điểm hay giảm giá tại POS. Thu
                  tiền đơn hàng tại mục Công nợ.
                </Caption>
                <Notice error>{command.error}</Notice>
                <Button
                  title="Lưu điều chỉnh sổ nợ"
                  pending={command.pending}
                  disabled={
                    offline ||
                    !warehouse ||
                    reason.trim().length < 3 ||
                    balance.trim() === "" ||
                    !Number.isSafeInteger(Number(balance))
                  }
                  onPress={() => void save()}
                />
              </Panel>
            ) : null}
            {query.data.items.map((r: DataRow) => (
              <Panel key={r.id + ":" + r.seq}>
                <Row>
                  <Label>{r.reference}</Label>
                  <Label numeric>
                    {r.delta > 0 ? "+" : ""}
                    {money(r.delta)}
                  </Label>
                </Row>
                <Caption>
                  {r.action} · {day(r.created_at)} · {r.employee}
                </Caption>
                <Row>
                  <Caption>Dư nợ sau giao dịch</Caption>
                  <Label numeric>{money(r.balance)}</Label>
                </Row>
              </Panel>
            ))}
            {!query.data.items.length ? (
              <Caption>Chưa có bút toán.</Caption>
            ) : null}
            <Caption>Trang {page}</Caption>
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title="Trước"
                  disabled={page === 1}
                  onPress={() => setPage((p) => p - 1)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title="Tiếp"
                  disabled={page * 30 >= query.data.total}
                  onPress={() => setPage((p) => p + 1)}
                />
              </View>
            </Row>
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
