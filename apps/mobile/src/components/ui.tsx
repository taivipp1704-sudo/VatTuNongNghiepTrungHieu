import {
  Button as NativeButton,
  Host as NativeHost,
  Picker,
  Switch as NativeSwitch,
  Text as NativeText,
} from "@expo/ui";
import {
  ComponentProps,
  ComponentRef,
  PropsWithChildren,
  ReactNode,
  Ref,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";
import { AppText as Text } from "./text";

function Host(props: ComponentProps<typeof NativeHost>) {
  return (
    <NativeHost
      {...props}
      colorScheme="light"
      seedColor={theme.colors.primary}
    />
  );
}

export function Label({
  children,
  muted = false,
  big = false,
  tone,
  numeric = false,
}: PropsWithChildren<{
  muted?: boolean;
  big?: boolean;
  tone?: "info" | "success" | "warning" | "danger";
  numeric?: boolean;
}>) {
  return (
    <Text
      selectable
      variant={numeric ? "amount" : big ? "heading" : "body"}
      style={{
        color: tone
          ? theme.colors[tone]
          : muted
            ? theme.colors.muted
            : theme.colors.text,
        fontSize: big ? theme.type.heading : theme.type.body,
        fontWeight: big || numeric ? "700" : "500",
        lineHeight: big ? 27 : 24,
      }}
    >
      {children}
    </Text>
  );
}
export function Caption({ children }: PropsWithChildren) {
  return (
    <Text
      selectable
      style={{
        fontSize: theme.type.caption,
        color: theme.colors.muted,
        lineHeight: 21,
      }}
    >
      {children}
    </Text>
  );
}
export function Section({
  title,
  children,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={{ gap: theme.space.md }}>
      {title ? (
        <Text
          style={{
            fontSize: theme.type.heading,
            fontWeight: "600",
            color: theme.colors.text,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
export function Panel({
  children,
  testID,
  tone,
  glass = false,
}: PropsWithChildren<{
  testID?: string;
  tone?: "info" | "success" | "warning";
  glass?: boolean;
}>) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor:
          tone === "info"
            ? theme.colors.infoBg
            : tone === "success"
              ? theme.colors.successBg
              : tone === "warning"
                ? theme.colors.warningBg
                : glass
                  ? theme.colors.glassLight
                  : theme.colors.paper,
        borderRadius: theme.radius.lg,
        padding: theme.space.lg,
        borderWidth: 1,
        borderColor: tone
          ? "transparent"
          : glass
            ? theme.colors.glassBorder
            : theme.colors.border,
        gap: theme.space.md,
      }}
    >
      {children}
    </View>
  );
}
export function Row({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.space.md,
        flexWrap: "wrap",
      }}
    >
      {children}
    </View>
  );
}
export function Page({
  children,
  onRefresh,
  refreshing = false,
  footer,
  scrollRef,
  background,
}: PropsWithChildren<{
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  background?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      {background ? (
        <View
          pointerEvents="none"
          aria-hidden={true}
          style={{ position: "absolute", inset: 0 }}
        >
          {background}
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        contentContainerStyle={{
          padding: theme.space.lg,
          paddingBottom:
            Math.max(insets.bottom, theme.space.lg) + theme.space.xl,
          gap: theme.space.lg,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            padding: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.canvas,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  pending = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  pending?: boolean;
  testID?: string;
}) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <NativeButton
        testID={testID}
        onPress={onPress}
        disabled={disabled || pending}
        variant={secondary ? "outlined" : "filled"}
        style={{
          height: 50,
          width: "100%",
          borderRadius: theme.radius.sm,
          backgroundColor: disabled
            ? theme.colors.neutral
            : secondary
              ? theme.colors.paper
              : theme.colors.primary,
          borderColor: theme.colors.control,
        }}
      >
        <NativeText
          textStyle={{
            color: disabled
              ? theme.colors.muted
              : secondary
                ? theme.colors.primary
                : theme.colors.onPrimary,
            fontSize: theme.type.body,
            fontWeight: "600",
            fontFamily: theme.font.semibold,
          }}
        >
          {pending ? "Đang xử lý…" : title}
        </NativeText>
      </NativeButton>
    </Host>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(value || "");
  const numeric =
    props.keyboardType === "numeric" || props.keyboardType === "decimal-pad";
  return (
    <View style={{ gap: theme.space.sm }}>
      <Text
        style={{
          fontSize: theme.type.caption,
          color: theme.colors.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderColor: theme.colors.control,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.md,
          color: theme.colors.text,
          backgroundColor: theme.colors.paper,
          fontSize: theme.type.body,
          fontFamily: theme.font.regular,
        }}
        {...props}
        value={numeric && editing ? buffer : value}
        onFocus={(event) => {
          setBuffer(value || "");
          setEditing(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setEditing(false);
          onBlur?.(event);
        }}
        onChangeText={(text) => {
          setBuffer(text);
          onChangeText?.(text);
        }}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <View style={{ gap: theme.space.sm }}>
      <Caption>{label}</Caption>
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.control,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.paper,
          minHeight: 48,
          paddingHorizontal: theme.space.sm,
          justifyContent: "center",
        }}
      >
        {process.env.EXPO_OS === "web" ? (
          <select
            aria-label={label}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            style={{
              width: "100%",
              minHeight: 46,
              fontSize: 16,
              fontFamily: theme.font.regular,
              color: theme.colors.text,
              background: theme.colors.paper,
              border: 0,
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Picker selectedValue={value} onValueChange={onChange}>
              {options.map((option) => (
                <Picker.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Picker>
          </Host>
        )}
      </View>
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ minHeight: 48, justifyContent: "center" }}>
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <NativeSwitch
          label={label}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        />
      </Host>
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) {
  if (!children) return null;
  return (
    <View
      accessibilityRole={error ? "alert" : "text"}
      style={{
        padding: theme.space.md,
        backgroundColor: error ? theme.colors.dangerBg : theme.colors.soft,
        borderRadius: theme.radius.sm,
      }}
    >
      <Text
        selectable
        style={{
          color: error ? theme.colors.danger : theme.colors.primary,
          fontSize: theme.type.caption,
          lineHeight: 21,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning" | "danger" | "positive";
}) {
  const color =
    tone === "danger"
      ? theme.colors.danger
      : tone === "warning"
        ? theme.colors.warning
        : tone === "positive"
          ? theme.colors.success
          : theme.colors.muted;
  return (
    <Text
      style={{
        color,
        backgroundColor:
          tone === "danger"
            ? theme.colors.dangerBg
            : tone === "warning"
              ? theme.colors.warningBg
              : tone === "positive"
                ? theme.colors.successBg
                : theme.colors.neutral,
        fontSize: theme.type.small,
        fontWeight: "600",
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xs,
        borderRadius: theme.radius.sm,
        overflow: "hidden",
        alignSelf: "flex-start",
      }}
    >
      {label}
    </Text>
  );
}
export function Empty({
  message = "Chưa có dữ liệu.",
  action,
}: {
  message?: string;
  action?: ReactNode;
}) {
  return (
    <Panel>
      <Label>{message}</Label>
      {action}
    </Panel>
  );
}
export function QueryState({
  query,
  children,
  loadingSurface = false,
}: {
  query: {
    data: unknown;
    isPending: boolean;
    error: Error | null;
    fetchStatus?: string;
    refetch: () => unknown;
  };
  children: ReactNode;
  loadingSurface?: boolean;
}) {
  if (query.data === undefined) {
    if (query.error)
      return (
        <Empty
          message={query.error.message}
          action={
            <Button title="Thử lại" secondary onPress={() => query.refetch()} />
          }
        />
      );
    if (query.fetchStatus === "paused")
      return <Empty message="Đang ngoại tuyến. Kết nối mạng để tải dữ liệu." />;
    return (
      <View
        style={{
          padding: theme.space.xxl,
          gap: theme.space.md,
          backgroundColor: loadingSurface ? theme.colors.glassLight : undefined,
          borderRadius: loadingSurface ? theme.radius.lg : undefined,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Caption>Đang tải dữ liệu…</Caption>
      </View>
    );
  }
  return (
    <>
      {query.error ? <Notice error>{query.error.message}</Notice> : null}
      {children}
    </>
  );
}
export function LinkRow({
  title,
  description,
  onPress,
}: {
  title: string;
  description?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: theme.space.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        opacity: pressed ? 0.65 : 1,
        gap: theme.space.xs,
        minHeight: 56,
      })}
    >
      <Row>
        <Text
          style={{
            fontSize: theme.type.body,
            fontWeight: "500",
            color: theme.colors.text,
            flex: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{ fontSize: theme.type.heading, color: theme.colors.muted }}
        >
          ›
        </Text>
      </Row>
      {description ? <Caption>{description}</Caption> : null}
    </Pressable>
  );
}
export async function confirmAction(title: string, message: string) {
  if (process.env.EXPO_OS === "web")
    return globalThis.confirm(title + "\n\n" + message);
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Quay lại", style: "cancel", onPress: () => resolve(false) },
        { text: "Xác nhận", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export function Denied() {
  return (
    <Page>
      <Empty message="Bạn chưa được cấp quyền sử dụng chức năng này. Liên hệ chủ cửa hàng." />
    </Page>
  );
}
