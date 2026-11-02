import { toSVG } from "@bwip-js/generic";
import type { Product } from "@/types";
import { money } from "./format";
export const labelSizes = {
  small: { name: "35 × 22 mm", width: 35, height: 22 },
  medium: { name: "50 × 30 mm", width: 50, height: 30 },
  large: { name: "70 × 35 mm", width: 70, height: 35 },
};
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function barcodeSvg(
  product: Product,
  format: "code128" | "qrcode",
  width = 50,
) {
  const text = product.barcode || product.sku;
  if (!text || text.length > 100)
    throw new Error("Mã hàng/mã vạch cần từ 1 đến 100 ký tự.");
  if (format === "code128" && !/^[\x20-\x7E]+$/.test(text))
    throw new Error("Mã có dấu hoặc ký tự đặc biệt. Chọn QR để in đầy đủ.");
  const svg = toSVG({
    bcid: format,
    text,
    scale: 1,
    ...(format === "code128" ? { height: 8 } : {}),
    includetext: false,
    paddingwidth: format === "code128" ? 10 : 4,
    paddingheight: 2,
  });
  const intrinsic = Number(svg.match(/viewBox="0 0 ([\d.]+) /)?.[1]);
  if (format === "code128" && intrinsic && (width - 4) / intrinsic < 0.19)
    throw new Error(
      "Mã quá dài để in rõ ở khổ tem này. Chọn khổ lớn hơn hoặc QR.",
    );
  return svg;
}
export function labelHtml(
  items: { product: Product; quantity: number }[],
  size: keyof typeof labelSizes,
  format: "code128" | "qrcode",
  showPrice: boolean,
) {
  const count = items.reduce((sum, r) => sum + r.quantity, 0),
    dimensions = labelSizes[size];
  if (
    !items.length ||
    count < 1 ||
    count > 200 ||
    items.some(
      (r) =>
        !Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 100,
    )
  )
    throw new Error("Chọn từ 1 đến 200 tem, tối đa 100 tem cho một mặt hàng.");
  if (format === "qrcode" && size === "small")
    throw new Error("Tem QR cần khổ 50 × 30 mm hoặc 70 × 35 mm để dễ quét.");
  const labels = items
    .flatMap(({ product, quantity }) => {
      const svg = barcodeSvg(product, format, dimensions.width);
      const label =
        '<section class="label"><div class="name">' +
        escape(product.name) +
        '</div><div class="barcode">' +
        svg +
        '</div><div class="code">' +
        escape(product.barcode || product.sku) +
        "</div>" +
        (showPrice
          ? "<strong>" +
            escape(money(product.price_pack)) +
            " / " +
            escape(product.pack_unit) +
            "</strong>"
          : "") +
        "</section>";
      return Array.from({ length: quantity }, () => label);
    })
    .join("");
  return (
    '<!doctype html><html lang="vi"><meta charset="utf-8"><style>@page{size:A4;margin:8mm}body{margin:0;font-family:Arial,sans-serif;color:#000}.sheet{display:grid;grid-template-columns:repeat(auto-fill,' +
    dimensions.width +
    "mm);gap:2mm}.label{box-sizing:border-box;width:" +
    dimensions.width +
    "mm;height:" +
    dimensions.height +
    "mm;padding:1mm;border:1px solid #ddd;text-align:center;break-inside:avoid;overflow:hidden;font-size:9px}.name{height:5.5mm;overflow:hidden;line-height:1.3}.barcode{height:" +
    Math.max(7, dimensions.height - 15) +
    'mm}.barcode svg{width:100%;height:100%;display:block}.code{font-size:8px;height:3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}strong{font-size:9px}</style><div class="sheet">' +
    labels +
    "</div></html>"
  );
}
