import { StyleSheet, Text, TextProps } from "react-native";
import { theme } from "@/theme";
export function AppText({
  style,
  variant,
  ...props
}: TextProps & { variant?: "body" | "heading" | "amount" }) {
  const current = StyleSheet.flatten(style) || {};
  const weight = Number(current.fontWeight || 400);
  const size = current.fontSize || theme.type.body;
  const isHeading =
    variant === "heading" ||
    (!variant && size >= theme.type.heading && weight >= 600);
  const family =
    current.fontFamily ||
    (variant === "amount"
      ? weight >= 600
        ? theme.font.numericBold
        : theme.font.numeric
      : isHeading
      ? weight >= 700
        ? theme.font.headingBold
        : theme.font.heading
      : weight >= 700
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
        {
          fontSize: theme.type.body,
          color: theme.colors.text,
          lineHeight: Math.ceil(size * 1.45),
          ...(variant === "amount"
            ? { fontVariant: ["tabular-nums"] as const }
            : {}),
        },
        style,
        { fontFamily: family, fontWeight: "normal" },
      ]}
    />
  );
}
