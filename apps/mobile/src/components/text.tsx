import { StyleSheet, Text, TextProps } from "react-native";
import { theme } from "@/theme";
export function AppText({ style, ...props }: TextProps) {
  const current = StyleSheet.flatten(style) || {};
  const weight = Number(current.fontWeight || 400);
  const family =
    current.fontFamily ||
    (weight >= 700
      ? theme.font.bold
      : weight >= 600
        ? theme.font.semibold
        : weight >= 500
          ? theme.font.medium
          : theme.font.regular);
  return (
    <Text
      {...props}
      style={[
        { fontSize: theme.type.body, color: theme.colors.text, lineHeight: 24 },
        style,
        { fontFamily: family, fontWeight: "normal" },
      ]}
    />
  );
}
