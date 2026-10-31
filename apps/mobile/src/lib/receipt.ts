import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { money } from "./format";
import { DataRow } from "@/types";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export async function shareReceipt(
  invoice: DataRow,
  store: { name: string; address: string; phone: string },
  mode: "share" | "print" = "share",
) {
  const lines: DataRow[] = invoice.lines;
  const payment = invoice.returned
    ? `Đơn đã trả hàng · Đã hoàn: ${escapeHtml(money(invoice.paid))} · Còn nợ: 0 ₫`
    : `Đã thu: ${escapeHtml(money(invoice.paid))} · Còn nợ: ${escapeHtml(money(invoice.total - invoice.paid))}`;
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8">
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#202824}h1{font-size:22px}table{width:100%;border-collapse:collapse}td,th{padding:12px 4px;border-bottom:1px solid #ddd;text-align:left}.num{text-align:right}small{color:#59685f}</style>
    <h1>${escapeHtml(store.name)}</h1><p>${escapeHtml(store.address)} · ${escapeHtml(store.phone)}</p>
    <h2>PHIẾU BÁN HÀNG NỘI BỘ</h2><p>${escapeHtml(invoice.code)} · Khách: ${escapeHtml(invoice.customer_name || "Khách lẻ")}</p>
    <table><thead><tr><th>Hàng hóa</th><th class="num">SL</th><th class="num">Thành tiền</th></tr></thead><tbody>
    ${lines.map((line) => `<tr><td>${escapeHtml(line.name)}<br><small>${escapeHtml(money(line.unitPrice))} / ${escapeHtml(line.unitLabel)}</small></td><td class="num">${escapeHtml(line.quantity)}</td><td class="num">${escapeHtml(money(line.total))}</td></tr>`).join("")}
    </tbody></table><p>Chiết khấu: ${escapeHtml(money(invoice.discount))}</p>
    <p>Giảm bằng điểm: ${escapeHtml(money(invoice.loyalty_discount || 0))} (${escapeHtml(invoice.loyalty_spent || 0)} điểm)</p>
    <p>Điểm đã cộng theo đơn: ${escapeHtml(invoice.loyalty_earned || 0)}${invoice.returned ? (invoice.loyalty_snapshot?.settings?.reverseEarnOnReturn === false ? " (giữ theo cấu hình của đơn)" : " (đã thu hồi khi trả hàng)") : ""}</p><h2>Tổng: ${escapeHtml(money(invoice.total))}</h2>
    <p>${payment}</p><p><small>Phiếu bán nội bộ, không thay thế hóa đơn điện tử.</small></p></html>`;
  if (process.env.EXPO_OS === "web" || mode === "print") {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Chia sẻ phiếu bán nội bộ",
      UTI: "com.adobe.pdf",
    });
  else await Print.printAsync({ uri: file.uri });
}
