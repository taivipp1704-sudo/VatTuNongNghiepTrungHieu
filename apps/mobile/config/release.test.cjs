const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateApiOrigin } = require("./server-url.cjs");
const configure = require("../app.config.ts").default;
const base = require("../app.json").expo;

test("physical Android phones reject emulator aliases before attempting a login", () => {
  assert.throws(
    () => validateApiOrigin("http://10.0.2.2:3001", false, true),
    /máy ảo Android/,
  );
  assert.throws(
    () => validateApiOrigin("https://10.0.2.2:3001", true, true),
    /máy ảo Android/,
  );
  assert.equal(
    validateApiOrigin("http://10.0.2.2:3001", false, false),
    "http://10.0.2.2:3001",
  );
  assert.equal(
    validateApiOrigin("http://192.168.1.20:3001", false, true),
    "http://192.168.1.20:3001",
  );
});

test("operational endpoint rejects HTTP, local emulator, credentials and URL paths", () => {
  for (const value of [
    "http://api.cuahang.vn",
    "https://localhost",
    "https://10.0.2.2",
    "https://name:pass@api.cuahang.vn",
    "https://api.cuahang.vn/api",
    "https://api.cuahang.vn?token=value",
  ])
    assert.throws(() => validateApiOrigin(value, true));
  assert.equal(
    validateApiOrigin("https://api.cuahang.vn/"),
    "https://api.cuahang.vn",
  );
  assert.equal(
    validateApiOrigin("http://localhost:3001", false),
    "http://localhost:3001",
  );
});

test("release cannot silently use a development server and keeps a private signing key out of app config", () => {
  const names = [
    "AGRISTOCK_RELEASE",
    "AGRISTOCK_LAN_TEST",
    "AGRISTOCK_ALLOW_HTTP",
    "EXPO_PUBLIC_API_URL",
    "AGRISTOCK_ANDROID_VERSION_CODE",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    process.env.AGRISTOCK_RELEASE = "1";
    process.env.AGRISTOCK_LAN_TEST = "0";
    process.env.AGRISTOCK_ALLOW_HTTP = "1";
    delete process.env.EXPO_PUBLIC_API_URL;
    const unconfigured = configure({ config: base });
    assert.equal(unconfigured.extra.agristock.release, true);
    assert.equal(unconfigured.extra.agristock.apiUrl, undefined);
    process.env.EXPO_PUBLIC_API_URL = "http://api.cuahang.vn";
    assert.throws(() => configure({ config: base }), /HTTPS/);
    process.env.EXPO_PUBLIC_API_URL = "https://api.cuahang.vn";
    process.env.AGRISTOCK_ANDROID_VERSION_CODE = "2";
    const config = configure({ config: base });
    assert.equal(config.extra.agristock.apiUrl, "https://api.cuahang.vn");
    assert.equal(config.extra.agristock.release, true);
    assert.equal(config.android.versionCode, 2);
    assert.equal(config.name, "HTAgri");
    assert.equal(config.android.adaptiveIcon.monochromeImage, undefined);
    assert.equal(config.android.allowBackup, false);
    assert.equal(
      config.plugins.find(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === "expo-build-properties",
      )[1].android.usesCleartextTraffic,
      false,
    );
    assert.equal(
      JSON.stringify(config).includes("AGRISTOCK_KEYSTORE_PASSWORD"),
      false,
    );
    process.env.AGRISTOCK_ANDROID_VERSION_CODE = "2.5";
    assert.throws(() => configure({ config: base }), /version code/);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("LAN testing uses a separate app, accepts HTTP and cannot mix with the operational release", () => {
  const names = [
    "AGRISTOCK_RELEASE",
    "AGRISTOCK_LAN_TEST",
    "AGRISTOCK_ALLOW_HTTP",
    "EXPO_PUBLIC_API_URL",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    process.env.AGRISTOCK_RELEASE = "0";
    process.env.AGRISTOCK_LAN_TEST = "1";
    process.env.AGRISTOCK_ALLOW_HTTP = "1";
    process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.63:3001";
    const config = configure({ config: base });
    assert.equal(config.name, "HTAgri Test");
    assert.equal(config.android.package, "vn.agristock.internal.lantest");
    assert.equal(config.extra.agristock.apiUrl, "http://192.168.1.63:3001");
    assert.equal(config.extra.agristock.release, false);
    assert.equal(config.extra.agristock.lanTest, true);
    assert.equal(
      config.plugins.find(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === "expo-build-properties",
      )[1].android.usesCleartextTraffic,
      true,
    );
    process.env.AGRISTOCK_RELEASE = "1";
    assert.throws(() => configure({ config: base }), /LAN test build/);
    process.env.AGRISTOCK_LAN_TEST = "0";
    process.env.EXPO_PUBLIC_API_URL = "https://api.cuahang.vn";
    assert.equal(
      configure({ config: base }).android.package,
      base.android.package,
    );
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
