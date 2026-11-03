import { PropsWithChildren } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export function AuthPage({ children, headerShown = false }: PropsWithChildren<{ headerShown?: boolean }>) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={headerShown ? ["left", "right"] : ["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
