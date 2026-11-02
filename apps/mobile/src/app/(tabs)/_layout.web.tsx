import { Tabs, Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { Icon, IconName } from "@/components/pos-ui";
import { theme } from "@/theme";
export default function WebTabsLayout() {
  const user = useSession((state) => state.user);
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  const allowed = (permission: string) =>
    user.owner || user.permissions.includes(permission);
  const icon = (name: IconName) => (props: { focused: boolean }) => (
    <Icon
      name={name}
      color={props.focused ? theme.colors.primary : theme.colors.text}
      size={23}
    />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarActiveBackgroundColor: theme.colors.buttonFill,
        tabBarInactiveTintColor: theme.colors.text,
        tabBarStyle: {
          height: 68,
          paddingTop: 7,
          paddingBottom: 6,
          backgroundColor: theme.colors.paper,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.font.semibold },
        tabBarItemStyle: {
          borderRadius: theme.radius.pill,
          overflow: "hidden",
          marginHorizontal: 2,
          marginVertical: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tổng quan",
          tabBarIcon: icon("view-dashboard-outline"),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: allowed("sales.view") ? "Đơn hàng" : "Hàng hóa",
          tabBarIcon: icon("receipt-text-outline"),
          href:
            allowed("sales.view") ||
            allowed("inventory.view") ||
            allowed("invoices.view")
              ? undefined
              : null,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Bán hàng",
          tabBarIcon: icon("cash-register"),
          href: allowed("sales.create") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Khách hàng",
          tabBarIcon: icon("account-group-outline"),
          href: allowed("partners.view") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "Thêm", tabBarIcon: icon("menu") }}
      />
      <Tabs.Screen name="finance" options={{ href: null }} />
    </Tabs>
  );
}
