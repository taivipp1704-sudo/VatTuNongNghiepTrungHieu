const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const ts = require("typescript"),
  sharp = require("sharp");
const { prepareZXingModule, readBarcodes } = require("zxing-wasm/reader");
let bwip;
function load(file) {
  const exports = {};
  const localRequire = (name) =>
    name === "./format"
      ? load("format.ts")
      : name === "@bwip-js/generic"
        ? bwip
        : require(name);
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        path.join(__dirname, "../apps/mobile/src/lib", file),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, require: localRequire, Intl, console },
  );
  return exports;
}
const product = {
  name: "Phân bón <A&B>",
  sku: "PB001",
  barcode: "8931234567890",
  price_pack: 480000,
  pack_unit: "bao",
};
(async () => {
  bwip = await import("@bwip-js/generic");
  const { barcodeSvg, labelHtml } = load("barcode-core.ts");
  prepareZXingModule({
    overrides: {
      wasmBinary: fs.readFileSync(
        require.resolve("zxing-wasm/reader/zxing_reader.wasm"),
      ),
    },
  });
  for (const [format, text] of [
    ["code128", "8931234567890"],
    ["code128", "PB001"],
    ["qrcode", "Mã-vật-tư-001"],
  ]) {
    const svg = barcodeSvg({ ...product, barcode: text }, format, 70);
    const png = await sharp(Buffer.from(svg), { density: 300 })
      .flatten({ background: "#fff" })
      .png()
      .toBuffer();
    const decoded = await readBarcodes(png, {
      formats: [format === "code128" ? "Code128" : "QRCode"],
      tryHarder: true,
    });
    assert.equal(
      decoded[0]?.text,
      text,
      format + " must round-trip through an independent decoder",
    );
  }
  assert.throws(
    () => barcodeSvg({ ...product, barcode: "Mã có dấu" }, "code128", 70),
    /QR/,
  );
  assert.throws(
    () => barcodeSvg({ ...product, barcode: "A".repeat(100) }, "code128", 35),
    /quá dài/,
  );
  assert.throws(
    () => labelHtml([{ product, quantity: 201 }], "medium", "code128", true),
    /200/,
  );
  assert.throws(
    () => labelHtml([{ product, quantity: 1.5 }], "medium", "code128", true),
    /200/,
  );
  assert.throws(
    () => labelHtml([{ product, quantity: 1 }], "small", "qrcode", true),
    /50/,
  );
  const html = labelHtml([{ product, quantity: 2 }], "medium", "code128", true);
  assert.equal((html.match(/<section /g) || []).length, 2);
  assert.ok(html.includes("Phân bón &lt;A&amp;B&gt;"));
  assert.ok(!html.includes("<script") && !html.includes("https://"));
  fs.writeFileSync(
    path.join(__dirname, "../artifacts/barcode-label-validation.json"),
    JSON.stringify(
      {
        passed: true,
        independentDecoder: "ZXing WASM",
        formats: ["Code128", "QRCode"],
        unicodeQr: true,
        quantityLimits: true,
        htmlEscaping: true,
        physicalPrintAcceptance: "pending",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: barcode/QR independently decoded, Unicode QR, HTML escaping and print limits. Physical printing remains pending.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
