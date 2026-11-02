import { ComponentProps, PropsWithChildren, useState, useEffect } from "react";
import { PhotoImage } from "./private-photo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, ScrollView, View } from "react-native";
import { AppText } from "./text";
import { theme } from "@/theme";
import { Product } from "@/types";
import { rateLabel } from "@/lib/loyalty";
export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
export function Icon({
  name,
  size = 22,
  color = theme.colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
  inverse = false,
  selected,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  inverse?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        ...(selected === undefined ? {} : { selected }),
        disabled,
      }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        borderRadius: theme.radius.md,
        backgroundColor: selected
          ? theme.colors.highlight
          : inverse
            ? theme.colors.headerControl
            : theme.colors.soft,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Icon
        name={name}
        color={
          selected
            ? theme.colors.onHighlight
            : inverse
              ? theme.colors.onPrimary
              : theme.colors.primary
        }
      />
    </Pressable>
  );
}
export function Avatar({
  name,
  size = 44,
  inverse = false,
}: {
  name: string;
  size?: number;
  inverse?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: inverse ? theme.colors.paper : theme.colors.blueLight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText
        style={{
          fontSize: size / 3,
          fontWeight: "700",
          color: theme.colors.primary,
        }}
      >
        {name
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((s) => s[0])
          .join("")
          .toUpperCase()}
      </AppText>
    </View>
  );
}
export function ProductPicture({
  product,
  size = 64,
}: {
  product: Pick<Product, "name" | "category"> & { image_url?: string };
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_url]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.soft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {product.image_url && !failed ? (
        <PhotoImage
          uri={product.image_url}
          label={product.name || "Ảnh hàng hóa"}
          width={size}
          height={size}
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon
          name={
            product.category === "Phân bón"
              ? "sprout"
              : product.category.includes("Thuốc")
                ? "bottle-tonic-plus-outline"
                : product.category === "Hạt giống"
                  ? "seed-outline"
                  : "package-variant"
          }
          size={Math.round(size * 0.48)}
          color={
            product.category === "Phân bón"
              ? theme.colors.success
              : theme.colors.primary
          }
        />
      )}
    </View>
  );
}
export function ChipTabs({
  value,
  onChange,
  items,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: compact ? 4 : 8,
        paddingVertical: 2,
        ...(compact ? { flexGrow: 1 } : {}),
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.value }}
          aria-selected={value === item.value}
          onPress={() => onChange(item.value)}
          style={{
            minHeight: 44,
            minWidth: compact ? 44 : undefined,
            flex: compact ? 1 : undefined,
            paddingHorizontal: compact ? 4 : 16,
            borderRadius: theme.radius.pill,
            backgroundColor:
              value === item.value
                ? theme.colors.highlight
                : theme.colors.paper,
            borderWidth: 1,
            borderColor:
              value === item.value ? theme.colors.primary : theme.colors.border,
            justifyContent: "center",
          }}
        >
          <AppText
            style={{
              fontSize: compact ? 12 : 13,
              textAlign: "center",
              fontWeight: "600",
              color:
                value === item.value
                  ? theme.colors.onHighlight
                  : theme.colors.text,
            }}
          >
            {item.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function RateChip({
  rate,
  children,
}: { rate: number } & PropsWithChildren) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        backgroundColor: rate ? theme.colors.successBg : theme.colors.neutral,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Icon
        name={rate ? "plus-circle-outline" : "minus-circle-outline"}
        size={13}
        color={rate ? theme.colors.success : theme.colors.muted}
      />
      <AppText
        style={{
          fontSize: 12,
          lineHeight: 18,
          color: rate ? theme.colors.success : theme.colors.muted,
          fontWeight: "600",
        }}
      >
        Số chấm: {rateLabel(rate)}
        {children}
      </AppText>
    </View>
  );
}
export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <AppText
        variant="heading"
        style={{ fontSize: 18, lineHeight: 26, fontWeight: "700", flex: 1 }}
      >
        {title}
      </AppText>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: theme.colors.primary,
            }}
          >
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
export function ChoiceList({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; title: string; description?: string }[];
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ gap: 6 }}
    >
      {options.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="radio"
          accessibilityLabel={item.title}
          accessibilityState={{ checked: value === item.value, disabled }}
          disabled={disabled}
          onPress={() => onChange(item.value)}
          style={{
            flexDirection: "row",
            gap: 8,
            minHeight: 50,
            padding: 10,
            borderRadius: 10,
            backgroundColor:
              value === item.value ? theme.colors.soft : theme.colors.paper,
            alignItems: "flex-start",
          }}
        >
          <Icon
            name={value === item.value ? "radiobox-marked" : "radiobox-blank"}
            size={19}
            color={
              value === item.value ? theme.colors.primary : theme.colors.muted
            }
          />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText
              style={{ fontSize: 13, lineHeight: 20, fontWeight: "500" }}
            >
              {item.title}
            </AppText>
            {item.description ? (
              <AppText
                style={{
                  fontSize: 12,
                  lineHeight: 19,
                  color: theme.colors.muted,
                }}
              >
                {item.description}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
