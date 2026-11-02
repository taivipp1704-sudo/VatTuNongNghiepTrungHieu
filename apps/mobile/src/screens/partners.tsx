import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import {
  Button,
  Caption,
  Denied,
  Empty,
  Field,
  Label,
  Notice,
  Page,
  QueryState,
  Select,
} from "@/components/ui";
import {
  SearchBar,
  FloatingAdd,
  InfoRow,
  StoreRow,
} from "@/components/store-ui";
import { CustomerDetail } from "@/components/customer-detail";
import { Icon } from "@/components/pos-ui";
import { AppText } from "@/components/text";
import { ListPager } from "@/components/list-pager";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { Partner, LoyaltySettings } from "@/types";
import { money, number } from "@/lib/format";
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
  const params = useLocalSearchParams<{ kind?: string }>();
  const [search, setSearch] = useState(""),
    [tier, setTier] = useState(params.kind === "SUPPLIER" ? "SUPPLIER" : "all"),
    [activeFilter, setActiveFilter] = useState("ALL"),
    [sort, setSort] = useState("NAME"),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [editId, setEditId] = useState(""),
    [form, setForm] = useState(blank),
    [notice, setNotice] = useState("");
  const query = useApi<Partner[]>(
    "/partners?limit=50&page=" +
      page +
      "&search=" +
      encodeURIComponent(search) +
      "&kind=" +
      (tier === "SUPPLIER" ? "SUPPLIER" : tier === "all" ? "ALL" : "CUSTOMER") +
      "&active=" +
      activeFilter +
      "&sort=" +
      sort +
      "&tier=" +
      encodeURIComponent(tier === "SUPPLIER" || tier === "all" ? "" : tier),
    can("partners.view"),
  );
  const rules = useApi<LoyaltySettings>("/loyalty/settings"),
    command = useCommand(),
    offline = useSession((s) => s.offline);
  useEffect(() => {
    setPage(1);
    setSelected("");
  }, [search, tier, sort, activeFilter]);
  if (!can("partners.view")) return <Denied />;
  const partner = query.data?.find((p) => p.id === selected);
  const begin = (p?: Partner) => {
    setEditId(p?.id ?? "");
    setForm(
      p
        ? {
            name: p.name,
            kind: p.kind,
            phone: p.phone,
            address: p.address,
            taxCode: p.tax_code,
            creditLimit: String(p.credit_limit),
          }
        : { ...blank, kind: tier === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER" },
    );
    setCreating(true);
  };
  const save = async () => {
    if (
      await command.run(
        editId ? "/partners/" + editId : "/partners",
        { ...form, creditLimit: Number(form.creditLimit) },
        editId ? "PATCH" : "POST",
      )
    ) {
      setCreating(false);
      setEditId("");
      setNotice("Đã lưu hồ sơ đối tác.");
    }
  };
  if (creating)
    return (
      <Page
        footer={
          <Button
            title="Lưu đối tác"
            pending={command.pending}
            disabled={!form.name.trim() || offline}
            onPress={() => void save()}
          />
        }
      >
        <Stack.Screen options={{ headerShown: true }} />
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
          ].filter((v) => !editId || v.value === form.kind)}
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
          onChangeText={(creditLimit) => setForm({ ...form, creditLimit })}
          keyboardType="numeric"
          editable={can("partners.credit.manage")}
        />
        <Notice error>{command.error}</Notice>
        <Button
          secondary
          title="Đóng biểu mẫu"
          disabled={command.pending}
          onPress={() => setCreating(false)}
        />
      </Page>
    );
  if (partner?.kind === "CUSTOMER")
    return <CustomerDetail partner={partner} onBack={() => setSelected("")} />;
  if (partner)
    return (
      <Page>
        <Stack.Screen options={{ headerShown: true }} />
        <Button
          secondary
          title="Quay lại danh sách"
          onPress={() => setSelected("")}
        />
        <Label big>{partner.name}</Label>
        <InfoRow label="Số điện thoại" value={partner.phone} />
        <InfoRow label="Địa chỉ" value={partner.address} />
        <InfoRow label="Mã số thuế" value={partner.tax_code} />
        <InfoRow label="Phải trả" value={money(partner.debt_balance ?? 0)} />
        {can("partners.manage") ? (
          <Button title="Sửa nhà cung cấp" onPress={() => begin(partner)} />
        ) : null}
      </Page>
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <Stack.Screen options={{ headerShown: true }} />
      <FlatList
        data={query.data ?? []}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: 96,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <>
            <View style={{ padding: 16 }}>
              <SearchBar
                label="Tìm đối tác"
                placeholder="Tìm tên, số điện thoại hoặc mã"
                value={search}
                onChange={setSearch}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <AppText
                style={{ flex: 1, fontSize: 16, color: theme.colors.primary }}
              >
                {tier === "SUPPLIER" ? "Nhà cung cấp" : "Tất cả khách hàng"}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lọc khách hàng"
                onPress={() => setFilters(!filters)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="filter-variant" color={theme.colors.muted} />
              </Pressable>
            </View>
            {filters ? (
              <View
                style={{
                  padding: 16,
                  gap: 12,
                  backgroundColor: theme.colors.canvas,
                }}
              >
                <Select
                  label="Nhóm đối tác"
                  value={tier}
                  onChange={setTier}
                  options={[
                    { value: "all", label: "Tất cả" },
                    { value: "SUPPLIER", label: "Nhà cung cấp" },
                    ...(rules.data?.tiersEnabled
                      ? rules.data.tiers.map((t) => ({
                          value: t.name,
                          label: t.name,
                        }))
                      : []),
                  ]}
                />
                <Select
                  label="Trạng thái khách"
                  value={activeFilter}
                  onChange={setActiveFilter}
                  options={[
                    { value: "ALL", label: "Tất cả" },
                    { value: "ACTIVE", label: "Đang giao dịch" },
                    { value: "INACTIVE", label: "Ngừng giao dịch" },
                  ]}
                />
                <Select
                  label="Sắp xếp"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "NAME", label: "Tên A–Z" },
                    { value: "SPEND", label: "Mua nhiều nhất" },
                    { value: "DEBT", label: "Dư nợ cao nhất" },
                  ]}
                />
              </View>
            ) : null}
            <Notice>{notice}</Notice>
            <QueryState query={query}>{null}</QueryState>
            {query.data ? (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: theme.colors.canvas,
                }}
              >
                <Caption>
                  {number(query.data[0]?.list_total ?? 0)} đối tác
                </Caption>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          query.data ? (
            <Empty message="Không tìm thấy đối tác phù hợp." />
          ) : undefined
        }
        ListFooterComponent={
          (query.data?.[0]?.list_total ?? 0) > 50 ? (
            <View style={{ padding: 16 }}>
              <ListPager
                page={page}
                total={query.data?.[0]?.list_total ?? 0}
                onChange={setPage}
              />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Xem khách " + item.name}
            onPress={() => setSelected(item.id)}
            style={({ pressed }) => ({
              minHeight: 86,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.soft : theme.colors.paper,
            })}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: theme.colors.profileAvatar,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="account" color={theme.colors.onPrimary} size={31} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText
                style={{ fontSize: 16, fontWeight: "500", lineHeight: 23 }}
              >
                {item.name}
              </AppText>
              <AppText style={{ fontSize: 13, color: theme.colors.muted }}>
                {item.phone || "Chưa có SĐT"}
                {item.profile?.active === false ? " · Ngừng giao dịch" : ""}
              </AppText>
            </View>
            <Icon name="chevron-right" color={theme.colors.border} />
          </Pressable>
        )}
      />
      {can("partners.manage") ? (
        <FloatingAdd
          label="Thêm khách hàng hoặc nhà cung cấp"
          onPress={() => begin()}
        />
      ) : null}
    </View>
  );
}
