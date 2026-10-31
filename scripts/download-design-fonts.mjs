import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "apps/mobile/assets/fonts");
await mkdir(folder, { recursive: true });
const files = [
  "BeVietnamPro-Regular.ttf",
  "BeVietnamPro-Medium.ttf",
  "BeVietnamPro-SemiBold.ttf",
  "BeVietnamPro-Bold.ttf",
  "OFL.txt",
];
const manifest = {
  source: "https://github.com/google/fonts/tree/main/ofl/bevietnampro",
  files: [],
};
for (const file of files) {
  const response = await fetch(
    "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/" +
      file,
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok)
    throw new Error("Font download failed: " + file + " " + response.status);
  const data = Buffer.from(await response.arrayBuffer());
  if (file.endsWith(".ttf") && data.readUInt32BE(0) !== 0x00010000)
    throw new Error("Unexpected font format");
  await writeFile(path.join(folder, file), data);
  manifest.files.push({
    file,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await writeFile(
  path.join(folder, "sources.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(
  "Downloaded four Be Vietnam Pro font weights and OFL license from Google Fonts.",
);
