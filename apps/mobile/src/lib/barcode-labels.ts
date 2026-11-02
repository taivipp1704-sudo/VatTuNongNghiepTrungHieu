import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Product } from "@/types";
import { labelHtml, labelSizes } from "./barcode-core";
export { barcodeSvg, labelSizes } from "./barcode-core";
export async function printLabels(
  items: { product: Product; quantity: number }[],
  size: keyof typeof labelSizes,
  format: "code128" | "qrcode",
  showPrice: boolean,
) {
  const html = labelHtml(items, size, format, showPrice);
  if (process.env.EXPO_OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Tem mã vạch",
      UTI: "com.adobe.pdf",
    });
  else await Print.printAsync({ uri: file.uri });
}
