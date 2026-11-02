import { Tabs, Redirect, router, Href } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Icon, IconName } from "./pos-ui";
import { AppText } from "./text";
import { theme } from "@/theme";
export default function StoreTabs() {
  const user = useSession((s) => s.user),
    insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password" />;
  const allowed = (p: string) => user.owner || user.permissions.includes(p);
  const entries = [
    { route: "index", label: "Tổng quan", icon: "home-outline" as IconName },
    ...(allowed("sales.view") ||
    allowed("inventory.view") ||
    allowed("invoices.view")
      ? [
          {
            route: "work",
            label: allowed("sales.view") ? "Đơn hàng" : "Hàng hóa",
            icon: "clipboard-text-outline" as IconName,
          },
        ]
      : []),
    ...(allowed("sales.create")
      ? [
          {
            route: "sales",
            label: "Bán hàng",
            icon: "cash-register" as IconName,
          },
        ]
      : []),
    ...(allowed("inventory.view")
      ? [
          {
            route: "customers",
            label: "Sản phẩm",
            icon: "package-variant-closed" as IconName,
          },
        ]
      : []),
    { route: "more", label: "Thêm", icon: "dots-grid" as IconName },
  ];
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => (
        <View
          style={{
            paddingTop: 5,
            paddingBottom: Math.max(insets.bottom, 7),
            backgroundColor: theme.colors.paper,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            flexDirection: "row",
          }}
        >
          {entries.map((entry) => {
            const selected = state.routes[state.index]?.name === entry.route;
            return (
              <Pressable
                key={entry.route}
                accessibilityRole="tab"
                accessibilityLabel={entry.label}
                accessibilityState={{ selected }}
                onPress={() =>
                  entry.route === "sales"
                    ? router.push("/pos")
                    : router.navigate(
                        (entry.route === "index"
                          ? "/"
                          : "/" + entry.route) as Href,
                      )
                }
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 55,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon
                  name={entry.icon}
                  size={25}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                <AppText
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    lineHeight: 17,
                    fontWeight: selected ? "600" : "400",
                    color: selected ? theme.colors.primary : theme.colors.muted,
                  }}
                >
                  {entry.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="work" />
      <Tabs.Screen name="sales" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="finance" options={{ href: null }} />
    </Tabs>
  );
}
