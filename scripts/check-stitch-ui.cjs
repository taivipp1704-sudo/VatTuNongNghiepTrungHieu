const {
  chromium,
} = require("C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  file = path.join(root, ".local/stitch-ui-accounts.json");
const accounts = JSON.parse(fs.readFileSync(file, "utf8")),
  owner = accounts.accounts.find((a) => a.username === "owner");
const api = "http://127.0.0.1:3003/api";
let token = "";
const checks = [];
async function call(route, body, method) {
  const response = await fetch(api + route, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok, route + " " + response.status + " " + result.message);
  return result;
}
async function fixtureLogin() {
  const logged = await call("/auth/login", {
    username: owner.username,
    password: owner.nextPassword || owner.password,
  });
  token = logged.token;
  if (logged.user.mustChangePassword) {
    owner.nextPassword = crypto.randomBytes(24).toString("base64url");
    fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
    await call("/auth/password", {
      currentPassword: owner.password,
      newPassword: owner.nextPassword,
    });
    owner.password = owner.nextPassword;
    delete owner.nextPassword;
    fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
  }
}
(async () => {
  await fixtureLogin();
  const settings = await call("/loyalty/settings");
  await call(
    "/loyalty/settings",
    {
      ...settings,
      enabled: true,
      pointValue: 100,
      earningTiming: "FULL_PAYMENT",
      earningBase: "AFTER_DISCOUNT",
      rounding: "FLOOR",
      redeemEnabled: true,
      minRedeemPoints: 1,
      maxRedeemPercent: 20,
      reverseEarnOnReturn: true,
      refundSpentOnReturn: true,
    },
    "PATCH",
  );
  const products = await call("/inventory");
  const product = products.find((p) => p.sku === "PB001");
  assert.ok(product, "seed NPK");
  await call("/products/" + product.id + "/loyalty", { rate: 0.2 }, "PATCH");
  const customer = await call("/partners", {
    name: "Nguyễn Văn Hùng · QA " + Date.now().toString().slice(-4),
    kind: "CUSTOMER",
    phone: "0900000000",
    address: "Cai Lậy — dữ liệu kiểm thử",
    taxCode: "",
    creditLimit: 1000000,
  });
  customer.name = (await call("/partners")).find(
    (p) => p.id === customer.id,
  ).name;
  await call("/loyalty/customers/" + customer.id + "/adjust", {
    delta: 500,
    reason: "Số dư kiểm thử giao diện",
  });
  const before = (
    await call("/inventory?warehouseId=10000000-0000-4000-8000-000000000001")
  ).find((p) => p.id === product.id).available;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    let mainRequests = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes(":3001/api/")) mainRequests++;
    });
    page.on("dialog", (d) => d.accept());
    const tab = async (name) => {
      const target = page.getByText(name, { exact: true }).last();
      await target.waitFor();
      const box = await target.boundingBox();
      await target.click({
        position: {
          x: Math.max(1, box.width - 3),
          y: Math.min(4, box.height - 1),
        },
      });
    };
    const rootTab = async () => {
      for (let i = 0; i < 5; i++) {
        const back = page.getByRole("button", {
          name: "Quay lại",
          exact: true,
        });
        if (!(await back.isVisible())) break;
        await back.click();
        await page.waitForTimeout(100);
      }
    };
    const go = async (route) => {
      await rootTab();
      if (route === "/") {
        await tab("Tổng quan");
        await page.getByText("DOANH THU NGÀY", { exact: true }).waitFor();
        return;
      }
      if (route.startsWith("/pos?customerId=")) {
        await tab("Khách hàng");
        await page
          .getByLabel("Tìm đối tác", { exact: true })
          .fill(customer.id.slice(0, 6));
        await page
          .getByRole("button", { name: "Tạo đơn bán cho khách", exact: true })
          .click();
        await page
          .getByLabel("Tìm hàng hoặc mã vạch", { exact: true })
          .waitFor();
        return;
      }
      if (route === "/orders") {
        await tab("Đơn hàng");
        await page
          .getByLabel("Tìm mã đơn, khách hàng hoặc vận đơn", { exact: true })
          .waitFor();
        return;
      }
      if (route === "/customers") {
        await tab("Khách hàng");
        await page.getByLabel("Tìm đối tác", { exact: true }).waitFor();
        return;
      }
      await tab("Thêm");
      const label =
        route === "/loyalty"
          ? "Tích điểm khách hàng"
          : route === "/inventory"
            ? "Kho hàng"
            : "Quản trị nội bộ";
      await page.getByText(label, { exact: true }).first().click();
      if (route.startsWith("/admin"))
        await page
          .getByLabel("Khu vực quản trị", { exact: true })
          .selectOption("roles");
      await page
        .getByRole("button", { name: "Chọn kho làm việc", exact: true })
        .waitFor();
    };
    const screenshot = async (name) => {
      await page.evaluate(() => {
        document.activeElement?.blur();
        for (const e of document.querySelectorAll("*"))
          if (e.scrollTop) e.scrollTop = 0;
      });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: path.join(root, "artifacts/stitch-" + name + "-web.png"),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        name + " horizontal overflow",
      );
    };
    await page.goto("http://localhost:8081", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill("owner");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(owner.password);
    if (
      !(await page.getByLabel("Địa chỉ máy chủ", { exact: true }).isVisible())
    )
      await page
        .getByRole("button", { name: "Cấu hình kết nối cửa hàng", exact: true })
        .click();
    await page
      .getByLabel("Địa chỉ máy chủ", { exact: true })
      .fill("http://127.0.0.1:3003");
    await page.getByTestId("login-submit").click();
    await page
      .getByText("DOANH THU NGÀY", { exact: true })
      .waitFor({ timeout: 45000 });
    await screenshot("overview");
    checks.push("owner login and live overview");
    await go("/loyalty");
    await page
      .getByLabel("Giá trị quy đổi 1 điểm (VNĐ)", { exact: true })
      .fill("0");
    await page
      .getByRole("button", { name: "LƯU CẤU HÌNH TÍCH ĐIỂM", exact: true })
      .click();
    await page.getByText(/Kiểm tra giá trị một điểm/).waitFor();
    assert.equal(
      await page
        .getByLabel("Giá trị quy đổi 1 điểm (VNĐ)", { exact: true })
        .inputValue(),
      "0",
    );
    await page
      .getByLabel("Giá trị quy đổi 1 điểm (VNĐ)", { exact: true })
      .fill("100");
    await page
      .getByRole("button", { name: "LƯU CẤU HÌNH TÍCH ĐIỂM", exact: true })
      .click();
    await page
      .getByText("Đã lưu chương trình tích điểm.", { exact: true })
      .waitFor();
    await screenshot("loyalty");
    checks.push("settings validation, draft retention and successful retry");
    await go("/inventory");
    await page
      .getByLabel("Tìm tên hàng, SKU hoặc mã vạch", { exact: true })
      .fill("PB001");
    await page
      .getByRole("button", { name: "Sửa số chấm PB001", exact: true })
      .click();
    await page.getByLabel("Số chấm (%)", { exact: true }).fill("0,1");
    await page.route("**/api/products/*/loyalty", async (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Máy chủ kiểm thử tạm bận; giữ nội dung.",
        }),
      }),
    );
    await page
      .getByRole("button", { name: "Lưu số chấm", exact: true })
      .click();
    await page
      .getByText("Máy chủ kiểm thử tạm bận; giữ nội dung.", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Số chấm (%)", { exact: true }).inputValue(),
      "0,1",
    );
    await page.unroute("**/api/products/*/loyalty");
    await page
      .getByRole("button", { name: "Lưu số chấm", exact: true })
      .click();
    await page.getByText("Đã lưu tỷ lệ tích điểm.", { exact: true }).waitFor();
    assert.equal(
      (await call("/inventory")).find((p) => p.id === product.id).loyalty_rate,
      0.1,
    );
    checks.push("comma rate save, failed server save retains draft, recovery");
    await go("/inventory");
    await screenshot("inventory");
    await go("/pos?customerId=" + customer.id);
    await page
      .getByLabel("Tìm hàng hoặc mã vạch", { exact: true })
      .fill("PB001");
    await page.getByRole("button", { name: "Thêm PB001", exact: true }).click();
    await page.getByText("Dùng điểm trừ tiền", { exact: true }).waitFor();
    await page.getByText("Dùng điểm trừ tiền", { exact: true }).click();
    await page.getByLabel("Số điểm dùng giảm tiền", { exact: true }).fill("2");
    await page.getByTestId("checkout-submit").waitFor();
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-testid="checkout-submit"]');
      return b && b.getAttribute("aria-disabled") !== "true" && !b.disabled;
    });
    await screenshot("pos");
    await page.getByTestId("checkout-submit").click();
    await page
      .getByText("Đã ghi nhận đơn", { exact: true })
      .waitFor({ timeout: 30000 });
    const order = (await call("/orders")).find(
      (o) => o.customer_id === customer.id,
    );
    assert.ok(order);
    assert.equal(order.loyalty_spent, 2);
    assert.equal(order.loyalty_discount, 200);
    assert.equal(order.total, product.price_pack - 200);
    assert.equal(
      (await call("/loyalty/customers/" + customer.id)).balance,
      500 - 2 + order.loyalty_earned,
    );
    const after = (
      await call("/inventory?warehouseId=10000000-0000-4000-8000-000000000001")
    ).find((p) => p.id === product.id).available;
    assert.equal(after, before - product.pack_factor);
    checks.push("actual POS sale, redemption, stock and point balances");
    await go("/orders");
    await page
      .getByLabel("Tìm mã đơn, khách hàng hoặc vận đơn", { exact: true })
      .fill(order.code);
    const card = page.getByTestId("order-" + order.id);
    await card
      .getByRole("button", { name: "Chi tiết đơn / trả hàng", exact: true })
      .click();
    await card
      .getByLabel("Lý do trả hàng", { exact: true })
      .fill("Khách trả đơn kiểm thử giao diện");
    await card
      .getByRole("button", { name: "Trả toàn bộ & hoàn tiền", exact: true })
      .click();
    await card.getByText("Đã trả hàng", { exact: true }).waitFor();
    assert.equal(
      (await call("/loyalty/customers/" + customer.id)).balance,
      500,
    );
    checks.push("return reverses points and refunds redemption");
    await screenshot("orders");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Xuất Excel (CSV)", exact: true })
      .click();
    const download = await downloadPromise;
    const csvPath = path.join(root, "artifacts/stitch-orders-export.csv");
    await download.saveAs(csvPath);
    assert.ok(fs.readFileSync(csvPath, "utf8").includes(order.code));
    checks.push("real CSV export");
    await go("/customers");
    await page
      .getByLabel("Tìm đối tác", { exact: true })
      .fill(customer.id.slice(0, 6));
    await page
      .getByRole("button", { name: "Chỉnh điểm tay (Admin)", exact: true })
      .click();
    await page
      .getByLabel("Số điểm điều chỉnh (+ hoặc −)", { exact: true })
      .fill("100");
    await page
      .getByLabel("Lý do điều chỉnh điểm", { exact: true })
      .fill("Ưu đãi kiểm thử sau trả hàng");
    await page
      .getByRole("button", { name: "Xác nhận điều chỉnh điểm", exact: true })
      .click();
    await page
      .getByText("Đã điều chỉnh điểm cho " + customer.name + ".", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      (await call("/loyalty/customers/" + customer.id)).balance,
      600,
    );
    await screenshot("customers");
    checks.push("customer wallet, manual adjustment and audited history");
    await go("/admin?tab=roles");
    await page.getByText("Phân quyền & vai trò", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Tạo vai trò mới", exact: true })
      .click();
    const roleName = "Vai trò QA " + Date.now();
    await page.getByLabel("Tên vai trò", { exact: true }).fill(roleName);
    await page.getByText("Tạo đơn bán", { exact: true }).click();
    await page
      .getByRole("button", { name: "Lưu phân quyền vai trò", exact: true })
      .click();
    await page
      .getByText("Đã lưu role. Nhật ký thay đổi được ghi nhận.", {
        exact: true,
      })
      .waitFor();
    const savedRole = (await call("/admin/roles")).find(
      (r) => r.name === roleName,
    );
    assert.ok(savedRole.permissions.includes("sales.create"));
    checks.push("role permission toggle persists to API");
    const roles = await call("/admin/roles");
    await page
      .getByRole("button", {
        name:
          "Chọn vai trò " +
          roles.find(
            (r) => !r.protected && r.permissions.includes("sales.create"),
          ).name,
        exact: true,
      })
      .click();
    await screenshot("roles");
    const protectedRole = roles.find((r) => r.protected);
    await page
      .getByRole("button", {
        name: "Chọn vai trò " + protectedRole.name,
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Lưu phân quyền vai trò", exact: true })
        .isDisabled(),
      true,
    );
    checks.push("grouped RBAC and protected owner");
    await go("/");
    await screenshot("overview");
    assert.deepEqual(errors, [], "runtime errors");
    assert.equal(mainRequests, 0, "test must never call the main API");
    fs.writeFileSync(
      path.join(root, "artifacts/stitch-ui-validation.json"),
      JSON.stringify(
        {
          result: "PASS",
          viewport: "390x844",
          checks,
          mainApiRequests: mainRequests,
          nativeDeviceAcceptance: "pending",
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ result: "PASS", checks, mainApiRequests: mainRequests }),
    );
    await context.close();
  } finally {
    await browser.close();
    await call("/auth/logout", {});
  }
})().catch((error) => {
  let message = String(error.stack || error.message);
  for (const a of accounts.accounts)
    for (const value of [a.password, a.nextPassword])
      if (value) message = message.replaceAll(value, "[redacted]");
  console.error(message);
  process.exit(1);
});
