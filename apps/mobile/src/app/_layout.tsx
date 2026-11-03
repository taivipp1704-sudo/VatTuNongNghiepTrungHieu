import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { AppText as Text } from "@/components/text";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/theme";
import { useFonts } from "expo-font";
import { AppHeader } from "@/components/app-header";
import { useWarehouse } from "@/lib/warehouse";
import { api, queryClient } from "@/lib/api";
import { useSession } from "@/lib/session";
import { SessionUser } from "@/types";

const titles: Record<string, string> = {
  "/": "HTAgri",
  "/inventory": "Kho hàng",
  "/products": "Sản phẩm & kho hàng",
  "/barcode-labels": "In tem mã vạch",
  "/pos": "Bán hàng nhanh",
  "/debts": "Công nợ",
  "/more": "Cá nhân & công việc",
  "/orders": "Đơn bán",
  "/documents": "Nhập · Xuất · Kiểm kê",
  "/invoices": "Chứng từ bán hàng",
  "/scan": "Quét mã sản phẩm",
  "/stock-form": "Tạo phiếu kho",
  "/product": "Chi tiết hàng hóa",
  "/product-form": "Thông tin hàng hóa",
  "/loyalty": "Tích điểm khách hàng",
  "/customer-loyalty": "Điểm & lịch sử khách hàng",
  "/warehouse-picker": "Chọn kho làm việc",
  "/notifications": "Công việc cần xử lý",
  "/connections": "Kết nối & thiết bị",
  "/partners": "Khách hàng & nhà cung cấp",
  "/admin": "Quản trị nội bộ",
  "/settings": "Cửa hàng & bảo mật",
  "/reports": "Doanh thu cửa hàng",
  "/change-password": "Đổi mật khẩu",
};
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "BeVietnamPro-Regular": require("../../assets/fonts/BeVietnamPro-Regular.ttf"),
    "BeVietnamPro-Medium": require("../../assets/fonts/BeVietnamPro-Medium.ttf"),
    "BeVietnamPro-SemiBold": require("../../assets/fonts/BeVietnamPro-SemiBold.ttf"),
    "BeVietnamPro-Bold": require("../../assets/fonts/BeVietnamPro-Bold.ttf"),
    "Inter-Regular": require("../../assets/fonts/Inter-Regular.ttf"),
    "Inter-Bold": require("../../assets/fonts/Inter-Bold.ttf"),
  });
  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);
  const { ready, user, offline } = useSession();
  useEffect(() => {
    if (!user)
      useWarehouse.setState({ warehouseId: "", namespace: "", ready: false });
  }, [user?.id]);
  const pathname = usePathname();
  useEffect(() => {
    useSession.getState().hydrate();
  }, []);
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const refresh = () => {
      if (AppState.currentState !== "active" && process.env.EXPO_OS !== "web")
        return;
      api<SessionUser>("/me")
        .then((next) => {
          const old = useSession.getState().user;
          if (JSON.stringify(old) !== JSON.stringify(next)) {
            queryClient.clear();
            useSession.getState().setUser(next);
          }
          void queryClient.invalidateQueries({ refetchType: "active" });
        })
        .catch(() => {});
    };
    const interval = setInterval(refresh, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [user?.id, user?.mustChangePassword]);
  if (!ready || !fontsLoaded)
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: theme.colors.canvas,
          }}
        >
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={user && !offline && (pathname === "/" || pathname === "/reports") ? "light" : "dark"} />
        {offline && user ? (
          <SafeAreaView
            edges={["top"]}
            style={{
              backgroundColor: theme.colors.warningBg,
            }}
          >
            <View style={{ padding: theme.space.sm }}>
              <Text
                style={{
                  fontSize: theme.type.caption,
                  lineHeight: 20,
                  color: theme.colors.warning,
                  textAlign: "center",
                }}
              >
                Mất kết nối · Chỉ lưu bản nháp, chưa ghi nhận kho hoặc tiền
              </Text>
            </View>
          </SafeAreaView>
        ) : null}
        <Stack
          screenOptions={{
            header: ({ options, navigation, back }) => (
              <AppHeader
                title={String(options.title || "HTAgri")}
                back={Boolean(back) && options.headerBackVisible !== false}
                onBack={() => navigation.goBack()}
              />
            ),
            headerStyle: { backgroundColor: theme.colors.canvas },
            headerTintColor: theme.colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.canvas },
            headerTitleStyle: {
              fontSize: theme.type.heading,
              fontWeight: "600",
            },
          }}
        >
          <Stack.Protected guard={!user}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={Boolean(user)}>
            <Stack.Screen
              name="change-password"
              options={{
                title: "Đổi mật khẩu",
                headerBackVisible: !user?.mustChangePassword,
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={Boolean(user && !user.mustChangePassword)}>
            <Stack.Screen
              name="(tabs)"
              options={{
                title:
                  titles[pathname] ||
                  (pathname === "/work"
                    ? user?.owner || user?.permissions.includes("users.manage")
                      ? "Kho hàng"
                      : user?.permissions.includes("sales.create")
                        ? "Đơn bán"
                        : user?.permissions.includes("invoices.view")
                          ? "Chứng từ bán hàng"
                          : "Kho hàng"
                    : pathname === "/sales"
                      ? user?.permissions.includes("sales.create")
                        ? "Bán hàng nhanh"
                        : "Lịch sử kho"
                      : pathname === "/finance"
                        ? "Công nợ"
                        : "HTAgri"),
              }}
            />
            {[
              "scan",
              "stock-form",
              "product",
              "product-form",
              "products",
              "barcode-labels",
              "loyalty",
              "customer-loyalty",
              "warehouse-picker",
              "notifications",
              "connections",
              "partners",
              "admin",
              "settings",
              "reports",
              "inventory",
              "pos",
              "documents",
              "orders",
              "invoices",
              "debts",
            ].map((name) => (
              <Stack.Screen
                key={name}
                name={name}
                options={{ title: titles["/" + name] }}
              />
            ))}
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
