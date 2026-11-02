import { NativeTabs } from "expo-router/native-tabs";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { theme } from "@/theme";
export default function TabsLayout() {
  const user = useSession((state) => state.user);
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  const allowed = (permission: string) =>
    user.owner || user.permissions.includes(permission);
  return (
    <NativeTabs
      backgroundColor={theme.colors.paper}
      tintColor={theme.colors.primary}
      indicatorColor={theme.colors.buttonFill}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Tổng quan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="dashboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="work"
        hidden={
          !allowed("sales.view") &&
          !allowed("inventory.view") &&
          !allowed("invoices.view")
        }
      >
        <NativeTabs.Trigger.Label>
          {allowed("sales.view") ? "Đơn hàng" : "Hàng hóa"}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sales" hidden={!allowed("sales.create")}>
        <NativeTabs.Trigger.Label>Bán hàng</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="cart" md="point_of_sale" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers" hidden={!allowed("partners.view")}>
        <NativeTabs.Trigger.Label>Khách hàng</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>Thêm</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="line.3.horizontal" md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
