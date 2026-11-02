import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Icon } from "./pos-ui";
import { AppText } from "./text";
import { CustomerProfile } from "./customer-profile";
import { can } from "@/lib/session";
import { Partner } from "@/types";
import { theme } from "@/theme";
export function CustomerDetail({
  partner,
  onBack,
}: {
  partner: Partner;
  onBack: () => void;
}) {
  const [editRequested, setEditRequested] = useState(0);
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.paper }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách khách hàng"
          onPress={onBack}
          style={{
            width: 44,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chevron-left" color={theme.colors.muted} size={31} />
        </Pressable>
        <AppText
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 18,
            fontWeight: "600",
          }}
        >
          {partner.profile?.code || "KH" + partner.id.slice(0, 6).toUpperCase()}
        </AppText>
        {can("sales.create") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo đơn bán cho khách"
            onPress={() =>
              router.push({
                pathname: "/pos",
                params: { customerId: partner.id },
              })
            }
            style={{
              width: 44,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="plus" color={theme.colors.muted} size={27} />
          </Pressable>
        ) : null}
        {can("partners.manage") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
            onPress={() => setEditRequested((v) => v + 1)}
            style={{
              width: 44,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="pencil-outline" color={theme.colors.muted} size={25} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: 32,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View
          style={{
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.colors.profileAvatar,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="account" color={theme.colors.onPrimary} size={37} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <AppText
              style={{ fontSize: 18, lineHeight: 26, fontWeight: "600" }}
            >
              {partner.name}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gọi khách hàng"
              disabled={!partner.phone}
              onPress={() => void Linking.openURL("tel:" + partner.phone)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 28,
              }}
            >
              <Icon name="phone" color={theme.colors.primary} size={19} />
              <AppText style={{ fontSize: 15, color: theme.colors.primary }}>
                {partner.phone || "---"}
              </AppText>
            </Pressable>
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <Icon
                name="email-outline"
                color={theme.colors.control}
                size={19}
              />
              <AppText style={{ fontSize: 14, color: theme.colors.muted }}>
                {partner.profile?.email || "---"}
              </AppText>
            </View>
          </View>
        </View>
        <CustomerProfile partner={partner} editRequested={editRequested} />
      </ScrollView>
    </SafeAreaView>
  );
}
