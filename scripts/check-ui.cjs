const { chromium } = require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, '.local/initial-accounts.json');
const accounts = JSON.parse(fs.readFileSync(file, 'utf8'));
const account = accounts.accounts.find(account => account.username === 'owner');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const visibleText=(text,options)=>page.getByText(text,options).filter({visible:true});
    const visibleLabel=(text,options)=>page.getByLabel(text,options).filter({visible:true});
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
    await visibleLabel('Tên đăng nhập', { exact: true }).fill(account.username);
    await visibleLabel('Mật khẩu', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Mật khẩu hiện tại') || document.body.innerText.includes('Chào '), { timeout: 30000 });
    if (await visibleLabel('Mật khẩu hiện tại', { exact: true }).count()) {
      account.nextPassword = crypto.randomBytes(24).toString('base64url');
      fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
      await visibleLabel('Mật khẩu hiện tại', { exact: true }).fill(account.password);
      await visibleLabel('Mật khẩu mới (ít nhất 12 ký tự)', { exact: true }).fill(account.nextPassword);
      await visibleLabel('Nhập lại mật khẩu mới', { exact: true }).fill(account.nextPassword);
      await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click();
      await visibleText('Chào Văn Hòa.', { exact: true }).waitFor({ timeout: 30000 });
      account.password = account.nextPassword;
      delete account.nextPassword;
      fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
    }
    await visibleText('Chào Văn Hòa.', { exact: true }).waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(root, 'artifacts/home-mobile.png'), fullPage: true });
    await visibleText('Tra cứu tồn kho', { exact: true }).click();
    await visibleText('Phân bón NPK 16-16-8', { exact: true }).waitFor();
    await visibleLabel('Tìm tên hàng, SKU hoặc mã vạch', { exact: true }).fill('ure');
    await visibleText('Phân urê 46%', { exact: true }).waitFor();
    assert.equal(await visibleText('Phân bón NPK 16-16-8', { exact: true }).count(), 0);
    await visibleLabel('Tìm tên hàng, SKU hoặc mã vạch', { exact: true }).fill('');
    await page.screenshot({ path: path.join(root, 'artifacts/inventory-mobile.png'), fullPage: true });
    await page.mouse.click(24, 32);
    await page.getByRole('button', { name: 'Tạo đơn bán', exact: true }).click();
    await visibleLabel('Tìm hàng hoặc mã vạch', { exact: true }).fill('PB001');
    await page.getByRole('button', { name: 'Thêm PB001', exact: true }).click();
    await visibleLabel('Số lượng', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Ghi nhận đơn bán', exact: true }).click();
    await visibleText(/Đã ghi nhận DH-/).waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(root, 'artifacts/pos-mobile.png'), fullPage: true });
    await page.mouse.click(24, 32);
    await visibleText('Bán hàng', { exact: true }).click();
    await visibleText('Giỏ hàng · 0 mặt hàng', { exact: true }).waitFor();
    await visibleText('Khác', { exact: true }).click();
    await visibleText('Quản trị nội bộ', { exact: true }).click();
    await visibleText('Lê Thị Ngọc Mai', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, 'artifacts/admin-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', checks: ['login', 'password change', 'role-based home', 'inventory search', 'real POS sale', 'admin accounts', 'mobile layout'], errors }));
  } catch(error) { if(page) { await page.screenshot({path:path.join(root,'artifacts/ui-failure-mobile.png'),fullPage:true}); console.log('UI failure route: '+page.url()); } throw error; } finally { await browser.close(); }
})().catch(error => { console.error(String(error.message).replaceAll(account.password,'[redacted]').replaceAll(account.nextPassword||'__no_pending_password__','[redacted]')); process.exit(1); });
