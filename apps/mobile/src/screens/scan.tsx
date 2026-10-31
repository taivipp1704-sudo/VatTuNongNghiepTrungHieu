import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Linking, View } from "react-native";
import { Button, Caption, Field, Notice, Page } from "@/components/ui";
import { useScan } from "@/lib/scanner";
import { theme } from "@/theme";

export default function Scan() {
  const { target } = useLocalSearchParams<{ target: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const consumed = useRef(false);
  const finish = (code: string) => {
    if (consumed.current || !code.trim()) return;
    consumed.current = true;
    useScan.getState().set(target || "inventory", code.trim());
    router.back();
  };
  return (
    <Page>
      {permission?.granted ? (
        <View
          style={{
            height: 320,
            borderRadius: theme.radius.lg,
            overflow: "hidden",
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "code128",
                "code39",
                "qr",
                "upc_a",
                "upc_e",
              ],
            }}
            onBarcodeScanned={(result) => finish(result.data)}
          />
        </View>
      ) : (
        <>
          <Notice>
            Cho phép camera để quét mã sản phẩm. Bạn vẫn có thể nhập mã bằng
            tay.
          </Notice>
          <Button
            title="Cho phép sử dụng camera"
            onPress={() => requestPermission()}
          />
          {permission && !permission.canAskAgain ? (
            <Button
              title="Mở cài đặt quyền camera"
              secondary
              onPress={() => Linking.openSettings()}
            />
          ) : null}
        </>
      )}
      <Caption>Đưa mã vạch vào giữa khung hình, giữ thiết bị ổn định.</Caption>
      <Field
        label="Nhập SKU hoặc mã vạch"
        value={manual}
        onChangeText={setManual}
        autoCapitalize="none"
      />
      <Button
        title="Sử dụng mã vừa nhập"
        secondary
        onPress={() => finish(manual)}
        disabled={!manual.trim()}
      />
    </Page>
  );
}
