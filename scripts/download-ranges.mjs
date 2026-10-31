import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [url, target, sizeInput, checksum = "-", parallelInput = "8"] =
  process.argv.slice(2);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.local",
);
const destination = path.resolve(target || "");
const size = Number(sizeInput);
if (
  !url?.startsWith("https://") ||
  !destination.startsWith(root + path.sep) ||
  !Number.isSafeInteger(size) ||
  size < 1 ||
  size > 3_000_000_000
)
  throw new Error("Invalid download URL, destination or size.");
const checksumAlgorithm = checksum.length === 40 ? "sha1" : "sha256";
const matches = async (filename) => {
  if (statSync(filename).size !== size) return false;
  if (checksum === "-") return true;
  const hash = createHash(checksumAlgorithm);
  for await (const buffer of createReadStream(filename)) hash.update(buffer);
  return hash.digest("hex") === checksum.toLowerCase();
};
if (existsSync(destination) && (await matches(destination))) {
  console.log("Already verified: " + destination);
  process.exit(0);
}
const directory = path.join(
  root,
  "downloads",
  createHash("sha256")
    .update(url + ":native-fetch-2mb-v1")
    .digest("hex")
    .slice(0, 16),
);
mkdirSync(directory, { recursive: true });
const count = Math.max(16, Math.ceil(size / (2 * 1024 * 1024)));
const chunk = Math.ceil(size / count);
let next = 0,
  complete = 0;
const files = Array.from({ length: count }, (_, index) =>
  path.join(directory, "part-" + index),
);
async function worker() {
  while (next < count) {
    const index = next++;
    const start = index * chunk;
    const end = Math.min(size - 1, start + chunk - 1);
    const expected = end - start + 1;
    const file = files[index];
    if (!existsSync(file) || statSync(file).size !== expected) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, {
            headers: { Range: "bytes=" + start + "-" + end },
            signal: AbortSignal.timeout(120000),
          });
          if (
            response.status !== 206 ||
            response.headers.get("content-range") !==
              "bytes " + start + "-" + end + "/" + size
          )
            throw new Error("Unexpected range response " + response.status);
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length !== expected) throw new Error("Incomplete range");
          writeFileSync(file, buffer);
          break;
        } catch (error) {
          if (attempt === 2)
            throw new Error("Range " + index + " failed: " + error.message);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1)),
          );
        }
      }
    }
    complete++;
    if (
      complete === count ||
      complete % Math.max(1, Math.floor(count / 20)) === 0
    )
      console.log("Downloaded " + complete + "/" + count + " ranges");
  }
}
await Promise.all(
  Array.from({ length: Math.min(16, Math.max(1, Number(parallelInput))) }, () =>
    worker(),
  ),
);
const pending = destination + ".complete";
const output = openSync(pending, "w");
try {
  for (const file of files) writeSync(output, readFileSync(file));
} finally {
  closeSync(output);
}
if (!(await matches(pending)))
  throw new Error("Download checksum or size mismatch.");
renameSync(pending, destination);
for (const file of files) unlinkSync(file);
console.log("Verified: " + destination);
