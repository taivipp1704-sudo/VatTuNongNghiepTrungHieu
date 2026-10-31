const { chromium } = require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, '.local/initial-accounts.json');
const accounts = JSON.parse(fs.readFileSync(file, 'utf8'));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const username of ['kho', 'banhang', 'ketoan']) {
      const account = accounts.accounts.find(item => item.username === username);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const text = value => page.getByText(value, {exact:true}).filter({visible:true});
      const label = value => page.getByLabel(value, {exact:true}).filter({visible:true});
      await page.goto('http://localhost:8081', {waitUntil:'domcontentloaded'});
      await label('Tên đăng nhập').fill(username);
      await label('Mật khẩu').fill(account.password);
      await page.getByRole('button', {name:'Đăng nhập',exact:true}).click();
      await page.waitForFunction(() => document.body.innerText.includes('Mật khẩu hiện tại') || document.body.innerText.includes('Chào '));
      if (await label('Mật khẩu hiện tại').count()) {
        account.nextPassword = crypto.randomBytes(24).toString('base64url');
        fs.writeFileSync(file, JSON.stringify(accounts,null,2));
        await label('Mật khẩu hiện tại').fill(account.password);
        await label('Mật khẩu mới (ít nhất 12 ký tự)').fill(account.nextPassword);
        await label('Nhập lại mật khẩu mới').fill(account.nextPassword);
        await page.getByRole('button', {name:'Lưu mật khẩu mới',exact:true}).click();
        await page.waitForFunction(() => document.body.innerText.includes('Chào '));
        account.password = account.nextPassword;
        delete account.nextPassword;
        fs.writeFileSync(file, JSON.stringify(accounts,null,2));
      }
      await page.screenshot({path:path.join(root,'artifacts/home-'+username+'.png')});
      if (username === 'kho') { await text('Kho').click(); await label('Tìm tên hàng, SKU hoặc mã vạch').waitFor(); }
      if (username === 'banhang') { await text('Bán hàng').click(); await label('Tìm hàng hoặc mã vạch').waitFor(); }
      if (username === 'ketoan') { await text('Công nợ').click(); await label('Sổ công nợ').waitFor(); }
      await text('Cá nhân').click();
      assert.equal(await text('Quản trị nội bộ').count(),0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      assert.deepEqual(errors,[]);
      console.log('PASS: '+username+' login, password gate, role navigation, admin hidden, mobile layout.');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {
  let message = String(error.message);
  for (const account of accounts.accounts) for(const secret of [account.password,account.nextPassword]) if(secret) message=message.replaceAll(secret,'[redacted]');
  console.error(message); process.exit(1);
});
