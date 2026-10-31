const path = require("node:path");
const sharp = require(process.argv[2] || "sharp");
const root = path.resolve(__dirname, "../apps/mobile/assets");
const input = path.join(root, "brand-mark.svg");
(async () => {
  await sharp(input)
    .resize(1024, 1024)
    .flatten({ background: "#176B46" })
    .png()
    .toFile(path.join(root, "images/icon.png"));
  await sharp(input)
    .resize(260, 260)
    .extend({
      top: 86,
      bottom: 86,
      left: 86,
      right: 86,
      background: "#176B4600",
    })
    .png()
    .toFile(path.join(root, "images/android-icon-foreground.png"));
  await sharp(input)
    .resize(260, 260)
    .extend({
      top: 86,
      bottom: 86,
      left: 86,
      right: 86,
      background: "#176B4600",
    })
    .png()
    .toFile(path.join(root, "images/android-icon-monochrome.png"));
  await sharp(input)
    .resize(512, 512)
    .tint("#176B46")
    .png()
    .toFile(path.join(root, "images/splash-icon.png"));
  await sharp(input)
    .resize(64, 64)
    .flatten({ background: "#176B46" })
    .png()
    .toFile(path.join(root, "images/favicon.png"));
  console.log("Đã tạo icon AgriStock từ bản vẽ vector.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
