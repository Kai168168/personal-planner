import {categories,dateKey,monday,addDays,money,totals,validState,taskColor,validTimeRange,swipeStatus} from './model.js?v=5';
import {CloudClient,validCloudConfig} from './cloud.js?v=5';
import {mergeStates,syncMeta,sameState} from './sync-model.js?v=5';
import {cloudConfig} from './sync-config.js?v=5';
const $ = s => document.querySelector(s);
let key='daybyday.v1';
let editingTaskId=null;
const guestKey='daybyday.v1';
let cloud=null,syncTimer,syncBusy=false,syncAgain=false,lastStamp=0;
let state={version:1,assets:null,tasks:[],expenses:[]}, week=monday();
let storageFailed=false;
try { const stored=localStorage.getItem(key); if(stored) { const parsed=JSON.parse(stored); if(!validState(parsed)) throw Error(); state=parsed; } } catch { storageFailed=true; }
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(message){ $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,3200); }
function writeLocal(){try{localStorage.setItem(key,JSON.stringify(state));}catch{toast('浏览器存储不可用，请导出备份，避免数据丢失。');}}
function save(){writeLocal();render();queueSync();}
function stamp(){
 const meta=syncMeta(state);let maximum=Math.max(Date.now(),lastStamp,meta.assetsAt||0);
 for(const item of [...state.tasks,...state.expenses])maximum=Math.max(maximum,item.updatedAt||0);
 for(const value of [...Object.values(meta.deletedTasks),...Object.values(meta.deletedExpenses)])maximum=Math.max(maximum,value);
 lastStamp=maximum+1;return lastStamp;
}
function updateProgress(){
 const tasks=state.tasks.filter(t=>t.date===dateKey()), done=tasks.filter(t=>t.status==='done').length;
 const percent=tasks.length?Math.round(done/tasks.length*100):0;
 $('#today-count').textContent=`${done} / ${tasks.length} · ${percent}%`;
 $('#today-bar').setAttribute('aria-valuenow',percent);
 $('#today-bar').setAttribute('aria-valuetext',`今日 ${tasks.length} 项，已完成 ${done} 项`);
 $('#today-fill').style.width=percent+'%';
 const weekly=state.tasks.filter(t=>t.date>=dateKey(week)&&t.date<dateKey(addDays(week,7)));
 $('#progress').textContent=`本周 ${weekly.length} 项 · 已完成 ${weekly.filter(t=>t.status==='done').length} 项`;
}
function statusValue(status){return status==='done'?100:status==='missed'?-100:0;}
function statusText(status){return status==='done'?'已完成':status==='missed'?'未完成':'待办';}
function renderPlan(){
 const today=dateKey();
 $('#week-label').textContent=`${week.getFullYear()}年 ${week.getMonth()+1}月${week.getDate()}日 — ${addDays(week,6).getMonth()+1}月${addDays(week,6).getDate()}日`;
 const names=['Mon 周一','Tue 周二','Wed 周三','Thu 周四','Fri 周五','Sat 周六','Sun 周日'];
 $('#board').innerHTML=names.map((name,i)=>{
  const d=addDays(week,i),date=dateKey(d),tasks=state.tasks.filter(t=>t.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  return `<section class="day ${date===today?'today':''}"><div class="day-header"><div><div class="day-name">${name}</div><div class="day-number">${String(d.getDate()).padStart(2,'0')}</div></div>${date===today?'<span class="today-badge">今天</span>':''}</div>${tasks.map(t=>`<article class="task ${t.status}" style="--task-bg:${taskColor(t.title).background};--task-edge:${taskColor(t.title).edge};--slide:${statusValue(t.status)}" data-id="${escape(t.id)}" tabindex="0" role="slider" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="${statusValue(t.status)/100}" aria-valuetext="${statusText(t.status)}" aria-label="${escape(t.title)}，左右拖动改变状态，Home 恢复待办"><div class="task-top"><h3>${escape(t.title)}</h3><div class="card-tools"><button data-action="edit" aria-label="编辑任务" class="edit-task">编辑</button><button data-action="delete" class="delete" aria-label="删除任务">×</button></div></div>${t.time?`<div class="task-time">${escape(t.time)}${t.endTime?`–${escape(t.endTime)}`:' · 未设结束时间'}</div>`:''}${t.note?`<p class="task-note">${escape(t.note)}</p>`:''}<div class="task-status">${statusText(t.status)}</div></article>`).join('')}<button class="add-day" data-date="${date}">＋ 添加任务</button></section>`;
 }).join('');
 updateProgress();
}
const icons=['◒','↗','▧','⌂','♫','▤','♡','⋯'];
function renderMoney(){ const t=totals(state.expenses,state.assets); $('#assets-value').textContent=state.assets===null?'待设置':money(state.assets); $('#balance-value').textContent=t.balance===null?'—':money(t.balance); $('#week-value').textContent=money(t.week); $('#month-value').textContent=money(t.month); $('#month-caption').textContent=`${new Date().getFullYear()}年 ${new Date().getMonth()+1}月`; $('#expense-total').textContent=`共 ${state.expenses.length} 笔 · ${money(t.all)}`; $('#expense-list').innerHTML=[...state.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="expense-row"><span class="category-icon">${icons[categories.indexOf(e.category)]}</span><div class="expense-info"><strong>${escape(e.title)}</strong><small>${escape(e.date)} · ${escape(e.category)}</small></div><span class="expense-amount">−${money(e.amount)}</span><button class="delete-expense" data-id="${escape(e.id)}" aria-label="删除开销">×</button></div>`).join('')||'<p class="empty">暂无开销记录</p>'; const groups=categories.map(category=>({category,amount:state.expenses.filter(e=>e.category===category&&e.date.startsWith(dateKey().slice(0,7))).reduce((s,e)=>s+e.amount,0)})).filter(g=>g.amount).sort((a,b)=>b.amount-a.amount); $('#categories').innerHTML=groups.map(g=>`<div class="category-row"><div class="category-label"><span>${g.category}</span><span>${money(g.amount)} · ${Math.round(g.amount/t.month*100)}%</span></div><div class="bar"><i style="width:${g.amount/t.month*100}%"></i></div></div>`).join('')||'<p class="empty">本月暂无开销</p>'; }
function render(){renderPlan();renderMoney();}
function openTask(date=dateKey(),task=null){
 const f=$('#task-form');f.reset();editingTaskId=task?.id||null;f.elements.date.value=task?.date||date;
 for(const name of ['title','time','endTime','note'])f.elements[name].value=task?.[name]||'';
 f.elements.endTime.setCustomValidity('');$('#task-dialog-title').textContent=task?'编辑任务':'添加任务';$('#task-dialog').showModal();
}
function checkTimes(){const f=$('#task-form');f.elements.endTime.setCustomValidity(validTimeRange(f.elements.time.value,f.elements.endTime.value)?'':'结束时间必须晚于开始时间');}
$('#task-form [name=time]').oninput=checkTimes;$('#task-form [name=endTime]').oninput=checkTimes;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==b.dataset.view);});
$('#new-task').onclick=()=>openTask(); $('#prev-week').onclick=()=>{week=addDays(week,-7);renderPlan();}; $('#next-week').onclick=()=>{week=addDays(week,7);renderPlan();}; $('#this-week').onclick=()=>{week=monday();renderPlan();};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#task-form').onsubmit=e=>{
 e.preventDefault();const f=e.currentTarget,title=f.elements.title.value.trim();checkTimes();if(!title||!f.reportValidity())return;
 const fields={updatedAt:stamp(),title,date:f.elements.date.value,time:f.elements.time.value,endTime:f.elements.endTime.value,note:f.elements.note.value.trim()};
 if(editingTaskId)Object.assign(state.tasks.find(t=>t.id===editingTaskId),fields);
 else state.tasks.push({id:crypto.randomUUID(),...fields,color:'blue',status:'pending'});
 week=monday(new Date(fields.date+'T12:00:00'));save();$('#task-dialog').close();
};
$('#board').onclick=e=>{const add=e.target.closest('[data-date]');if(add){openTask(add.dataset.date);return;}const b=e.target.closest('[data-action]');if(!b)return;const id=b.closest('.task').dataset.id;updateTask(id,b.dataset.action);};
function updateTask(id,action){
 if(action==='edit'){const t=state.tasks.find(t=>t.id===id);openTask(t.date,t);return;}
 if(action==='delete'){if(!confirm('删除这项任务？'))return;syncMeta(state).deletedTasks[id]=stamp();state.tasks=state.tasks.filter(t=>t.id!==id);save();}
}
function paintStatus(card,status){
 card.style.removeProperty('--preview-bg');card.style.removeProperty('--drag-x');
 card.classList.remove('dragging','done','missed','pending');card.classList.add(status);
 card.setAttribute('aria-valuenow',statusValue(status)/100);card.setAttribute('aria-valuetext',statusText(status));
 card.querySelector('.task-status').textContent=statusText(status);
}
function persistStatus(card,value){
 const task=state.tasks.find(t=>t.id===card.dataset.id);if(!task)return;
 task.status=swipeStatus(value);task.updatedAt=stamp();paintStatus(card,task.status);
 writeLocal();queueSync();
 updateProgress();
}
function previewSlide(card,value,dx){
 card.classList.add('dragging');card.style.setProperty('--drag-x',`${Math.max(-28,Math.min(28,dx*.18))}px`);
 const status=swipeStatus(value);
 card.style.setProperty('--preview-bg',status==='pending'?'var(--task-bg)':`color-mix(in srgb, ${value>=0?'#0c3023':'#35171d'} ${Math.min(100,Math.abs(value))}%, var(--task-bg))`);
 card.querySelector('.task-status').textContent=statusText(status);
}
let drag=null;
$('#board').addEventListener('pointerdown',e=>{
 const card=e.target.closest('.task');if(!card||e.target.closest('button')||e.button!==0)return;
 drag={card,x:e.clientX,y:e.clientY,pointer:e.pointerId,status:state.tasks.find(t=>t.id===card.dataset.id).status,moved:false};card.setPointerCapture(e.pointerId);
});
$('#board').addEventListener('pointermove',e=>{
 if(!drag||drag.pointer!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}
 if(!drag.moved&&Math.abs(dx)<6)return;drag.moved=true;
 drag.current=Math.max(-100,Math.min(100,dx/Math.max(80,drag.card.clientWidth*.35)*100));previewSlide(drag.card,drag.current,dx);
});
function finishDrag(e,cancel=false){if(!drag||drag.pointer!==e.pointerId)return;const d=drag;drag=null;if(!d.moved)return;if(cancel)paintStatus(d.card,d.status);else persistStatus(d.card,d.current);}
$('#board').addEventListener('pointerup',e=>finishDrag(e));$('#board').addEventListener('pointercancel',e=>finishDrag(e,true));
$('#board').addEventListener('lostpointercapture',e=>finishDrag(e,true));
$('#board').addEventListener('keydown',e=>{const card=e.target.closest('.task');if(!card||e.target.closest('button'))return;const values={ArrowLeft:-100,ArrowRight:100,Home:0,ArrowDown:0};if(e.key in values){e.preventDefault();persistStatus(card,values[e.key]);}});
$('#edit-assets').onclick=()=>{const f=$('#asset-form');f.elements.amount.value=state.assets===null?'':state.assets/100;$('#asset-dialog').showModal();};
$('#asset-form').onsubmit=e=>{e.preventDefault();state.assets=Math.round(Number(e.currentTarget.elements.amount.value)*100);syncMeta(state).assetsAt=stamp();save();$('#asset-dialog').close();toast('总资产已更新');};
$('#category-select').innerHTML=categories.map(c=>`<option>${c}</option>`).join('');
$('#new-expense').onclick=()=>{if(state.assets===null){toast('请先输入总资产，再记录开销');$('#edit-assets').click();return;}$('#expense-form').reset();$('#expense-form').elements.date.value=dateKey();$('#expense-dialog').showModal();};
$('#expense-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,title=f.elements.title.value.trim(),amount=Math.round(Number(f.elements.amount.value)*100);if(!title||amount<=0)return;state.expenses.push({id:crypto.randomUUID(),updatedAt:stamp(),title,amount,date:f.elements.date.value,category:f.elements.category.value});save();$('#expense-dialog').close();toast('已记下这笔开销');};
$('#expense-list').onclick=e=>{const b=e.target.closest('.delete-expense');if(!b||!confirm('删除这笔开销？剩余资产将同步恢复。'))return;syncMeta(state).deletedExpenses[b.dataset.id]=stamp();state.expenses=state.expenses.filter(x=>x.id!==b.dataset.id);save();};
$('#export-data').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`日序备份-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-data').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=JSON.parse(await file.text());if(!validState(next))throw Error();if(confirm(cloud?.session?'导入的记录将与此账号合并，同一记录保留较新的修改。继续？':'导入会替换当前数据，请确保已经备份。继续？')){state=cloud?.session?mergeStates(state,next):next;save();toast('备份已恢复');}}catch{toast('备份格式有误，未导入任何数据');}e.target.value='';};
render();if(storageFailed)toast('无法读取本地记录，请检查浏览器存储或导入备份。');

let progressDate=dateKey();setInterval(()=>{if(dateKey()!==progressDate){progressDate=dateKey();updateProgress();}},30000);

function syncMessage(message){$('#sync-message').textContent=message;}
function syncBadge(text){$('#sync-open').textContent=text;}
function syncUI(){
 const signed=!!cloud?.session;
 $('#sync-account').hidden=!signed;$('#sync-login-area').hidden=signed;
 $('#sync-email').textContent=signed?cloud.session.user.email:'';
 $('#sync-login').disabled=!cloud;$('#sync-signup').disabled=!cloud;
 $('#storage-label').textContent=signed?'账号数据 · 本机保留离线副本':'数据保存在当前浏览器';
 if(!signed){syncBadge('本地保存 · 同步');syncMessage(cloud?'连接配置已保存，请在两台设备登录同一账号。':'尚未启用云同步。请先按设置步骤创建云端项目。');}
}
function queueSync(){
 if(!cloud?.session)return;
 syncBadge('待同步');clearTimeout(syncTimer);syncTimer=setTimeout(runSync,800);
}
async function runSync(){
 if(!cloud?.session)return;
 if(syncBusy){syncAgain=true;return;}
 if(drag){queueSync();return;}
 if(!navigator.onLine){syncBadge('离线 · 待同步');syncMessage('当前离线，修改已保存在本机，联网后自动同步。');return;}
 const client=cloud,accountKey=key;syncBusy=true;
 syncBadge('同步中');
 try{
   const snapshot=structuredClone(state),result=await client.exchange(snapshot);
   if(cloud!==client||key!==accountKey||!cloud.session)return;
   if(drag){syncAgain=true;return;}
   const merged=mergeStates(state,result);
   const changed=!sameState(merged,state);state=merged;writeLocal();
   if(changed&&!drag)render();
   if(!sameState(snapshot,state)&&!sameState(state,result))syncAgain=true;
   syncBadge('已同步');syncMessage('已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
 }catch(error){if(cloud===client&&key===accountKey){syncBadge('同步失败 · 重试');syncMessage(error instanceof TypeError?'连接失败，本地数据已保留。请检查网络和项目配置。':error.message);}}
 finally{syncBusy=false;if(syncAgain){syncAgain=false;queueSync();}}
}
function activateAccount(mergeGuest=false){
 const user=cloud.session.user;
 key='daybyday.user.'+new URL(cloud.config.url).hostname+'.'+user.id;
 let account={version:1,assets:null,tasks:[],expenses:[]};
 try{const saved=JSON.parse(localStorage.getItem(key));if(validState(saved))account=saved;}catch{}
 if(mergeGuest){try{const guest=JSON.parse(localStorage.getItem(guestKey));if(validState(guest))account=mergeStates(account,guest);}catch{}}
 state=account;writeLocal();render();syncUI();runSync();
}
$('#sync-open').onclick=()=>{$('#sync-dialog').showModal();};
$('#sync-now').onclick=runSync;
$('#sync-config-form').onsubmit=e=>{
 e.preventDefault();const f=e.currentTarget,config={url:f.elements.url.value.trim(),key:f.elements.key.value.trim()};
 if(!validCloudConfig(config)){syncMessage('请输入正确的 Supabase HTTPS 地址和前端公钥，不支持私钥。');return;}
 try{localStorage.setItem('daybyday.cloud-config',JSON.stringify(config));cloud=new CloudClient(config);syncUI();if(cloud.session)activateAccount(false);}catch{syncMessage('配置无法保存，请检查浏览器存储设置。');}
};
$('#sync-auth-form').onsubmit=async e=>{
 e.preventDefault();if(!cloud)return;const f=e.currentTarget,client=cloud,action=e.submitter?.value;
 $('#sync-login').disabled=true;$('#sync-signup').disabled=true;syncMessage(action==='signup'?'正在注册…':'正在登录…');
 try{
  const data=await (action==='signup'?client.signUp(f.elements.email.value.trim(),f.elements.password.value):client.signIn(f.elements.email.value.trim(),f.elements.password.value));
  f.elements.password.value='';
  if(data.access_token)activateAccount(f.elements.mergeLocal.checked);else syncMessage('注册已提交，请检查邮箱并确认注册，再回到这里登录。');
 }catch(error){syncMessage(error instanceof TypeError?'连接失败，请检查网络或云端项目配置。':error.message);}
 finally{$('#sync-login').disabled=!cloud;$('#sync-signup').disabled=!cloud;}
};
$('#sync-logout').onclick=async()=>{
 if(!confirm('退出后将显示本机未登录时的数据，已上传的数据保留在云端，未同步修改保留在此设备的账号离线副本中。继续？'))return;
 const client=cloud;clearTimeout(syncTimer);await client.signOut();key=guestKey;
 state={version:1,assets:null,tasks:[],expenses:[]};try{const guest=JSON.parse(localStorage.getItem(guestKey));if(validState(guest))state=guest;}catch{}
 render();syncUI();
};
function initCloud(){
 let config=cloudConfig;
 try{const override=JSON.parse(localStorage.getItem('daybyday.cloud-config'));if(validCloudConfig(override))config=override;}catch{}
 if(validCloudConfig(config)){
   $('#sync-config-form').elements.url.value=config.url;$('#sync-config-form').elements.key.value=config.key;
   try{cloud=new CloudClient(config);}catch{}
 }else $('#sync-setup').open=true;
 syncUI();if(cloud?.session)activateAccount(false);
}
window.addEventListener('online',runSync);
window.addEventListener('storage',e=>{if(e.key===key&&e.newValue){try{const next=JSON.parse(e.newValue);if(validState(next)){state=mergeStates(state,next);if(!drag)render();queueSync();}}catch{}}});
setInterval(()=>{if(document.visibilityState==='visible')runSync();},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')runSync();});
initCloud();
