import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/lib/api";
import { useSession, userKey } from "@/lib/session";
import { useWarehouse } from "@/lib/warehouse";
import { Bootstrap } from "@/types";
import { Avatar, Icon, IconButton } from "./pos-ui";
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
  const session = useSession();
  const scope = useWarehouse();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const data = useApi<Bootstrap>(
    "/bootstrap",
    !session.user?.mustChangePassword,
  );
  useEffect(() => {
    if (data.data)
      void scope.configure(userKey("active-warehouse"), data.data.warehouses);
  }, [data.data, session.user?.id, session.apiUrl]);
  const warehouse = data.data?.warehouses.find(
    (item) => item.id === scope.warehouseId,
  );
  const labels: Record<string, string> = {
    "/": "Tổng quan",
    "/work":
      session.user?.owner || session.user?.permissions.includes("sales.view")
        ? "Đơn hàng"
        : "Hàng hóa",
    "/sales": "Bán hàng",
    "/customers": "Khách hàng",
    "/more": "Thêm",
  };
  return (
    <View
      style={{
        paddingTop: session.offline ? 0 : insets.top,
        backgroundColor: theme.colors.primaryDark,
      }}
    >
      <View
        style={{
          minHeight: 66,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {back ? (
          <IconButton
            name="chevron-left"
            label="Quay lại"
            onPress={onBack}
            inverse
          />
        ) : (
          <View
            style={{
              width: 34,
              height: 38,
              borderRadius: 9,
              backgroundColor: theme.colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name="storefront-outline"
              color={theme.colors.onPrimary}
              size={24}
            />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn kho làm việc"
          disabled={session.user?.mustChangePassword}
          onPress={() => router.push("/warehouse-picker")}
          style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
        >
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <AppText
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "700",
                flexShrink: 1,
                color: theme.colors.onPrimary,
              }}
            >
              {warehouse?.name || data.data?.store.name || "AgriStock"}
            </AppText>
            <Icon
              name="chevron-down"
              size={16}
              color={theme.colors.onHeroMuted}
            />
          </View>
          <AppText
            style={{
              fontSize: 13,
              color: theme.colors.onHeroMuted,
              lineHeight: 20,
            }}
          >
            {labels[path] || title}
          </AppText>
        </Pressable>
        {!session.user?.mustChangePassword ? (
          <>
            <IconButton
              inverse
              name="bell-outline"
              label="Thông báo công việc"
              onPress={() => router.push("/notifications")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tài khoản và cài đặt"
              onPress={() => router.push("/more")}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Avatar name={session.user?.name || "AS"} size={34} inverse />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
