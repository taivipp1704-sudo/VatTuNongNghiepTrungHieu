const {chromium} = require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [], requests = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.url().includes('/api/auth/login'))requests.push(request.url());});
    await page.goto('http://localhost:8082',{waitUntil:'domcontentloaded'});
    const server = page.getByLabel('Địa chỉ máy chủ',{exact:true});
    await server.waitFor();
    assert.equal(await server.inputValue(),'');
    const submit = page.getByRole('button',{name:'Đăng nhập',exact:true});
    assert.equal(await submit.isDisabled(),true);
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/release-first-launch-web.png')});
    await page.getByLabel('Tên đăng nhập',{exact:true}).fill('release-ui-check');
    await page.getByLabel('Mật khẩu',{exact:true}).fill(randomUUID());
    await server.fill('http://127.0.0.1:3001');
    await submit.click();
    await page.getByText('Bản vận hành cần máy chủ HTTPS mà điện thoại truy cập được.',{exact:true}).waitFor();
    assert.equal(requests.length,0);
    assert.deepEqual(errors,[]);
    console.log('PASS: release opens with an empty server, requires configuration, blocks HTTP before sending credentials, and has no browser errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.message);process.exit(1);});
