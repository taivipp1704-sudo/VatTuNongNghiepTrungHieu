const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const bundled='https://store.example.test';
function fixture(stored,token){
 const values=new Map([['server-url',stored]]),state={token,removed:0,calls:[]};
 const user={id:'owner-fixture',username:'qa',owner:true,dataEpoch:'live-generation',mustChangePassword:false,permissions:[],warehouseIds:[],roles:[]};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/session.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const dependencies={zustand:require('zustand'),'expo-constants':{__esModule:true,default:{expoConfig:{extra:{agristock:{release:true,apiUrl:bundled}}}}},'expo-device':{isDevice:true},'./credentials':{credentials:{get:async()=>state.token,set:async t=>{state.token=t},remove:async()=>{state.token=null;state.removed++}}},'./cache':{localGet:async k=>values.get(k)??null,localSet:async(k,v)=>values.set(k,v),clearUserCache:async prefix=>{for(const k of values.keys())if(k.startsWith(prefix))values.delete(k)}},'../../config/server-url.cjs':require('./server-url.cjs')};
 state.respond=async url=>new Response(JSON.stringify(url.endsWith('/auth/login')?{token:'new-fixture-token',user}:user),{status:200});
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in dependencies))throw Error('Unexpected import '+id);return dependencies[id]},process:{env:{EXPO_OS:'android'}},AbortSignal,fetch:async(url,options)=>{state.calls.push({url,authorization:options.headers?.Authorization});return state.respond(url,options)}});
 return {store:module.exports.useSession,state,values};
}
test('operational app replaces legacy endpoint once and never sends its credential to another store',async()=>{
 const {store,state,values}=fixture('https://old.example.test','old-fixture-token');await store.getState().hydrate();assert.equal(state.removed,1);assert.equal(state.calls.length,0);assert.equal(values.get('server-url'),bundled);assert.equal(store.getState().apiUrl,bundled);
 await store.getState().login('qa','fixture-only-password');await store.getState().hydrate();assert.equal(state.removed,1);assert.equal(store.getState().user.username,'qa');assert.ok(state.calls.every(x=>x.url.startsWith(bundled+'/api/')));assert.ok(state.calls.every(x=>x.authorization!=='Bearer old-fixture-token'));
});
test('automatic restore failure stays quiet while manual invalid-login errors remain actionable',async()=>{
 const {store,state}=fixture(bundled,'current-fixture-token');state.respond=async()=>{throw Error('offline fixture')};await store.getState().hydrate();assert.equal(store.getState().message,'');assert.equal(store.getState().offline,true);assert.equal(store.getState().user,null);assert.equal(state.removed,0);
 state.respond=async()=>new Response(JSON.stringify({message:'Tên đăng nhập hoặc mật khẩu không đúng.'}),{status:401});await assert.rejects(()=>store.getState().login('qa','wrong-fixture-password'),/Tên đăng nhập hoặc mật khẩu không đúng/);
});
