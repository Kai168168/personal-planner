import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeStates,sameState} from '../sync-model.js';
import {CloudClient,validCloudConfig} from '../cloud.js';
import {validState,validTimeRange,swipeStatus} from '../model.js';

const empty=()=>({version:1,assets:null,tasks:[],expenses:[]});
const task=(id,updatedAt=1,status='pending')=>({id,title:'阅读',date:'2026-10-26',time:'09:00',endTime:'10:00',note:'',color:'blue',status,updatedAt});
const memory=()=>{const items=new Map();return {getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const config={url:'https://example.supabase.co',key:'sb_publishable_test'};
function client(fetcher) {
  const c=new CloudClient(config,{fetcher,storage:memory()});
  c.remember({user:{id:'user-one',email:'test@example.com'},access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600});
  return c;
}
test('三态映射有明确的中间待办，不沿用之前完成状态',()=>{
  assert.equal(swipeStatus(-100),'missed');assert.equal(swipeStatus(100),'done');
  assert.equal(swipeStatus(0),'pending');assert.equal(swipeStatus(54),'pending');assert.equal(swipeStatus(-54),'pending');
});
test('时间区间校验及旧版任务兼容',()=>{
  assert.ok(validTimeRange('09:00','10:00'));assert.ok(!validTimeRange('10:00','09:00'));assert.ok(!validTimeRange('09:00','09:00'));
  assert.ok(!validTimeRange('25:00','26:00'));assert.ok(!validTimeRange('09:00',''));
  const old=task('a');delete old.endTime;assert.ok(validState({...empty(),tasks:[old]}));
  assert.ok(!validState({...empty(),tasks:[{...task('a'),endTime:'08:00'}]}));
  assert.ok(!validState({...empty(),tasks:[null]}));
});
test('离线新增与较新状态合并；删除标记不会被另一台设备复活',()=>{
  const a={...empty(),tasks:[task('a',1),task('b',3)],sync:{assetsAt:0,deletedTasks:{gone:4},deletedExpenses:{}}};
  const b={...empty(),tasks:[task('a',5,'done'),task('gone',2)]};
  const result=mergeStates(a,b);
  assert.deepEqual(result.tasks.map(t=>t.id),['a','b']);assert.equal(result.tasks[0].status,'done');
  assert.ok(sameState(result,mergeStates(b,a)));assert.ok(sameState(result,mergeStates(result,result)));
});
test('资产和开销独立合并，保留较新的资产设置',()=>{
  const a={...empty(),assets:10000,sync:{assetsAt:5,deletedTasks:{},deletedExpenses:{}}};
  const b={...empty(),assets:5000,expenses:[{id:'expense',title:'午餐',date:'2026-10-26',amount:2000,category:'餐饮美食',updatedAt:8}],sync:{assetsAt:3,deletedTasks:{},deletedExpenses:{}}};
  assert.equal(mergeStates(a,b).assets,10000);assert.equal(mergeStates(a,b).expenses.length,1);
});
test('公钥配置拒绝私钥和非 Supabase HTTPS 域名',()=>{
  assert.ok(validCloudConfig(config));assert.ok(!validCloudConfig({...config,key:'sb_secret_do-not-use'}));
  assert.ok(!validCloudConfig({...config,url:'http://example.supabase.co'}));
  assert.ok(!validCloudConfig({...config,url:'https://example.supabase.co.evil.example'}));
});
test('首次同步创建所有者文档并传递认证',async()=>{
  let payload;
  const c=client(async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer test-access');
    if(options.method==='GET')return response([]);
    payload=JSON.parse(options.body);assert.equal(payload.user_id,'user-one');
    return response([payload],201);
  });
  const local={...empty(),tasks:[task('a')]};const result=await c.exchange(local);
  assert.equal(payload.revision,1);assert.deepEqual(result,local);
});
test('并发版本冲突时重读并合并，避免覆盖另一台设备的新增',async()=>{
  let gets=0,patches=0;
  const c=client(async(url,options)=>{
    if(options.method==='GET'){gets++;return response([{revision:gets===1?1:2,payload:{...empty(),tasks:gets===1?[]:[task('remote',2)]}}]);}
    patches++;
    if(patches===1)return response([]);
    assert.match(url,/revision=eq.2/);const row=JSON.parse(options.body);return response([row]);
  });
  const result=await c.exchange({...empty(),tasks:[task('local')]});
  assert.equal(gets,2);assert.equal(patches,2);assert.deepEqual(result.tasks.map(t=>t.id),['local','remote']);
});
test('远端失败时不生成同步成功结果',async()=>{
  const c=client(async()=>response({message:'permission denied'},403));
  await assert.rejects(()=>c.exchange(empty()),/权限不足/);
});
test('会话临近过期时先刷新，再发送数据库请求',async()=>{
  const c=client(async(url,options)=>{
    if(url.includes('/auth/v1/')){assert.equal(JSON.parse(options.body).refresh_token,'test-refresh');return response({access_token:'fresh-access',refresh_token:'fresh-refresh',expires_in:3600,user:{id:'user-one'}});}
    assert.equal(options.headers.Authorization,'Bearer fresh-access');
    if(options.method==='GET')return response([]);
    return response([JSON.parse(options.body)],201);
  });
  c.session.expires_at=1;await c.exchange(empty());
  assert.equal(c.session.refresh_token,'fresh-refresh');
});
test('退出期间返回的旧刷新请求不能恢复已退出的会话',async()=>{
  let finishRefresh;
  const c=client(async url=>{
    if(url.includes('grant_type=refresh_token'))return new Promise(resolve=>{finishRefresh=resolve;});
    return response({});
  });
  c.session.expires_at=1;
  const request=c.exchange(empty());
  await c.signOut();
  finishRefresh(response({access_token:'stale-access',refresh_token:'stale-refresh',expires_in:3600,user:{id:'user-one'}}));
  await assert.rejects(request,/已退出/);
  assert.equal(c.session,null);
});
