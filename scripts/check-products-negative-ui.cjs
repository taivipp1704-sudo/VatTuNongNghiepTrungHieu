const {chromium}=require('C:/Users/taivi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),wid='10000000-0000-4000-8000-000000000001';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();const errors=[],products=[],sales=[];let policy=true,failSave=true;
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  const permissions=['sales.view','sales.create','sales.negative','products.manage','inventory.view','inventory.cost.view','settings.manage'];
  const user={id:'qa',username:'qa',name:'Nhân viên minh họa',owner:false,mustChangePassword:false,permissions,warehouseIds:[wid],roles:[],dataEpoch:'products21'};
  const bottle={id:'20000000-0000-4000-8000-000000000001',sku:'BVTV-01',name:'Thuốc BVTV minh họa',category:'Thuốc BVTV',base_unit:'chai',pack_unit:'chai',pack_factor:1,price_base:25000,price_pack:25000,cost_base:15000,available:0,actual:0,lots:[],details:{sellable:true},loyalty_rate:0};
  await c.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),u=url.pathname.slice(4),data=req.method()==='POST'?req.postDataJSON():null;
   const json=(v,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(v)});
   if(req.method()==='OPTIONS')return json({});
   if(u==='/auth/login')return json({token:'qa-browser-only',user});if(u==='/me')return json(user);
   if(u==='/bootstrap')return json({user,warehouses:[{id:wid,name:'Kho minh họa',address:''}],store:{name:'HTAgri',address:'',phone:''},inventoryPolicy:{allowNegativeStock:policy},permissions});
   if(u==='/dashboard')return json({revenue:0,collected:0,pending:0,expiring:0,expired:0,orders:0,receivables:0,payables:0,orderCounts:{trading:0,completed:0,returned:0},alerts:[],shortages:[],stock:[]});
   if(u==='/products'){products.push(data);if(failSave){failSave=false;return json({message:'Chưa lưu được sản phẩm. Thử lại.'},503);}return json({id:'created-'+products.length},201);}
   if(u==='/inventory')return json([bottle]);
   if(u==='/settings/inventory'){policy=data.allowNegativeStock;return json(data,201);}
   if(u==='/loyalty/settings')return json({enabled:false,pointValue:1000,redeemEnabled:false});
   if(u==='/partners')return json([]);
   if(u==='/loyalty/quote')return json({total:25000,loyaltyDiscount:0,potentialPoints:0,availablePoints:0,earnedPoints:0,settings:{enabled:false,redeemEnabled:false},redeemPoints:0});
   if(u==='/sales'){sales.push(data);return json({id:'sale',code:'DH-MINH-HOA',total:25000,paid:25000,debt:0,loyalty_earned:0},201);}
   return json([]);
  });
  await p.goto('http://localhost:8081/login');await p.getByLabel('Tên đăng nhập',{exact:true}).fill('qa');await p.getByLabel('Mật khẩu',{exact:true}).fill('QA-Only-Not-Real-Account');await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await p.getByRole('tab',{name:/Sản phẩm/}).click();
  async function openProduct(){await p.getByRole('button',{name:'Thêm sản phẩm',exact:true}).click();await p.getByRole('button',{name:'Chọn nhóm hàng',exact:true}).click();}
  await openProduct();await p.getByRole('radio',{name:'Thuốc BVTV',exact:true}).click();
  assert.equal(await p.getByLabel('Đơn vị cơ sở',{exact:true}).inputValue(),'chai');assert.equal(await p.getByLabel('Đơn vị đóng gói',{exact:true}).inputValue(),'chai');
  await p.getByLabel('Tên hàng hóa',{exact:true}).fill('Thuốc trừ sâu minh họa');await p.getByLabel('Mã hàng (SKU)',{exact:true}).fill('BVTV-NEW');
  await p.getByLabel('Giá bán / đơn vị cơ sở (đồng)',{exact:true}).fill('25.000');await p.getByLabel('Giá vốn / đơn vị cơ sở (đồng)',{exact:true}).fill('15.000');
  await p.getByTestId('product-save').click();await p.getByText('Chưa lưu được sản phẩm. Thử lại.',{exact:true}).waitFor();
  assert.equal(await p.getByLabel('Tên hàng hóa',{exact:true}).inputValue(),'Thuốc trừ sâu minh họa');
  await p.getByTestId('product-save').click();await p.getByRole('button',{name:'Thêm sản phẩm',exact:true}).waitFor();
  assert.equal(products.length,2);assert.deepEqual(products[0],products[1]);assert.equal(products[1].category,'Thuốc BVTV');assert.equal(products[1].priceBase,25000);assert.equal(products[1].pricePack,25000);assert.equal(products[1].costBase,15000);assert.equal(products[1].packFactor,1);
  console.log('PASS BVTV inline group, bottle defaults, Vietnamese money, single-unit price fallback and failed-save retry');
  for(const category of ['Phân bón','Hạt giống','Vật tư']){
   await openProduct();await p.getByRole('radio',{name:category,exact:true}).click();await p.getByLabel('Tên hàng hóa',{exact:true}).fill('Hàng '+category);await p.getByLabel('Mã hàng (SKU)',{exact:true}).fill('QA-'+products.length);
   await p.getByLabel('Giá bán / đơn vị cơ sở (đồng)',{exact:true}).fill('10000');await p.getByLabel('Giá bán / đơn vị đóng gói (đồng)',{exact:true}).fill('10000');await p.getByLabel('Giá vốn / đơn vị cơ sở (đồng)',{exact:true}).fill('5000');
   await p.getByTestId('product-save').click();await p.getByRole('button',{name:'Thêm sản phẩm',exact:true}).waitFor();assert.equal(products.at(-1).category,category);
  }
  console.log('PASS create other 3 product groups');
  await p.getByRole('tab',{name:/Bán hàng/}).click();await p.getByRole('button',{name:'Chọn sản phẩm',exact:true}).click();
  await p.getByRole('button',{name:'Thêm BVTV-01',exact:true}).click();await p.getByRole('button',{name:'Mở thanh toán',exact:true}).click();
  await p.getByText(/Đơn này bán vượt tồn/).waitFor();
  await p.screenshot({path:path.join(root,'artifacts/negative-stock-v21-checkout-390.png')});
  await p.getByRole('button',{name:'Ghi nhận đơn bán',exact:true}).click();await p.getByText('Đã ghi nhận đơn',{exact:true}).waitFor();assert.equal(sales.length,1);assert.equal(sales[0].lines[0].quantity,1);
  console.log('PASS zero-stock product can be sold with negative permission; checkout warns before posting');
  assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await c.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});

