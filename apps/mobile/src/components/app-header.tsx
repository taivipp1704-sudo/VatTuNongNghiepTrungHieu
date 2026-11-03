import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/lib/api";
import { useSession, userKey } from "@/lib/session";
import { useWarehouse } from "@/lib/warehouse";
import { Bootstrap } from "@/types";
import { Icon } from "./pos-ui";
import { AppText } from "./text";
import { theme } from "@/theme";
export function AppHeader({
  title,
  back,
  onBack,
}: {
  title: string;
  back: boolean;
  onBack: () => void;
}) {
  const session = useSession(),
    scope = useWarehouse(),
    insets = useSafeAreaInsets(),
    path = usePathname();
  const data = useApi<Bootstrap>(
    "/bootstrap",
    !session.user?.mustChangePassword,
  );
  useEffect(() => {
    if (data.data)
      void scope.configure(userKey("active-warehouse"), data.data.warehouses);
  }, [data.data, session.user?.id, session.apiUrl]);
  const warehouse = data.data?.warehouses.find(
    (w) => w.id === scope.warehouseId,
  );
  const home = path === "/",
    report = path === "/reports",
    colored = home || report;
  const foreground = colored ? theme.colors.onPrimary : theme.colors.text;
  const labels: Record<string, string> = {
    "/work": "Đơn hàng",
    "/customers": "Sản phẩm",
    "/more": "Thêm",
    "/sales": "Bán tại quầy",
    "/products": "Sản phẩm",
    "/partners": "Khách hàng",
    "/inventory": "Quản lý kho",
    "/reports": "Báo cáo",
  };
  return (
    <View
      style={{
        paddingTop: session.offline ? 0 : insets.top,
        backgroundColor: home ? theme.colors.landscapeHeader : report ? theme.colors.hero : theme.colors.paper,
        borderBottomWidth: colored ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          height: 58,
          paddingHorizontal: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {home ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn kho làm việc"
            disabled={session.user?.mustChangePassword}
            onPress={() => router.push("/warehouse-picker")}
            style={{
              flex: 1,
              minHeight: 48,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              paddingHorizontal: 8,
            }}
          >
            <Icon name="map-marker" color={foreground} />
            <AppText
              numberOfLines={1}
              style={{ fontSize: 17, color: foreground, flexShrink: 1 }}
            >
              {warehouse?.name || data.data?.store.name || "HTAgri"}
            </AppText>
            <Icon name="chevron-down" color={foreground} size={18} />
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={back ? onBack : () => router.push("/")}
              style={{
                minWidth: 44,
                minHeight: 48,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon
                name="arrow-left"
                color={colored ? foreground : theme.colors.muted}
                size={27}
              />
            </Pressable>
            <AppText
              accessibilityRole="header"
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 19,
                fontWeight: "600",
                color: foreground,
              }}
            >
              {labels[path] || title}
            </AppText>
          </>
        )}
        {!session.user?.mustChangePassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              home ? "Thông báo công việc" : "Tài khoản và cài đặt"
            }
            onPress={() => router.push(home ? "/notifications" : "/more")}
            style={{
              minWidth: 44,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon
              name={home ? "bell-outline" : "dots-vertical"}
              color={foreground}
              size={25}
            />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
    </View>
  );
}
