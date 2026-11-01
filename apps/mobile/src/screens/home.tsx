import { useState } from "react";
import { router, Href } from "expo-router";
import { Pressable, View } from "react-native";
import { Caption, Label, Page, Panel, QueryState, Row } from "@/components/ui";
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
import { DataRow } from "@/types";
import { theme } from "@/theme";

export default function Home() {
  const [hidden, setHidden] = useState(false);
  const query = useApi<DataRow>("/dashboard");
  const weekly = useApi<DataRow>("/reports?period=WEEK", can("reports.view"));
  const data = query.data;
  const actions: {
    name: string;
    icon: IconName;
    route: string;
    permission?: string;
  }[] = [
    {
      name: "Nhập hàng",
      icon: "cart-arrow-down",
      route: "/stock-form?kind=RECEIPT",
      permission: "inventory.receipt.create",
    },
    {
      name: "Hàng hóa",
      icon: "package-variant-closed",
      route: "/inventory",
      permission: "inventory.view",
    },
    {
      name: "Trả hàng",
      icon: "keyboard-return",
      route: "/orders",
      permission: "sales.return",
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
      name: "Tích điểm",
      icon: "star-circle-outline",
      route: "/loyalty",
      permission: "loyalty.manage",
    },
    {
      name: "Báo cáo",
      icon: "chart-bar",
      route: "/reports",
      permission: "reports.view",
    },
    {
      name: "Thêm hàng",
      icon: "package-variant-plus",
      route: "/product-form",
      permission: "products.manage",
    },
  ].filter((item) => !item.permission || can(item.permission)) as {
    name: string;
    icon: IconName;
    route: string;
    permission?: string;
  }[];
  return (
    <Page
      onRefresh={() => {
        void query.refetch();
        if (can("reports.view")) void weekly.refetch();
      }}
      refreshing={query.isRefetching}
    >
      <QueryState query={query}>
        <View
          style={{
            backgroundColor: theme.colors.hero,
            borderRadius: 24,
            padding: 20,
            gap: 13,
          }}
        >
          <Row>
            <AppText
              style={{
                color: theme.colors.onHeroMuted,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              DOANH THU HÔM NAY
            </AppText>
            <IconButton
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
              lineHeight: 43,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {hidden
              ? "••••••"
              : data?.sales
                ? money(data.sales.revenue)
                : "Theo quyền tài khoản"}
          </AppText>
          {data?.sales ? (
            <Row>
              <AppText
                style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}
              >
                Thực thu {hidden ? "•••" : money(data.sales.collected)}
              </AppText>
              <AppText
                style={{ color: theme.colors.onHeroMuted, fontSize: 13 }}
              >
                {number(data.sales.orders)} đơn bán
              </AppText>
            </Row>
          ) : null}
          <AppText style={{ color: theme.colors.onHeroMuted, fontSize: 12 }}>
            Bán tại quầy · Cập nhật{" "}
            {data?.updatedAt
              ? new Date(data.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "…"}
          </AppText>
        </View>
        {can("sales.create") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bán tại quầy"
            onPress={() => router.push("/pos")}
            style={({ pressed }) => ({
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.8 : 1,
              borderRadius: theme.radius.lg,
              padding: 18,
              flexDirection: "row",
              gap: 14,
              alignItems: "center",
              minHeight: 78,
            })}
          >
            <Icon
              name="cash-register"
              size={30}
              color={theme.colors.onPrimary}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText
                style={{
                  color: theme.colors.onPrimary,
                  fontWeight: "700",
                  fontSize: 20,
                }}
              >
                Bán tại quầy
              </AppText>
              <AppText style={{ color: theme.colors.onPrimary, fontSize: 13 }}>
                Chọn hàng, chọn khách và thanh toán
              </AppText>
            </View>
            <Icon name="arrow-right" color={theme.colors.onPrimary} />
          </Pressable>
        ) : null}
        {can("sales.view") ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              {
                label: "Đang giao dịch",
                count: data?.jobs?.unpaid || 0,
                icon: "cash-clock" as IconName,
                color: theme.colors.warning,
                background: theme.colors.warningBg,
                filter: "UNPAID",
              },
              {
                label: "Hoàn thành",
                count: data?.jobs?.completed || 0,
                icon: "check-circle-outline" as IconName,
                color: theme.colors.success,
                background: theme.colors.successBg,
                filter: "PAID",
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() =>
                  router.push(("/orders?filter=" + item.filter) as Href)
                }
                style={{
                  flex: 1,
                  borderRadius: theme.radius.lg,
                  backgroundColor: item.background,
                  padding: 16,
                  gap: 8,
                  minHeight: 120,
                }}
              >
                <Icon name={item.icon} color={item.color} />
                <AppText
                  style={{ fontSize: 26, fontWeight: "700", color: item.color }}
                >
                  {hidden ? "—" : number(item.count)}
                </AppText>
                <AppText
                  style={{ fontSize: 13, color: item.color, fontWeight: "600" }}
                >
                  {item.label}
                </AppText>
                <AppText style={{ fontSize: 12, color: item.color }}>
                  Đơn trong 90 ngày
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        <SectionHeading
          title="Thao tác tại cửa hàng"
          action="Xem thêm"
          onPress={() => router.push("/more")}
        />
        <Panel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 18 }}>
            {actions.map((action) => (
              <Pressable
                key={action.name}
                accessibilityRole="button"
                onPress={() => router.push(action.route as Href)}
                style={({ pressed }) => ({
                  width: "25%",
                  alignItems: "center",
                  gap: 8,
                  opacity: pressed ? 0.6 : 1,
                  minHeight: 78,
                  paddingHorizontal: 3,
                })}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor:
                      action.route === "/reports" ||
                      action.route === "/partners"
                        ? theme.colors.infoBg
                        : action.route === "/orders" ||
                            action.route === "/loyalty" ||
                            action.route === "/debts"
                          ? theme.colors.accentSoft
                          : theme.colors.soft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={action.icon}
                    size={23}
                    color={
                      action.route === "/reports" ||
                      action.route === "/partners"
                        ? theme.colors.info
                        : action.route === "/orders" ||
                            action.route === "/loyalty" ||
                            action.route === "/debts"
                          ? theme.colors.accent
                          : theme.colors.primary
                    }
                  />
                </View>
                <AppText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    textAlign: "center",
                    lineHeight: 19,
                  }}
                >
                  {action.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Panel>
        {can("reports.view") && !hidden ? (
          <Panel>
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
          <Panel>
            <SectionHeading
              title="Theo dõi kho"
              action="Mở kho"
              onPress={() => router.push("/inventory")}
            />
            <Row>
              <Caption>Phiếu cần duyệt</Caption>
              <Label>{number(data?.pending || 0)}</Label>
            </Row>
            <Row>
              <Caption>Lô cận hạn trong 90 ngày</Caption>
              <Label>{number(data?.stock?.expiring || 0)}</Label>
            </Row>
            <Row>
              <Caption>Lô đã hết hạn</Caption>
              <Label>{number(data?.stock?.expired || 0)}</Label>
            </Row>
          </Panel>
        ) : null}
        {data?.debts && can("debts.view") ? (
          <Panel>
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
