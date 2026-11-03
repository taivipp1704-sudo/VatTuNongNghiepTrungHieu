import type { ConfigContext, ExpoConfig } from "expo/config";
import { validateApiOrigin } from "./config/server-url.cjs";

export default ({ config }: ConfigContext): ExpoConfig => {
  const release = process.env.AGRISTOCK_RELEASE === "1";
  const lanTest = process.env.AGRISTOCK_LAN_TEST === "1";
  if (release && lanTest)
    throw new Error("A LAN test build cannot be an operational release.");
  const apiInput = process.env.EXPO_PUBLIC_API_URL;
  const apiUrl = apiInput ? validateApiOrigin(apiInput, release) : undefined;
  const versionInput = process.env.AGRISTOCK_ANDROID_VERSION_CODE;
  const versionCode =
    versionInput === undefined
      ? config.android?.versionCode || 1
      : Number(versionInput);
  if (
    !Number.isInteger(versionCode) ||
    versionCode < 1 ||
    versionCode > 2100000000
  )
    throw new Error(
      "AGRISTOCK_ANDROID_VERSION_CODE must be a positive Android version code.",
    );
  return {
    ...config,
    name: lanTest ? "HTAgri Test" : "HTAgri",
    slug: "agristock-mobile",
    scheme: lanTest ? "agristock-lan-test" : config.scheme,
    android: {
      ...config.android,
      ...(lanTest ? { package: "vn.agristock.internal.lantest" } : {}),
      versionCode,
      allowBackup: false,
    },
    extra: { ...config.extra, agristock: { release, apiUrl, lanTest } },
    plugins: [
      ...(config.plugins || []),
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic:
              !release && process.env.AGRISTOCK_ALLOW_HTTP === "1",
          },
        },
      ],
      ["expo-image-picker", { photosPermission: "Cho phép HTAgri chọn ảnh hàng hóa và ảnh giao hàng.", cameraPermission: "Cho phép HTAgri chụp ảnh hàng hóa và xác nhận giao hàng.", microphonePermission: false }],
      "./plugins/with-release-signing.cjs",
    ],
  };
};
