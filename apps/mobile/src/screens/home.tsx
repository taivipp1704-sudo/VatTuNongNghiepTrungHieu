import { useState } from "react";
import { router, Href } from "expo-router";
import { Pressable, View } from "react-native";
import {
  Button,
  Caption,
  Label,
  Notice,
  Page,
  QueryState,
  Toggle,
} from "@/components/ui";
import { AppText } from "@/components/text";
import { Icon, IconName, SectionHeading } from "@/components/pos-ui";
import { StoreRow, StoreSection } from "@/components/store-ui";
import { LandscapeBackground } from "@/components/landscape-background";
import { RevenueChart } from "@/components/revenue-chart";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { useDraft } from "@/lib/drafts";
import { money, number } from "@/lib/format";
import { DataRow } from "@/types";
import { theme } from "@/theme";
export default function Home() {
  const [hidden, setHidden] = useState(false),
    [customizing, setCustomizing] = useState(false);
  const shortcuts = useDraft("home-shortcuts", () => ({
    hidden: [] as string[],
  }));
  const query = useApi<DataRow>("/dashboard"),
    weekly = useApi<DataRow>("/reports?period=WEEK", can("reports.view")),
    data = query.data;
  const actions = (
    [
      {
        name: "Hàng hóa",
        icon: "package-variant-closed",
        route: "/products",
        permission: "inventory.view",
      },
      {
        name: "Thêm sản phẩm",
        icon: "package-variant-plus",
        route: "/product-form",
        permission: "products.manage",
      },
      {
        name: "Nhập hàng",
        icon: "cart-arrow-down",
        route: "/stock-form?kind=RECEIPT",
        permission: "inventory.receipt.create",
      },
      {
        name: "Khách hàng",
        icon: "account-group-outline",
        route: "/partners",
        permission: "partners.view",
      },
      {
        name: "Công nợ",
        icon: "cash-clock",
        route: "/debts",
        permission: "debts.view",
      },
      {
        name: "Trả hàng",
        icon: "keyboard-return",
        route: "/orders?filter=RETURNED",
        permission: "sales.return",
      },
      {
        name: "Báo cáo",
        icon: "chart-bar",
        route: "/reports",
        permission: "reports.view",
      },
      {
        name: "Tích điểm",
        icon: "star-circle-outline",
        route: "/loyalty",
        permission: "loyalty.manage",
      },
    ] as { name: string; icon: IconName; route: string; permission: string }[]
  ).filter((a) => can(a.permission));
  return (
    <Page
      edgeToEdge
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
        if (can("reports.view")) void weekly.refetch();
      }}
      background={
        <View
          style={{
            height: 150,
            overflow: "hidden",
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            backgroundColor: theme.colors.hero,
          }}
        >
          <LandscapeBackground />
        </View>
      }
    >
      <QueryState query={query} loadingSurface>
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: theme.colors.paper,
            padding: 16,
            gap: 12,
            boxShadow: "0px 4px 12px rgba(0,0,0,0.10)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AppText
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: theme.colors.muted,
                flex: 1,
              }}
            >
              DOANH THU NGÀY
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? "Hiện doanh thu" : "Ẩn doanh thu"}
              onPress={() => setHidden(!hidden)}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={hidden ? "eye-off-outline" : "eye-outline"}
                color={theme.colors.muted}
                size={20}
              />
            </Pressable>
            {can("reports.view") ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết doanh thu"
                onPress={() => router.push("/reports")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <AppText style={{ color: theme.colors.primary, fontSize: 13 }}>
                  Xem chi tiết ›
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <AppText
            variant="amount"
            style={{ fontSize: 32, lineHeight: 40, fontWeight: "700" }}
          >
            {hidden
              ? "••••••"
              : data?.sales
                ? money(data.sales.revenue)
                : "Theo quyền"}
          </AppText>
          {data?.sales ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                paddingTop: 14,
                flexDirection: "row",
              }}
            >
              {[
                { label: "Đơn hôm nay", value: number(data.sales.orders) },
                { label: "Tiền thực thu", value: money(data.sales.collected) },
                {
                  label: "Đã trả · 90 ngày",
                  value: number(data.jobs?.returned ?? 0),
                },
              ].map((s) => (
                <View
                  key={s.label}
                  style={{ flex: 1, alignItems: "center", gap: 8 }}
                >
                  <AppText
                    style={{
                      fontSize: 11,
                      lineHeight: 17,
                      color: theme.colors.muted,
                      textAlign: "center",
                    }}
                  >
                    {s.label}
                  </AppText>
                  <AppText
                    variant="amount"
                    style={{ fontSize: 14, lineHeight: 21, fontWeight: "600" }}
                  >
                    {hidden ? "—" : s.value}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </QueryState>
      {can("sales.create") ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bán tại quầy"
          onPress={() => router.push("/pos")}
          style={({ pressed }) => ({
            marginHorizontal: 16,
            minHeight: 62,
            backgroundColor: pressed
              ? theme.colors.buttonPressed
              : theme.colors.buttonFill,
            borderRadius: 10,
            paddingHorizontal: 18,
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
          })}
        >
          <Icon name="store-plus-outline" size={29} />
          <AppText
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.primary,
            }}
          >
            Bán tại quầy
          </AppText>
          <Icon name="chevron-right" />
        </Pressable>
      ) : null}
      <StoreSection>
        <SectionHeading
          title="THAO TÁC NHANH"
          action={customizing ? "Đóng" : "Tùy chỉnh"}
          onPress={() => setCustomizing(!customizing)}
        />
        {customizing ? (
          <View style={{ gap: 10 }}>
            {actions.map((a) => (
              <Toggle
                key={a.route}
                label={a.name}
                value={!(shortcuts.value.hidden ?? []).includes(a.route)}
                disabled={!shortcuts.ready}
                onChange={(on) =>
                  shortcuts.setValue((v) => ({
                    hidden: on
                      ? v.hidden.filter((x) => x !== a.route)
                      : [...v.hidden, a.route],
                  }))
                }
              />
            ))}
            <Notice error>{shortcuts.storageError}</Notice>
            <Button
              title="Lưu bố cục"
              onPress={async () => {
                if (await shortcuts.save()) setCustomizing(false);
              }}
            />
            <Button
              secondary
              title="Khôi phục tất cả thao tác"
              onPress={() => shortcuts.setValue({ hidden: [] })}
            />
          </View>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingVertical: 10,
          }}
        >
          {actions
            .filter((a) => !(shortcuts.value.hidden ?? []).includes(a.route))
            .map((a) => (
              <Pressable
                key={a.route}
                accessibilityRole="button"
                accessibilityLabel={a.name}
                onPress={() => router.push(a.route as Href)}
                style={({ pressed }) => ({
                  width: "25%",
                  minHeight: 112,
                  alignItems: "center",
                  paddingHorizontal: 3,
                  gap: 9,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 49,
                    height: 49,
                    borderRadius: 25,
                    backgroundColor: theme.colors.soft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={a.icon} size={27} />
                </View>
                <AppText
                  style={{ fontSize: 12, lineHeight: 18, textAlign: "center" }}
                >
                  {a.name}
                </AppText>
              </Pressable>
            ))}
        </View>
      </StoreSection>
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <SectionHeading
          title="ĐƠN HÀNG CHỜ XỬ LÝ"
          action="90 ngày gần nhất"
          onPress={() => router.push("/orders")}
        />
      </View>
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: theme.colors.paper,
        }}
      >
        {can("inventory.view") ? (
          <StoreRow
            title="Phiếu chờ duyệt"
            icon="clipboard-check-outline"
            trailing={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Label numeric>{number(data?.pending ?? 0)}</Label>
                <Icon name="chevron-right" color={theme.colors.control} />
              </View>
            }
            onPress={() => router.push("/documents")}
          />
        ) : null}
        {can("sales.view") ? (
          <>
            <StoreRow
              title="Chờ thanh toán"
              icon="cash-clock"
              trailing={
                <Label numeric>
                  {hidden ? "—" : number(data?.jobs?.unpaid ?? 0)}
                </Label>
              }
              onPress={() => router.push("/orders?filter=UNPAID")}
            />
            <StoreRow
              title="Đã hoàn thành"
              icon="clipboard-check-outline"
              trailing={
                <Label numeric>
                  {hidden ? "—" : number(data?.jobs?.completed ?? 0)}
                </Label>
              }
              onPress={() => router.push("/orders?filter=PAID")}
            />
          </>
        ) : null}
        {can("inventory.view") ? (
          <StoreRow
            title="Lô cận hạn"
            icon="calendar-alert"
            trailing={
              <Label numeric>{number(data?.stock?.expiring ?? 0)}</Label>
            }
            onPress={() => router.push("/inventory?filter=soon")}
          />
        ) : null}
      </View>
      {can("reports.view") && !hidden ? (
        <StoreSection>
          <SectionHeading
            title="Doanh thu tuần"
            action="Chi tiết"
            onPress={() => router.push("/reports")}
          />
          <QueryState query={weekly}>
            {weekly.data ? (
              <RevenueChart points={weekly.data.series} period="WEEK" />
            ) : null}
          </QueryState>
        </StoreSection>
      ) : null}
      {can("debts.view") ? (
        <StoreSection title="Công nợ cửa hàng">
          <StoreRow
            title="Xem sổ công nợ"
            icon="book-open-outline"
            onPress={() => router.push("/debts")}
          />
        </StoreSection>
      ) : null}
    </Page>
  );
}
