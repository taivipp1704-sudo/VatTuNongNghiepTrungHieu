import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
type Cell = string | number | null | undefined;
const safe = (value: Cell) =>
  typeof value === "string" && /^[=+\-@\t\r]/.test(value)
    ? "'" + value
    : String(value ?? "");
const html = (value: Cell) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function exportCsv(
  name: string,
  headers: string[],
  rows: Cell[][],
) {
  const content =
    "\ufeff" +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => '"' + safe(cell).replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n");
  const fileName = name + "-" + Date.now() + ".csv";
  if (process.env.EXPO_OS === "web") {
    const uri = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = uri;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(uri);
    return;
  }
  const file = new File(Paths.cache, fileName);
  file.write(content);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Xuất dữ liệu mở bằng Excel",
    UTI: "public.comma-separated-values-text",
  });
}
export async function exportTablePdf(
  title: string,
  headers: string[],
  rows: Cell[][],
) {
  const content =
    '<!doctype html><html lang="vi"><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#131b2e}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border-bottom:1px solid #dde3ee;padding:8px;text-align:left}h1{font-size:21px}</style><h1>' +
    html(title) +
    "</h1><p>" +
    html(new Date().toLocaleString("vi-VN")) +
    "</p><table><thead><tr>" +
    headers.map((v) => "<th>" + html(v) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          "<tr>" +
          row.map((v) => "<td>" + html(v) + "</td>").join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table><p>Chỉ gồm dữ liệu đang lọc trong phạm vi tài khoản.</p></html>";
  if (process.env.EXPO_OS === "web") {
    await Print.printAsync({ html: content });
    return;
  }
  const file = await Print.printToFileAsync({ html: content });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: title,
      UTI: "com.adobe.pdf",
    });
  else await Print.printAsync({ uri: file.uri });
}
