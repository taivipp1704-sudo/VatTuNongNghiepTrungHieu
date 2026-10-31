import { create } from "zustand";
import Constants from "expo-constants";
import { isDevice } from "expo-device";
import { SessionUser } from "@/types";
import { credentials } from "./credentials";
import { clearUserCache, localGet, localSet } from "./cache";
import { validateApiOrigin } from "../../config/server-url.cjs";

const host = Constants.expoConfig?.hostUri?.split(":")[0];
export const isOperationalBuild =
  Constants.expoConfig?.extra?.agristock?.release === true;
export const isLanTestBuild =
  Constants.expoConfig?.extra?.agristock?.lanTest === true;
const release = isOperationalBuild;
const physicalDevice = process.env.EXPO_OS !== "web" && isDevice;
const defaultUrl =
  Constants.expoConfig?.extra?.agristock?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  (release
    ? ""
    : host && host !== "localhost"
      ? `http://${host}:3001`
      : physicalDevice
        ? ""
        : process.env.EXPO_OS === "android"
          ? "http://10.0.2.2:3001"
          : "http://localhost:3001");
interface Session {
  user: SessionUser | null;
  token: string | null;
  apiUrl: string;
  ready: boolean;
  offline: boolean;
  message: string;
  setUser: (user: SessionUser) => void;
  setOffline: (value: boolean) => void;
  configure: (url: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

async function responseJson(response: Response) {
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Không thể kết nối máy chủ.");
  return data;
}

export const useSession = create<Session>((set, get) => ({
  user: null,
  token: null,
  apiUrl: defaultUrl,
  ready: false,
  offline: false,
  message: "",
  setUser: (user) => set({ user }),
  setOffline: (offline) => set({ offline }),
  configure: async (url) => {
    const clean = validateApiOrigin(url, release, physicalDevice);
    if (get().user) throw new Error("Đăng xuất trước khi đổi máy chủ.");
    await credentials.remove();
    await localSet("server-url", clean);
    set({ apiUrl: clean, token: null });
  },
  hydrate: async () => {
    try {
      const storedUrl = await localGet<string>("server-url");
      let apiUrl = defaultUrl;
      if (storedUrl) {
        try {
          apiUrl = validateApiOrigin(storedUrl, release, physicalDevice);
        } catch {
          await credentials.remove();
          await localSet("server-url", defaultUrl);
          set({
            message:
              "Địa chỉ đã lưu không dùng được trên thiết bị này. Cấu hình lại máy chủ của cửa hàng.",
          });
        }
      }
      if (!apiUrl) {
        await credentials.remove();
        set({
          apiUrl: "",
          token: null,
          user: null,
          message: "Nhập địa chỉ máy chủ HTTPS của cửa hàng để bắt đầu.",
        });
        return;
      }
      apiUrl = validateApiOrigin(apiUrl, release, physicalDevice);
      const token = await credentials.get();
      set({ apiUrl, token });
      if (token) {
        try {
          const response = await fetch(apiUrl + "/api/me", {
            headers: { Authorization: "Bearer " + token },
            signal: AbortSignal.timeout(10000),
          });
          if (response.status === 401) {
            await credentials.remove();
            set({ token: null });
          } else set({ user: await responseJson(response), offline: false });
        } catch {
          set({
            message:
              "Không tải được phiên đăng nhập. Kiểm tra mạng và máy chủ.",
            offline: true,
          });
        }
      }
    } catch {
      set({
        user: null,
        token: null,
        message:
          "Không đọc được dữ liệu đăng nhập trên thiết bị. Vui lòng đăng nhập lại.",
      });
    } finally {
      set({ ready: true });
    }
  },
  login: async (username, password) => {
    validateApiOrigin(get().apiUrl, release, physicalDevice);
    let response: Response;
    try {
      response = await fetch(get().apiUrl + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      set({ offline: true });
      throw new Error(
        "Không kết nối được máy chủ " +
          get().apiUrl +
          (release
            ? ". Kiểm tra địa chỉ, Internet và máy chủ HTTPS đang hoạt động."
            : ". Kiểm tra địa chỉ, Wi-Fi và máy chủ đang chạy trên máy tính."),
      );
    }
    const data = await responseJson(response);
    await credentials.set(data.token);
    set({ user: data.user, token: data.token, offline: false, message: "" });
  },
  logout: async () => {
    const { token, apiUrl, user } = get();
    set({ user: null, token: null });
    try {
      await fetch(apiUrl + "/api/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(3000),
      });
    } catch {}
    try {
      await credentials.remove();
    } catch {
      set({
        message:
          "Không xóa được thông tin phiên trên thiết bị. Kiểm tra bộ nhớ trước khi đăng nhập lại.",
      });
    }
    if (user)
      await clearUserCache(apiUrl + ":" + user.id + ":cache:").catch(() => {});
  },
}));

export function can(permission: string) {
  const user = useSession.getState().user;
  return Boolean(user && (user.owner || user.permissions.includes(permission)));
}
export function userKey(suffix: string) {
  const { apiUrl, user } = useSession.getState();
  return apiUrl + ":" + user?.id + ":" + suffix;
}
