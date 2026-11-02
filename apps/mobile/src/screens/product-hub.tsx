import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Denied, Page } from "@/components/ui";
import { StoreRow } from "@/components/store-ui";
import { AppText } from "@/components/text";
import { Icon } from "@/components/pos-ui";
import { can } from "@/lib/session";
import { theme } from "@/theme";
export default function ProductHub() {
  if (!can("inventory.view")) return <Denied />;
  return (
    <Page edgeToEdge>
      {can("products.manage") && can("inventory.cost.view") ? (
        <View style={{ paddingHorizontal: 28, paddingTop: 28 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm sản phẩm"
            onPress={() => router.push("/product-form")}
            style={({ pressed }) => ({
              height: 152,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.soft : theme.colors.paper,
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            })}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: theme.colors.buttonFill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="plus" color={theme.colors.primary} size={30} />
            </View>
            <AppText style={{ fontSize: 19, fontWeight: "600" }}>
              Thêm sản phẩm
            </AppText>
          </Pressable>
        </View>
      ) : null}
      <View style={{ gap: 0, marginTop: -12 }}>
        <StoreRow
          title="Danh sách sản phẩm"
          icon="package-variant-closed"
          onPress={() => router.push("/inventory")}
        />
        {can("inventory.receipt.create") ? (
          <StoreRow
            title="Nhập hàng"
            icon="clipboard-edit-outline"
            onPress={() => router.push("/stock-form?kind=RECEIPT")}
          />
        ) : null}
        {can("inventory.count.create") ? (
          <StoreRow
            title="Kiểm hàng"
            icon="checkbox-marked-outline"
            onPress={() => router.push("/stock-form?kind=COUNT")}
          />
        ) : null}
        {can("partners.view") ? (
          <StoreRow
            title="Nhà cung cấp"
            icon="account"
            onPress={() => router.push("/partners?kind=SUPPLIER")}
          />
        ) : null}
        <StoreRow
          title="In tem mã vạch"
          icon="barcode"
          onPress={() => router.push("/barcode-labels")}
        />
        <StoreRow
          title="Phiếu kho & lịch sử"
          icon="history"
          onPress={() => router.push("/documents")}
        />
        {can("reports.view") ? (
          <StoreRow
            title="Báo cáo nhập xuất tồn"
            icon="chart-box-outline"
            onPress={() => router.push("/reports?section=inventory")}
          />
        ) : null}
      </View>
    </Page>
  );
}
