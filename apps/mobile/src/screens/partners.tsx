import { useEffect, useState } from "react";
import { router } from "expo-router";
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
import { AppText } from "@/components/text";
import {
  Avatar,
  ChipTabs,
  Icon,
  IconButton,
  SectionHeading,
} from "@/components/pos-ui";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { Partner, LoyaltySettings } from "@/types";
import { fold, money, number } from "@/lib/format";
import { memberTier } from "@/lib/loyalty";
import { theme } from "@/theme";
const blank = {
  name: "",
  kind: "CUSTOMER",
  phone: "",
  address: "",
  taxCode: "",
  creditLimit: "0",
};
export default function Partners() {
  const query = useApi<Partner[]>("/partners", can("partners.view"));
  const rules = useApi<LoyaltySettings>("/loyalty/settings");
  const command = useCommand();
  const offline = useSession((state) => state.offline);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(blank);
  const [adjust, setAdjust] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const rows = (query.data || [])
    .filter((item) =>
      fold(
        item.name +
          " " +
          item.phone +
          " " +
          item.tax_code +
          " KH" +
          item.id.slice(0, 6),
      ).includes(fold(search)),
    )
    .filter(
      (item) =>
        tier === "all" ||
        (tier === "SUPPLIER"
          ? item.kind === "SUPPLIER"
          : item.kind === "CUSTOMER" && memberTier(item, rules.data) === tier),
    );
  const featured =
    rows.find((item) => item.id === selected && item.kind === "CUSTOMER") ||
    rows.find((item) => item.kind === "CUSTOMER");
  useEffect(() => {
    setAdjust(false);
    setDelta("");
    setReason("");
  }, [featured?.id]);
  if (!can("partners.view")) return <Denied />;
  const save = async () => {
    const result = await command.run(
      editId ? "/partners/" + editId : "/partners",
      { ...form, creditLimit: Number(form.creditLimit) },
      editId ? "PATCH" : "POST",
    );
    if (result) {
      setCreating(false);
      setForm(blank);
      setEditId("");
      setNotice("Đã lưu hồ sơ đối tác.");
    }
  };
  const adjustPoints = async () => {
    const amount = Number(delta);
    if (
      !featured ||
      !delta.trim() ||
      !Number.isSafeInteger(amount) ||
      amount === 0 ||
      Math.abs(amount) > 1_000_000_000 ||
      reason.trim().length < 3
    ) {
      command.setError("Nhập số điểm nguyên khác 0 và lý do ít nhất 3 ký tự.");
      return;
    }
    if (
      !(await confirmAction(
        "Điều chỉnh điểm khách hàng",
        featured.name +
          ": " +
          (amount > 0 ? "+" : "") +
          number(amount) +
          " điểm. Lý do: " +
          reason.trim(),
      ))
    )
      return;
    const result = await command.run(
      "/loyalty/customers/" + featured.id + "/adjust",
      { delta: amount, reason: reason.trim() },
    );
    if (result) {
      setNotice("Đã điều chỉnh điểm cho " + featured.name + ".");
      setAdjust(false);
      setDelta("");
      setReason("");
    }
  };
  return (
    <FlatList
      style={{ backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        paddingBottom: 40,
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
      }}
      data={rows.filter((item) => item.id !== featured?.id)}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <View
            style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}
          >
            <View style={{ flex: 1 }}>
              <Field
                label="Tìm đối tác"
                value={search}
                onChangeText={setSearch}
                placeholder="Tên, SĐT, MST hoặc mã thẻ"
              />
            </View>
            {can("partners.manage") ? (
              <IconButton
                name="account-plus-outline"
                label="Thêm khách hàng hoặc nhà cung cấp"
                onPress={() => {
                  setEditId("");
                  setForm(blank);
                  setCreating(!creating);
                }}
              />
            ) : null}
          </View>
          <ChipTabs
            value={tier}
            onChange={setTier}
            items={[
              {
                value: "all",
                label: "Tất cả (" + (query.data?.length || 0) + ")",
              },
              ...(rules.data?.tiersEnabled
                ? rules.data.tiers.map((entry) => ({
                    value: entry.name,
                    label:
                      entry.name +
                      " (" +
                      (query.data || []).filter(
                        (p) =>
                          p.kind === "CUSTOMER" &&
                          memberTier(p, rules.data) === entry.name,
                      ).length +
                      ")",
                  }))
                : []),
              { value: "SUPPLIER", label: "Nhà cung cấp" },
            ]}
          />
          <Notice>{notice}</Notice>
          <Notice error>{command.error}</Notice>
          {creating ? (
            <Panel>
              <Label big>{editId ? "Sửa hồ sơ đối tác" : "Thêm đối tác"}</Label>
              <Field
                label="Tên đối tác"
                value={form.name}
                onChangeText={(name) => setForm({ ...form, name })}
              />
              <Select
                label="Loại đối tác"
                value={form.kind}
                onChange={(kind) => setForm({ ...form, kind })}
                options={[
                  { value: "CUSTOMER", label: "Khách hàng" },
                  { value: "SUPPLIER", label: "Nhà cung cấp" },
                ].filter((option) => !editId || option.value === form.kind)}
              />
              <Field
                label="Số điện thoại"
                value={form.phone}
                onChangeText={(phone) => setForm({ ...form, phone })}
                keyboardType="phone-pad"
              />
              <Field
                label="Địa chỉ"
                value={form.address}
                onChangeText={(address) => setForm({ ...form, address })}
              />
              <Field
                label="Mã số thuế"
                value={form.taxCode}
                onChangeText={(taxCode) => setForm({ ...form, taxCode })}
              />
              <Field
                label="Hạn mức công nợ (đồng)"
                value={form.creditLimit}
                onChangeText={(creditLimit) =>
                  setForm({ ...form, creditLimit })
                }
                keyboardType="numeric"
                editable={can("partners.credit.manage")}
              />
              <Button
                title="Lưu đối tác"
                onPress={save}
                pending={command.pending}
                disabled={!form.name.trim() || offline}
              />
              <Button
                title="Đóng biểu mẫu"
                secondary
                onPress={() => setCreating(false)}
                disabled={command.pending}
              />
            </Panel>
          ) : null}
          <QueryState query={query}>
            {featured ? (
              <Panel>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Avatar name={featured.name} size={64} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label big>{featured.name}</Label>
                    <Row>
                      <Badge label={memberTier(featured, rules.data)} />
                      <Caption>
                        KH{featured.id.slice(0, 6).toUpperCase()}
                      </Caption>
                    </Row>
                    <Caption>
                      {featured.phone || "Chưa có số điện thoại"}
                    </Caption>
                  </View>
                </View>
                <View
                  style={{
                    padding: 14,
                    gap: 14,
                    borderRadius: 16,
                    backgroundColor: theme.colors.neutral,
                  }}
                >
                  <Row>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <Icon
                        name="tag-outline"
                        size={18}
                        color={theme.colors.success}
                      />
                      <AppText
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: theme.colors.success,
                        }}
                      >
                        Ví điểm thưởng tích lũy
                      </AppText>
                    </View>
                    <Badge
                      label={rules.data?.enabled ? "Đang áp dụng" : "Đang tắt"}
                      tone={rules.data?.enabled ? "positive" : "neutral"}
                    />
                  </Row>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 14,
                      alignItems: "flex-end",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Caption>Điểm khả dụng tiêu dùng</Caption>
                      <AppText
                        style={{
                          fontSize: 26,
                          fontWeight: "700",
                          lineHeight: 36,
                          color: theme.colors.primary,
                        }}
                      >
                        {number(featured.loyalty_balance || 0)}{" "}
                        <AppText style={{ fontSize: 12 }}>điểm</AppText>
                      </AppText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Caption>Giá trị quy đổi</Caption>
                      <AppText
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: theme.colors.success,
                        }}
                      >
                        ≈{" "}
                        {money(
                          Math.max(0, featured.loyalty_balance || 0) *
                            (rules.data?.pointValue || 0),
                        )}
                      </AppText>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 16,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: theme.colors.paper,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Caption>Tổng điểm mua hàng</Caption>
                      <AppText style={{ fontWeight: "600", fontSize: 13 }}>
                        {number(featured.lifetime_earned || 0)} điểm
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Caption>Chi tiêu trong phạm vi kho</Caption>
                      <AppText style={{ fontWeight: "600", fontSize: 13 }}>
                        {money(featured.lifetime_spend || 0)}
                      </AppText>
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor:
                        (featured.debt_balance || 0) > 0
                          ? theme.colors.dangerBg
                          : theme.colors.paper,
                      padding: 12,
                      borderRadius: 10,
                      gap: 5,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color:
                          (featured.debt_balance || 0) > 0
                            ? theme.colors.danger
                            : theme.colors.success,
                      }}
                    >
                      DƯ NỢ ĐƠN HÀNG: {money(featured.debt_balance || 0)}
                    </AppText>
                    <Caption>
                      Điểm chờ thu tiền: {number(featured.pending_points || 0)}{" "}
                      · Hạn mức {money(featured.credit_limit)}
                    </Caption>
                  </View>
                </View>
                {can("loyalty.adjust") ? (
                  <Button
                    title={
                      adjust ? "Đóng chỉnh điểm" : "Chỉnh điểm tay (Admin)"
                    }
                    secondary
                    onPress={() => setAdjust(!adjust)}
                    disabled={command.pending}
                  />
                ) : null}
                {adjust ? (
                  <View style={{ gap: 12 }}>
                    <Field
                      label="Số điểm điều chỉnh (+ hoặc −)"
                      value={delta}
                      onChangeText={setDelta}
                      keyboardType="numbers-and-punctuation"
                      placeholder="Ví dụ 100 hoặc -50"
                    />
                    <Field
                      label="Lý do điều chỉnh điểm"
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                    <Button
                      title="Xác nhận điều chỉnh điểm"
                      onPress={adjustPoints}
                      pending={command.pending}
                      disabled={offline}
                    />
                  </View>
                ) : null}
                <Button
                  title="Lịch sử điểm"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/customer-loyalty",
                      params: { id: featured.id },
                    })
                  }
                />
                {can("sales.create") ? (
                  <Button
                    title="Tạo đơn bán cho khách"
                    onPress={() =>
                      router.push({
                        pathname: "/pos",
                        params: { customerId: featured.id },
                      })
                    }
                  />
                ) : null}
                {can("partners.manage") ? (
                  <Button
                    title="Chỉnh sửa hồ sơ"
                    secondary
                    onPress={() => {
                      setEditId(featured.id);
                      setForm({
                        name: featured.name,
                        kind: featured.kind,
                        phone: featured.phone,
                        address: featured.address,
                        taxCode: featured.tax_code,
                        creditLimit: String(featured.credit_limit),
                      });
                      setCreating(true);
                    }}
                  />
                ) : null}
              </Panel>
            ) : null}
          </QueryState>
          <SectionHeading title={"Danh sách đối tác · " + rows.length} />
        </View>
      }
      ListEmptyComponent={
        query.data && !featured ? (
          <Empty message="Không tìm thấy đối tác phù hợp." />
        ) : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Xem khách " + item.name}
          disabled={command.pending}
          onPress={() => {
            if (item.kind === "CUSTOMER") setSelected(item.id);
            else {
              setEditId(item.id);
              setForm({
                name: item.name,
                kind: item.kind,
                phone: item.phone,
                address: item.address,
                taxCode: item.tax_code,
                creditLimit: String(item.credit_limit),
              });
              setCreating(can("partners.manage"));
            }
          }}
        >
          <Panel>
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <Avatar name={item.name} />
              <View style={{ flex: 1, gap: 3 }}>
                <AppText style={{ fontSize: 14, fontWeight: "600" }}>
                  {item.name}
                </AppText>
                <Caption>
                  {item.phone || "Chưa có SĐT"} ·{" "}
                  {item.kind === "SUPPLIER"
                    ? "Nhà cung cấp"
                    : memberTier(item, rules.data)}
                </Caption>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <AppText
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: theme.colors.primary,
                  }}
                >
                  {number(item.loyalty_balance || 0)}
                </AppText>
                <Caption>điểm</Caption>
              </View>
            </View>
          </Panel>
        </Pressable>
      )}
    />
  );
}
