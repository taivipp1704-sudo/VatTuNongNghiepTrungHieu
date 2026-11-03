const {chromium}=require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const wid='10000000-0000-4000-8000-000000000001';
const oid='30000000-0000-4000-8000-000000000001';
async function scenario(browser,{allowed=true,returned=false,limit=0,failList=false,upload=false}) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const user={id:'qa-user',username:'qa',name:'Nhân viên minh họa',owner:false,mustChangePassword:false,permissions:['sales.view',...(allowed?['sales.fulfillment']:[])],warehouseIds:[wid],roles:[],dataEpoch:'photo-ui-v20'};
  let photos=Array.from({length:limit},(_,i)=>({id:'photo-'+i,note:'Ảnh minh họa',actor:user.name,created_at:'2026-11-03T07:00:00Z'}));
  let listAttempts=0;const posts=[];let failedPost=false;
  await context.route('**/api/**',async route=>{
    const req=route.request(), url=new URL(req.url()),p=url.pathname.slice(4);
    const json=async(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
    if(req.method()==='OPTIONS') return json({});
    if(p==='/auth/login')return json({token:'qa-only-no-real-server',user});
    if(p==='/me')return json(user);
    if(p==='/bootstrap')return json({user,warehouses:[{id:wid,name:'Kho minh họa',address:''}],store:{name:'HTAgri',address:'',phone:''},permissions:user.permissions});
    if(p==='/dashboard')return json({revenue:0,collected:0,pending:0,expiring:0,expired:0,orders:0,receivables:0,payables:0,orderCounts:{trading:0,completed:0,returned:0},alerts:[],shortages:[],stock:[]});
    if(p==='/orders')return json([{id:oid,code:'DH-MINH-HOA',created_at:'2026-11-03T07:00:00Z',customer_name:'Khách minh họa',total:100000,paid:100000,returned,actor:user.name,lines:[],list_total:1}]);
    if(p===`/orders/${oid}/photos`){
      if(req.method()==='POST'){
        posts.push({body:req.postDataJSON(),key:req.headers()['idempotency-key']});
        if(!failedPost){failedPost=true;return route.abort('failed');}
        photos.push({id:'saved-photo',note:posts[0].body.note,actor:user.name,created_at:'2026-11-03T07:05:00Z'});
        return json({id:'saved-photo'},201);
      }
      if(failList&&++listAttempts<=2){return json({message:'Không tải được ảnh minh họa'},503);}
      return json(photos);
    }
    if(p.startsWith('/photos/'))return json({dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxcoAAAAASUVORK5CYII='});
    return json([]);
  });
  await page.goto('http://localhost:8081/login',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Tên đăng nhập',{exact:true}).fill('qa');
  await page.getByLabel('Mật khẩu',{exact:true}).fill('QA-only-Not-An-Account');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.getByRole('tab',{name:/Đơn hàng/}).click();
  await page.getByRole('button',{name:'Mở đơn DH-MINH-HOA',exact:true}).click();
  await page.getByText('Ảnh xác nhận đơn hàng',{exact:true}).waitFor();
  const capture=page.getByRole('button',{name:'Chụp ảnh xác nhận',exact:true});
  if(failList){
    await page.getByText('Chưa tải được ảnh của đơn hàng.',{exact:true}).waitFor();
    assert.equal(await capture.count(),0);
    await page.getByRole('button',{name:'Tải lại danh sách ảnh',exact:true}).click();
  }
  if(allowed&&!returned&&limit<5){await capture.waitFor();}
  else{assert.equal(await capture.count(),0);}
  if(upload){
    const chooserPromise=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Chọn ảnh chụp sẵn',exact:true}).click();
    const chooser=await chooserPromise;
    await chooser.setFiles(path.join(root,'apps/mobile/assets/images/htagri-logo.png'));
    const note=page.getByLabel('Ghi chú ảnh',{exact:true});await note.fill('Khách đã nhận hàng tại quầy');
    await page.getByRole('button',{name:'Lưu ảnh xác nhận',exact:true}).click();
    await page.getByText('Nội dung lần gửi trước được giữ nguyên để thử lại an toàn.',{exact:true}).waitFor();
    assert.equal(await note.isEditable(),false);
    assert.equal(await page.getByRole('button',{name:'Chọn ảnh chụp sẵn',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Lưu ảnh xác nhận',exact:true}).click();
    await page.getByText('Khách đã nhận hàng tại quầy',{exact:true}).waitFor();
    assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);assert.deepEqual(posts[0].body,posts[1].body);
    assert.ok(posts[0].body.base64.length>0);assert.equal(posts[0].body.confirmDelivered,undefined);
    assert.equal(await page.getByLabel('Ghi chú ảnh',{exact:true}).count(),0);
    await page.screenshot({path:path.join(root,'artifacts/order-photo-v20-saved-390.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.close();console.log('PASS',JSON.stringify({allowed,returned,limit,failList,upload}));
}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{await scenario(b,{upload:true});await scenario(b,{allowed:false});await scenario(b,{returned:true});await scenario(b,{limit:5});await scenario(b,{failList:true});}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
