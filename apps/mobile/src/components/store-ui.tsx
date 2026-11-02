import { PropsWithChildren, ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "./text";
import { Icon, IconName } from "./pos-ui";
import { theme } from "@/theme";

export function SearchBar({
  value,
  onChange,
  placeholder = "Tìm kiếm",
  label = placeholder,
  onScan,
  right,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onScan?: () => void;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        borderRadius: 24,
        backgroundColor: theme.colors.search,
        paddingLeft: 12,
      }}
    >
      <Icon name="magnify" color={theme.colors.muted} size={23} />
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        value={value}
        onChangeText={onChange}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          paddingHorizontal: 8,
          color: theme.colors.text,
          fontFamily: theme.font.regular,
          fontSize: 15,
        }}
      />
      {onScan ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quét mã"
          onPress={onScan}
          style={{
            minWidth: 48,
            minHeight: 36,
            borderLeftWidth: 1,
            borderLeftColor: theme.colors.control,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="barcode-scan" color={theme.colors.muted} />
        </Pressable>
      ) : null}
      {right}
    </View>
  );
}
export function StoreRow({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
  children,
  surface = theme.colors.paper,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
  surface?: string;
}) {
  const content = (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 54,
        }}
      >
        {icon ? (
          <Icon name={icon} color={theme.colors.muted} size={24} />
        ) : null}
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={{ fontSize: 16, lineHeight: 23 }}>{title}</AppText>
          {subtitle ? (
            <AppText
              style={{
                fontSize: 13,
                color: theme.colors.muted,
                lineHeight: 20,
              }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {trailing ??
          (onPress ? (
            <Icon name="chevron-right" color={theme.colors.control} size={23} />
          ) : null)}
      </View>
      {children}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 4,
        backgroundColor: pressed ? theme.colors.soft : surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      })}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 4,
        backgroundColor: surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      {content}
    </View>
  );
}
export function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: 3,
      }}
    >
      <AppText
        style={{ fontSize: 13, lineHeight: 18, color: theme.colors.muted }}
      >
        {label}
      </AppText>
      <AppText
        selectable
        style={{
          fontSize: 16,
          lineHeight: 22,
          color: accent ? theme.colors.primary : theme.colors.text,
        }}
      >
        {value || "---"}
      </AppText>
    </View>
  );
}
export function StoreSection({
  children,
  title,
}: { title?: string } & PropsWithChildren) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.paper,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      {title ? (
        <AppText
          style={{
            fontSize: 17,
            fontWeight: "600",
            lineHeight: 25,
            paddingVertical: 6,
          }}
        >
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}
export function FloatingAdd({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        right: 20,
        bottom: 24,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: pressed
          ? theme.colors.primaryDark
          : theme.colors.primary,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0px 4px 12px rgba(0,0,0,0.18)",
      })}
    >
      <Icon name="plus" color={theme.colors.onPrimary} size={30} />
    </Pressable>
  );
}
