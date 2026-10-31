const path = require("node:path");
const fs = require("node:fs");
const mobile = path.resolve(__dirname, "../apps/mobile");
process.env.EXPO_ROUTER_APP_ROOT = path.join(mobile, "src/app");
const output = path.join(mobile, ".expo/types");
fs.mkdirSync(output, { recursive: true });
const cli = require.resolve("@expo/cli/package.json", { paths: [mobile] });
const generator = require(
  require.resolve("@expo/router-server/build/typed-routes", {
    paths: [path.dirname(cli)],
  }),
);
generator.regenerateDeclarations(output, {});
