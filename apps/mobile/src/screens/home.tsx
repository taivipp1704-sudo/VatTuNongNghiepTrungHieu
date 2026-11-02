import { useState } from "react";
import { router, Href } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { LandscapeBackground } from "@/components/landscape-background";
import { ProductCard } from "@/components/product-card";
import {
  Button,
  Caption,
  Label,
  Notice,
  Page,
  Panel,
  QueryState,
  Row,
  Toggle,
} from "@/components/ui";
import { AppText } from "@/components/text";
import {
  Icon,
  IconButton,
  IconName,
  SectionHeading,
} from "@/components/pos-ui";
import { RevenueChart } from "@/components/revenue-chart";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { money, number } from "@/lib/format";
import { DataRow, Product } from "@/types";
import { useDraft } from "@/lib/drafts";
import { theme } from "@/theme";

type QuickAction = {
  name: string;
  icon: IconName;
  route: string;
  permission: string;
};
export default function Home() {
  const [hidden, setHidden] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const shortcuts = useDraft("home-shortcuts", () => ({
    hidden: [] as string[],
  }));
  const query = useApi<DataRow>("/dashboard");
  const weekly = useApi<DataRow>("/reports?period=WEEK", can("reports.view"));
  const inventory = useApi<Product[]>("/inventory", can("inventory.view"));
  const data = query.data;
  const actions = (
    [
      {
        name: "Hàng hóa",
        icon: "package-variant-closed",
        route: "/products",
        permission: "inventory.view",
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
        name: "Trả hàng",
        icon: "keyboard-return",
        route: "/orders",
        permission: "sales.return",
      },
      {
        name: "Công nợ",
        icon: "cash-clock",
        route: "/debts",
        permission: "debts.view",
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
      {
        name: "Thêm hàng",
        icon: "package-variant-plus",
        route: "/product-form",
        permission: "products.manage",
      },
    ] satisfies QuickAction[]
  ).filter((item) => can(item.permission));
  return (
    <Page
      background={<LandscapeBackground />}
      onRefresh={() => {
        void query.refetch();
        if (can("reports.view")) void weekly.refetch();
        if (can("inventory.view")) void inventory.refetch();
      }}
      refreshing={query.isRefetching}
    >
      <QueryState query={query} loadingSurface>
        <View
          style={{
            backgroundColor: theme.colors.glassDark,
            borderWidth: 1,
            borderColor: theme.colors.glassBorder,
            borderRadius: theme.radius.lg,
            padding: 18,
            gap: 12,
            overflow: "hidden",
          }}
        >
          <View style={{ gap: 4, paddingBottom: 4 }}>
            <AppText
              variant="heading"
              style={{
                color: theme.colors.onPrimary,
                fontSize: 24,
                lineHeight: 34,
                fontWeight: "700",
              }}
            >
              Hôm nay tại cửa hàng
            </AppText>
            <AppText
              style={{
                color: theme.colors.onHeroMuted,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              Kho hàng, khách hàng và bán tại quầy.
            </AppText>
          </View>
          <Row>
            <AppText
              style={{
                color: theme.colors.onPrimary,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              DOANH THU HÔM NAY
            </AppText>
            <IconButton
              inverse
              name={hidden ? "eye-off-outline" : "eye-outline"}
              label={hidden ? "Hiện doanh thu" : "Ẩn doanh thu"}
              onPress={() => setHidden(!hidden)}
            />
          </Row>
          <AppText
            selectable
            variant="amount"
            style={{
              color: theme.colors.onPrimary,
              fontSize: theme.type.display,
              lineHeight: 44,
              fontWeight: "700",
            }}
          >
            {hidden
              ? "••••••"
              : data?.sales
                ? money(data.sales.revenue)
                : "Theo quyền tài khoản"}
          </AppText>
          {data?.sales ? (
            <View
              style={{
                flexDirection: "row",
                gap: 16,
                borderTopWidth: 1,
                borderTopColor: theme.colors.heroRule,
                paddingTop: 12,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <AppText
                  style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}
                >
                  Tiền thực thu
                </AppText>
                <AppText
                  variant="amount"
                  style={{
                    color: theme.colors.onPrimary,
                    fontSize: 17,
                    fontWeight: "700",
                  }}
                >
                  {hidden ? "•••" : money(data.sales.collected)}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText
                  style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}
                >
                  Đơn bán hôm nay
                </AppText>
                <AppText
                  variant="amount"
                  style={{
                    color: theme.colors.onPrimary,
                    fontSize: 17,
                    fontWeight: "700",
                  }}
                >
                  {hidden ? "—" : number(data.sales.orders)}
                </AppText>
              </View>
            </View>
          ) : null}
          {can("sales.create") ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bán tại quầy"
              onPress={() => router.push("/pos")}
              style={({ pressed }) => ({
                backgroundColor: theme.colors.glassAction,
                borderWidth: 1,
                borderColor: theme.colors.glassBorder,
                opacity: pressed ? 0.8 : 1,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                minHeight: 60,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.buttonFill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="cash-register" size={22} />
              </View>
              <AppText
                variant="heading"
                style={{
                  flex: 1,
                  color: theme.colors.onPrimary,
                  fontWeight: "700",
                  fontSize: 19,
                }}
              >
                Bán tại quầy
              </AppText>
              <Icon name="arrow-right" color={theme.colors.onPrimary} />
            </Pressable>
          ) : null}
          <AppText style={{ color: theme.colors.onHeroMuted, fontSize: 12 }}>
            Bán tại cửa hàng · Cập nhật{" "}
            {data?.updatedAt
              ? new Date(data.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "…"}
          </AppText>
        </View>
        {can("sales.view") ? (
          <Panel glass>
            <Caption>Đơn hàng trong 90 ngày</Caption>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[
                {
                  label: "Đang giao dịch",
                  count: data?.jobs?.unpaid || 0,
                  icon: "cash-clock" as IconName,
                  color: theme.colors.warning,
                  filter: "UNPAID",
                },
                {
                  label: "Hoàn thành",
                  count: data?.jobs?.completed || 0,
                  icon: "check-circle-outline" as IconName,
                  color: theme.colors.success,
                  filter: "PAID",
                },
              ].map((item, index) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() =>
                    router.push(("/orders?filter=" + item.filter) as Href)
                  }
                  style={({ pressed }) => ({
                    flex: 1,
                    borderLeftWidth: index ? 1 : 0,
                    borderLeftColor: theme.colors.border,
                    backgroundColor: pressed
                      ? theme.colors.buttonFill
                      : "transparent",
                    padding: 14,
                    gap: 8,
                    minHeight: 108,
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText
                      variant="amount"
                      style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: theme.colors.text,
                      }}
                    >
                      {hidden ? "—" : number(item.count)}
                    </AppText>
                    <Icon name={item.icon} color={item.color} size={22} />
                  </View>
                  <AppText
                    style={{
                      fontSize: 13,
                      color: theme.colors.muted,
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Panel>
        ) : null}
        <Panel glass>
          <SectionHeading
            title="Thao tác nhanh"
            action={customizing ? "Đóng" : "Tùy chỉnh"}
            onPress={() => setCustomizing(!customizing)}
          />
          {customizing ? (
            <View style={{ gap: 10 }}>
              {actions.map((a) => (
                <Toggle
                  key={a.route}
                  label={a.name}
                  disabled={!shortcuts.ready}
                  value={!(shortcuts.value.hidden ?? []).includes(a.route)}
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
                secondary
                title="Khôi phục tất cả thao tác"
                onPress={() => shortcuts.setValue({ hidden: [] })}
              />
              <Button
                title="Lưu bố cục trên thiết bị"
                disabled={!shortcuts.ready}
                onPress={async () => {
                  if (await shortcuts.save()) setCustomizing(false);
                }}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {actions
              .filter((a) => !(shortcuts.value.hidden ?? []).includes(a.route))
              .map((action) => (
                <Pressable
                  key={action.name}
                  accessibilityRole="button"
                  accessibilityLabel={action.name}
                  onPress={() => router.push(action.route as Href)}
                  style={({ pressed }) => ({
                    flexBasis: "46%",
                    flexGrow: 1,
                    minHeight: 64,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    backgroundColor: pressed
                      ? theme.colors.buttonFill
                      : "transparent",
                    borderRadius: theme.radius.pill,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.buttonFill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={action.icon}
                      size={21}
                      color={theme.colors.primary}
                    />
                  </View>
                  <AppText
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: "600",
                      lineHeight: 19,
                    }}
                  >
                    {action.name}
                  </AppText>
                </Pressable>
              ))}
          </View>
        </Panel>
        {can("inventory.view") ? (
          <Panel glass>
            <SectionHeading
              title="Hàng trong kho"
              action="Xem tất cả"
              onPress={() => router.push("/inventory")}
            />
            <Caption>Ảnh, giá bán và số lượng khả dụng.</Caption>
            <QueryState query={inventory}>
              {inventory.data?.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                >
                  {inventory.data.slice(0, 4).map((product) => (
                    <View key={product.id} style={{ width: 168 }}>
                      <ProductCard
                        product={product}
                        onPress={() =>
                          router.push({
                            pathname: "/product",
                            params: { id: product.id },
                          })
                        }
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Caption>Chưa có hàng hóa trong kho đang chọn.</Caption>
              )}
            </QueryState>
          </Panel>
        ) : null}
        {can("reports.view") && !hidden ? (
          <Panel glass>
            <SectionHeading
              title="Doanh thu tuần này"
              action="Chi tiết"
              onPress={() => router.push("/reports")}
            />
            <QueryState query={weekly}>
              {weekly.data ? (
                <RevenueChart points={weekly.data.series} period="WEEK" />
              ) : null}
            </QueryState>
          </Panel>
        ) : null}
        {can("inventory.view") ? (
          <Panel glass>
            <SectionHeading
              title="Theo dõi kho"
              action="Mở kho"
              onPress={() => router.push("/inventory")}
            />
            <Row>
              <Caption>Phiếu cần duyệt</Caption>
              <Label numeric tone={data?.pending ? "warning" : undefined}>
                {number(data?.pending || 0)}
              </Label>
            </Row>
            <Row>
              <Caption>Lô cận hạn trong 90 ngày</Caption>
              <Label
                numeric
                tone={data?.stock?.expiring ? "warning" : undefined}
              >
                {number(data?.stock?.expiring || 0)}
              </Label>
            </Row>
            <Row>
              <Caption>Lô đã hết hạn</Caption>
              <Label numeric tone={data?.stock?.expired ? "danger" : undefined}>
                {number(data?.stock?.expired || 0)}
              </Label>
            </Row>
          </Panel>
        ) : null}
        {data?.debts && can("debts.view") ? (
          <Panel glass>
            <SectionHeading
              title="Công nợ cửa hàng"
              action="Xem sổ nợ"
              onPress={() => router.push("/debts")}
            />
            <Row>
              <Caption>Phải thu khách hàng</Caption>
              <Label numeric tone="warning">
                {hidden ? "•••" : money(data.debts.receivable)}
              </Label>
            </Row>
            <Row>
              <Caption>Phải trả nhà cung cấp</Caption>
              <Label numeric>
                {hidden ? "•••" : money(data.debts.payable)}
              </Label>
            </Row>
          </Panel>
        ) : null}
      </QueryState>
    </Page>
  );
}
