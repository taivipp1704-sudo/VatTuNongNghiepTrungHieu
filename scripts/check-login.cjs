const {chromium}=require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
  const directory=path.resolve(__dirname,'../artifacts');fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8081',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).waitFor({timeout:120000});
    await page.screenshot({path:path.join(directory,'login-mobile.png'),fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    console.log(JSON.stringify({errors,overflow,title:await page.title()}));
    if(errors.length||overflow)process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
