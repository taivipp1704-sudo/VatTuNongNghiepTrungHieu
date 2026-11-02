import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Product } from "@/types";
import { theme } from "@/theme";
import { money, number } from "@/lib/format";
import { rateLabel } from "@/lib/loyalty";
import { AppText } from "./text";
import { Icon } from "./pos-ui";
import { PhotoImage } from "./private-photo";

export function ProductCover({
  product,
  height = 112,
}: {
  product: Pick<Product, "name" | "category" | "image_url">;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_url]);
  return (
    <View
      style={{
        height,
        backgroundColor: theme.colors.soft,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {product.image_url && !failed ? (
        <PhotoImage
          uri={product.image_url}
          label={product.name}
          width="100%"
          height={height}
          contain
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={{ alignItems: "center", gap: 3 }}>
          <Icon
            name={
              product.category === "Phân bón"
                ? "sprout"
                : product.category.includes("Thuốc")
                  ? "bottle-tonic-plus-outline"
                  : product.category === "Hạt giống"
                    ? "seed-outline"
                    : "package-variant-closed"
            }
            size={44}
            color={theme.colors.primary}
          />
          <AppText style={{ color: theme.colors.muted, fontSize: 12 }}>
            Chưa có ảnh
          </AppText>
        </View>
      )}
    </View>
  );
}

export function ProductCard({
  product,
  onPress,
  onEditRate,
}: {
  product: Product;
  onPress: () => void;
  onEditRate?: () => void;
}) {
  const empty = product.available <= 0;
  const low = empty || product.available < product.min_stock;
  return (
    <View
      style={{
        flexGrow: 1,
        backgroundColor: theme.colors.paper,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Xem " + product.name}
        onPress={onPress}
        style={({ pressed }) => ({ flexGrow: 1, opacity: pressed ? 0.7 : 1 })}
      >
        <ProductCover product={product} />
        <View style={{ padding: 12, gap: 5 }}>
          <AppText
            numberOfLines={1}
            style={{ fontSize: 12, color: theme.colors.muted }}
          >
            {product.sku}
          </AppText>
          <AppText
            numberOfLines={2}
            style={{
              fontSize: 15,
              lineHeight: 21,
              minHeight: 42,
              fontWeight: "600",
            }}
          >
            {product.name}
          </AppText>
          <AppText
            variant="amount"
            style={{
              fontSize: 17,
              lineHeight: 25,
              fontWeight: "700",
              color: theme.colors.text,
            }}
          >
            {money(product.price_pack)}
          </AppText>
          <AppText style={{ fontSize: 12, color: theme.colors.muted }}>
            / {product.pack_unit}
          </AppText>
          <AppText
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: low ? theme.colors.warning : theme.colors.success,
              fontWeight: "600",
            }}
          >
            Tồn {number(product.available / product.pack_factor)}{" "}
            {product.pack_unit}
            {empty ? " · Hết hàng" : low ? " · Tồn thấp" : ""}
          </AppText>
        </View>
      </Pressable>
      {onEditRate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Sửa số chấm " + product.sku}
          onPress={onEditRate}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 12,
            backgroundColor: theme.colors.soft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AppText
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 18,
              color: theme.colors.primary,
              fontWeight: "600",
            }}
          >
            Số chấm {rateLabel(product.loyalty_rate)}
          </AppText>
          <Icon name="pencil-outline" size={17} />
        </Pressable>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <AppText style={{ fontSize: 12, color: theme.colors.muted }}>
            Số chấm {rateLabel(product.loyalty_rate)}
          </AppText>
        </View>
      )}
    </View>
  );
}
