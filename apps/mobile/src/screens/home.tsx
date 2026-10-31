import { useState } from "react";
import { router, Href } from "expo-router";
import { Pressable, View } from "react-native";
import {
  Badge,
  Caption,
  Label,
  Page,
  Panel,
  QueryState,
  Row,
} from "@/components/ui";
import { AppText } from "@/components/text";
import {
  Icon,
  IconButton,
  IconName,
  SectionHeading,
} from "@/components/pos-ui";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { money, number } from "@/lib/format";
import { DataRow } from "@/types";
import { theme } from "@/theme";
export default function Home() {
  const [hidden, setHidden] = useState(false);
  const query = useApi<DataRow>("/dashboard");
  const data = query.data;
  const actions: {
    name: string;
    icon: IconName;
    route: string;
    permission?: string;
    green?: boolean;
  }[] = [
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
      name: "Hàng hóa",
      icon: "package-variant-closed",
      route: "/inventory",
      permission: "inventory.view",
    },
    {
      name: "Chứng từ bán",
      icon: "receipt-text-outline",
      route: "/invoices",
      permission: "invoices.view",
    },
    {
      name: "Công nợ",
      icon: "cash-multiple",
      route: "/debts",
      permission: "debts.view",
      green: true,
    },
    {
      name: can("loyalty.manage") ? "Tích điểm thưởng" : "Khách hàng",
      icon: "tag-outline",
      route: can("loyalty.manage") ? "/loyalty" : "/partners",
      permission: can("loyalty.manage") ? "loyalty.manage" : "partners.view",
      green: true,
    },
    {
      name: "Báo cáo",
      icon: "chart-bar",
      route: "/reports",
      permission: "reports.view",
    },
    { name: "Kết nối / in", icon: "printer-outline", route: "/connections" },
    {
      name: "Phân quyền",
      icon: "account-lock-outline",
      route: "/admin?tab=roles",
      permission: "roles.manage",
    },
    { name: "Xem thêm", icon: "view-grid-outline", route: "/more" },
  ]
    .filter((item) => !item.permission || can(item.permission))
    .slice(0, 8) as {
    name: string;
    icon: IconName;
    route: string;
    permission?: string;
    green?: boolean;
  }[];
  const jobs = [
    {
      name: "Chờ duyệt phiếu kho",
      icon: "clipboard-check-outline",
      count: data?.pending,
      route: "/documents",
      permission: "inventory.view",
    },
    {
      name: "Chờ thanh toán",
      icon: "cash-clock",
      count: data?.jobs?.unpaid,
      route: "/orders?filter=UNPAID",
      permission: "sales.view",
    },
    {
      name: "Chờ đóng gói",
      icon: "package-variant",
      count: data?.jobs?.pack,
      route: "/orders?filter=PENDING_PACK",
      permission: "sales.view",
    },
    {
      name: "Chờ bàn giao",
      icon: "account-arrow-right-outline",
      count: data?.jobs?.handover,
      route: "/orders?filter=PENDING_HANDOVER",
      permission: "sales.view",
    },
    {
      name: "Đang giao hàng",
      icon: "truck-outline",
      count: data?.jobs?.shipping,
      route: "/orders?filter=SHIPPING",
      permission: "sales.view",
    },
    {
      name: "Đơn đã trả hàng",
      icon: "package-variant-remove",
      count: data?.jobs?.returned,
      route: "/orders?filter=RETURNED",
      permission: "sales.view",
    },
  ].filter((item) => can(item.permission));
  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <QueryState query={query}>
        <Panel>
          <Row>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: theme.colors.muted,
              }}
            >
              DOANH THU NGÀY
            </AppText>
            <IconButton
              name={hidden ? "eye-off-outline" : "eye-outline"}
              label={hidden ? "Hiện doanh thu" : "Ẩn doanh thu"}
              onPress={() => setHidden(!hidden)}
            />
          </Row>
          <AppText
            selectable
            style={{
              fontSize: 30,
              lineHeight: 42,
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
          <Caption>
            {data?.updatedAt
              ? "Cập nhật " +
                new Date(data.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Đang tải dữ liệu cửa hàng"}
          </Caption>
          {data?.sales ? (
            <View
              style={{
                flexDirection: "row",
                padding: 14,
                backgroundColor: theme.colors.soft,
                borderRadius: theme.radius.md,
                gap: 10,
              }}
            >
              {[
                { label: "Đơn hôm nay", value: data.sales.orders },
                { label: "Chưa thu (90 ngày)", value: data.jobs?.unpaid || 0 },
                { label: "Đã trả (90 ngày)", value: data.jobs?.returned || 0 },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{ flex: 1, gap: 8, alignItems: "center" }}
                >
                  <AppText
                    style={{
                      fontSize: 11,
                      color: theme.colors.muted,
                      textAlign: "center",
                      lineHeight: 18,
                    }}
                  >
                    {item.label}
                  </AppText>
                  <Label big>{hidden ? "—" : number(item.value)}</Label>
                </View>
              ))}
            </View>
          ) : (
            <Caption>
              Tồn kho và công việc hiển thị theo phạm vi được cấp.
            </Caption>
          )}
        </Panel>
        {can("sales.create") ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              {
                title: "Bán giao hàng",
                sub: "Tạo đơn giao",
                icon: "truck-fast-outline",
                bg: theme.colors.primary,
                route: "/pos?delivery=1",
              },
              {
                title: "Bán tại quầy",
                sub: "Thu ngân POS",
                icon: "storefront-outline",
                bg: theme.colors.success,
                route: "/pos",
              },
            ].map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.title}
                onPress={() => router.push(item.route as Href)}
                style={{
                  flex: 1,
                  minHeight: 84,
                  borderRadius: 16,
                  backgroundColor: item.bg,
                  padding: 12,
                  gap: 6,
                }}
              >
                <Icon
                  name={item.icon as IconName}
                  color={theme.colors.onPrimary}
                  size={24}
                />
                <AppText
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: theme.colors.onPrimary,
                  }}
                >
                  {item.title}
                </AppText>
                <AppText
                  style={{
                    fontSize: 11,
                    lineHeight: 16,
                    color: theme.colors.onPrimary,
                  }}
                >
                  {item.sub}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        <SectionHeading
          title="Thao tác nhanh"
          action="Tất cả"
          onPress={() => router.push("/more")}
        />
        <Panel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {actions.map((item) => (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                onPress={() => router.push(item.route as Href)}
                style={{
                  flexBasis: "21%",
                  flexGrow: 1,
                  minWidth: 58,
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 6,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 23,
                    backgroundColor: item.green
                      ? theme.colors.successBg
                      : theme.colors.blueLight,
                  }}
                >
                  <Icon
                    name={item.icon}
                    color={
                      item.green ? theme.colors.success : theme.colors.primary
                    }
                  />
                </View>
                <AppText
                  style={{ fontSize: 12, lineHeight: 19, textAlign: "center" }}
                >
                  {item.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Panel>
        <SectionHeading title="Công việc chờ xử lý" />
        <Caption>
          Đơn hàng trong 90 ngày gần nhất · Phiếu kho đang chờ duyệt
        </Caption>
        <Panel>
          {jobs.map((job) => (
            <Pressable
              key={job.name}
              accessibilityRole="button"
              onPress={() => router.push(job.route as Href)}
              style={{
                minHeight: 58,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View
                style={{
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: theme.colors.soft,
                }}
              >
                <Icon name={job.icon as IconName} />
              </View>
              <AppText style={{ flex: 1, fontSize: 14 }}>{job.name}</AppText>
              <AppText
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: job.count ? theme.colors.primary : theme.colors.muted,
                }}
              >
                {number(job.count || 0)}
              </AppText>
              <Icon name="chevron-right" color={theme.colors.muted} size={18} />
            </Pressable>
          ))}
        </Panel>
        {data?.stock ? (
          <Panel>
            <SectionHeading title="Theo dõi kho" />
            <Row>
              <Caption>Lô hết hạn trong 90 ngày</Caption>
              <Badge
                label={number(data.stock.expiring)}
                tone={data.stock.expiring ? "warning" : "neutral"}
              />
            </Row>
            <Row>
              <Caption>Lô đã hết hạn</Caption>
              <Badge
                label={number(data.stock.expired)}
                tone={data.stock.expired ? "danger" : "neutral"}
              />
            </Row>
          </Panel>
        ) : null}
      </QueryState>
    </Page>
  );
}
