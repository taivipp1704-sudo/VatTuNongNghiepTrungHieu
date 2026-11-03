import { PropsWithChildren } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";

export function AppKeyboardProvider({ children }: PropsWithChildren) {
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge preload={false}>
      {children}
    </KeyboardProvider>
  );
}
