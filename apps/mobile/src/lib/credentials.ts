import * as SecureStore from "expo-secure-store";
export const credentials = {
  get: () => SecureStore.getItemAsync("agristock-session"),
  set: (value: string) => SecureStore.setItemAsync("agristock-session", value),
  remove: () => SecureStore.deleteItemAsync("agristock-session"),
};
