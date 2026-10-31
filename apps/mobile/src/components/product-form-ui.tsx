import {
  Children,
  ComponentRef,
  PropsWithChildren,
  Ref,
  useState,
} from "react";
import {
  TextInput,
  TextInputProps,
  View,
  useWindowDimensions,
} from "react-native";
import { AppText } from "./text";
import { Icon, IconName } from "./pos-ui";
import { theme } from "@/theme";

export function ProductFormCard({
  title,
  icon,
  children,
}: PropsWithChildren<{ title?: string; icon?: IconName }>) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.paper,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 10,
        boxShadow: "0px 2px 5px rgba(19, 27, 46, 0.06)",
      }}
    >
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? (
            <Icon name={icon} color={theme.colors.muted} size={21} />
          ) : null}
          <AppText
            accessibilityRole="header"
            style={{ fontSize: 16, fontWeight: "600", flex: 1 }}
          >
            {title}
          </AppText>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function ProductFormColumns({
  children,
  columns = 2,
}: PropsWithChildren<{ columns?: 2 | 3 }>) {
  const { width, fontScale } = useWindowDimensions();
  const count =
    width < 350 || fontScale > 1.25
      ? 1
      : columns === 3 && width >= 390 && fontScale <= 1.1
        ? 3
        : 2;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {Children.toArray(children).map((child, index) => (
        <View
          key={index}
          style={{
            flexGrow: 1,
            flexBasis: count === 1 ? "100%" : count === 3 ? "28%" : "44%",
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export function ProductFormField({
  label,
  required,
  inputRef,
  value,
  onChangeText,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label: string;
  required?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [focused, setFocused] = useState(false);
  const [buffer, setBuffer] = useState(value || "");
  const numeric =
    props.keyboardType === "numeric" || props.keyboardType === "decimal-pad";
  return (
    <View style={{ gap: 2, minWidth: 0 }}>
      <AppText
        style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}
      >
        {label}
        {required ? (
          <AppText style={{ color: theme.colors.danger }}> *</AppText>
        ) : null}
      </AppText>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={props.accessibilityLabel || label}
        placeholderTextColor={theme.colors.muted}
        value={numeric && focused ? buffer : value}
        onFocus={(event) => {
          setBuffer(value || "");
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onChangeText={(text) => {
          setBuffer(text);
          onChangeText?.(text);
        }}
        style={[
          {
            minHeight: 48,
            minWidth: 0,
            borderBottomWidth: 1,
            borderBottomColor: focused
              ? theme.colors.primary
              : theme.colors.control,
            paddingHorizontal: 0,
            paddingVertical: 8,
            backgroundColor: theme.colors.paper,
            color:
              props.editable === false ? theme.colors.muted : theme.colors.text,
            fontSize: 16,
            fontFamily: theme.font.regular,
          },
          props.multiline ? { minHeight: 88, textAlignVertical: "top" } : null,
          props.style,
        ]}
      />
    </View>
  );
}
