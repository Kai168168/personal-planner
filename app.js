import {categories,dateKey,monday,addDays,money,totals,validState,taskColor} from './model.js?v=4';
const $ = s => document.querySelector(s);
const key='daybyday.v1';
let state={version:1,assets:null,tasks:[],expenses:[]}, week=monday();
let storageFailed=false;
try { const stored=localStorage.getItem(key); if(stored) { const parsed=JSON.parse(stored); if(!validState(parsed)) throw Error(); state=parsed; } } catch { storageFailed=true; }
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(message){ $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,3200); }
function save(){try {localStorage.setItem(key,JSON.stringify(state));}catch{toast('浏览器存储不可用，请导出备份，避免数据丢失。');} render();}
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
  return `<section class="day ${date===today?'today':''}"><div class="day-header"><div><div class="day-name">${name}</div><div class="day-number">${String(d.getDate()).padStart(2,'0')}</div></div>${date===today?'<span class="today-badge">今天</span>':''}</div>${tasks.map(t=>`<article class="task ${t.status}" style="--task-bg:${taskColor(t.title).background};--task-edge:${taskColor(t.title).edge};--slide:${statusValue(t.status)}" data-id="${escape(t.id)}" aria-label="${escape(t.title)}"><div class="task-top"><h3>${escape(t.title)}</h3><button data-action="delete" class="delete" aria-label="删除任务">×</button></div>${t.time?`<div class="task-time">${escape(t.time)}</div>`:''}${t.note?`<p class="task-note">${escape(t.note)}</p>`:''}<div class="slide-area"><span class="slide-caption">${statusText(t.status)}</span><div class="slide-track"><span class="slide-left">未完成</span><span class="slide-right">完成</span><span class="slide-knob" aria-hidden="true">↔</span></div><input class="task-slider" type="range" min="-100" max="100" step="1" value="${statusValue(t.status)}" aria-label="${escape(t.title)}的完成状态，向右完成，向左未完成" aria-valuetext="${statusText(t.status)}"></div></article>`).join('')}<button class="add-day" data-date="${date}">＋ 添加任务</button></section>`;
 }).join('');
 updateProgress();
}
const icons=['◒','↗','▧','⌂','♫','▤','♡','⋯'];
function renderMoney(){ const t=totals(state.expenses,state.assets); $('#assets-value').textContent=state.assets===null?'待设置':money(state.assets); $('#balance-value').textContent=t.balance===null?'—':money(t.balance); $('#week-value').textContent=money(t.week); $('#month-value').textContent=money(t.month); $('#month-caption').textContent=`${new Date().getFullYear()}年 ${new Date().getMonth()+1}月`; $('#expense-total').textContent=`共 ${state.expenses.length} 笔 · ${money(t.all)}`; $('#expense-list').innerHTML=[...state.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="expense-row"><span class="category-icon">${icons[categories.indexOf(e.category)]}</span><div class="expense-info"><strong>${escape(e.title)}</strong><small>${escape(e.date)} · ${escape(e.category)}</small></div><span class="expense-amount">−${money(e.amount)}</span><button class="delete-expense" data-id="${escape(e.id)}" aria-label="删除开销">×</button></div>`).join('')||'<p class="empty">暂无开销记录</p>'; const groups=categories.map(category=>({category,amount:state.expenses.filter(e=>e.category===category&&e.date.startsWith(dateKey().slice(0,7))).reduce((s,e)=>s+e.amount,0)})).filter(g=>g.amount).sort((a,b)=>b.amount-a.amount); $('#categories').innerHTML=groups.map(g=>`<div class="category-row"><div class="category-label"><span>${g.category}</span><span>${money(g.amount)} · ${Math.round(g.amount/t.month*100)}%</span></div><div class="bar"><i style="width:${g.amount/t.month*100}%"></i></div></div>`).join('')||'<p class="empty">本月暂无开销</p>'; }
function render(){renderPlan();renderMoney();}
function openTask(date=dateKey()){const f=$('#task-form'); f.reset(); f.elements.date.value=date; $('#task-dialog').showModal();}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==b.dataset.view);});
$('#new-task').onclick=()=>openTask(); $('#prev-week').onclick=()=>{week=addDays(week,-7);renderPlan();}; $('#next-week').onclick=()=>{week=addDays(week,7);renderPlan();}; $('#this-week').onclick=()=>{week=monday();renderPlan();};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#task-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget, title=f.elements.title.value.trim();if(!title)return;state.tasks.push({id:crypto.randomUUID(),title,date:f.elements.date.value,time:f.elements.time.value,note:f.elements.note.value.trim(),color:'blue',status:'pending'});week=monday(new Date(f.elements.date.value+'T12:00:00'));save();$('#task-dialog').close();toast('新任务已添加');};
$('#board').onclick=e=>{const add=e.target.closest('[data-date]');if(add){openTask(add.dataset.date);return;}const b=e.target.closest('[data-action]');if(!b)return;const id=b.closest('.task').dataset.id;updateTask(id,b.dataset.action);};
function updateTask(id,action){
 if(action==='delete'){if(!confirm('删除这项任务？'))return;state.tasks=state.tasks.filter(t=>t.id!==id);save();}
}
function persistStatus(card,value){
 const task=state.tasks.find(t=>t.id===card.dataset.id);if(!task)return;
 if(value>=55)task.status='done';else if(value<=-55)task.status='missed';
 // A release in the middle keeps the previous status.
 card.style.removeProperty('--preview-bg');card.classList.remove('dragging','done','missed','pending');card.classList.add(task.status);
 const final=statusValue(task.status);card.style.setProperty('--slide',final);
 const input=card.querySelector('.task-slider');input.value=final;input.setAttribute('aria-valuetext',statusText(task.status));
 card.querySelector('.slide-caption').textContent=statusText(task.status);
 try{localStorage.setItem(key,JSON.stringify(state));}catch{toast('无法保存，请导出备份');}
 updateProgress();
}
function previewSlide(card,value){
 card.classList.add('dragging');card.style.setProperty('--slide',value);card.style.setProperty('--preview-bg',`color-mix(in srgb, ${value>=0?'#0c3023':'#35171d'} ${Math.abs(value)}%, var(--task-bg))`);
 card.querySelector('.slide-caption').textContent=value>=55?'松开完成':value<=-55?'松开标记未完成':'松开保持原状态';
}
$('#board').addEventListener('input',e=>{if(e.target.matches('.task-slider'))previewSlide(e.target.closest('.task'),Number(e.target.value));});
$('#board').addEventListener('change',e=>{if(e.target.matches('.task-slider'))persistStatus(e.target.closest('.task'),Number(e.target.value));});
let drag=null;
$('#board').addEventListener('pointerdown',e=>{
 const card=e.target.closest('.task');if(!card||e.target.closest('button,input')||e.button!==0)return;
 drag={card,x:e.clientX,y:e.clientY,pointer:e.pointerId,value:statusValue(state.tasks.find(t=>t.id===card.dataset.id).status),moved:false};card.setPointerCapture(e.pointerId);
});
$('#board').addEventListener('pointermove',e=>{
 if(!drag||drag.pointer!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}
 if(!drag.moved&&Math.abs(dx)<6)return;drag.moved=true;
 const value=Math.max(-100,Math.min(100,drag.value+dx/(drag.card.clientWidth/2-26)*100));
 drag.current=value;previewSlide(drag.card,value);drag.card.querySelector('.task-slider').value=value;
});
function finishDrag(e,cancel=false){if(!drag||drag.pointer!==e.pointerId)return;const d=drag;drag=null;if(d.moved)persistStatus(d.card,cancel?0:d.current);}
$('#board').addEventListener('pointerup',e=>finishDrag(e));
$('#board').addEventListener('pointercancel',e=>{const card=e.target.closest('.task');if(card&&e.target.matches('.task-slider'))persistStatus(card,0);finishDrag(e,true);});
$('#edit-assets').onclick=()=>{const f=$('#asset-form');f.elements.amount.value=state.assets===null?'':state.assets/100;$('#asset-dialog').showModal();};
$('#asset-form').onsubmit=e=>{e.preventDefault();state.assets=Math.round(Number(e.currentTarget.elements.amount.value)*100);save();$('#asset-dialog').close();toast('总资产已更新');};
$('#category-select').innerHTML=categories.map(c=>`<option>${c}</option>`).join('');
$('#new-expense').onclick=()=>{if(state.assets===null){toast('请先输入总资产，再记录开销');$('#edit-assets').click();return;}$('#expense-form').reset();$('#expense-form').elements.date.value=dateKey();$('#expense-dialog').showModal();};
$('#expense-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,title=f.elements.title.value.trim(),amount=Math.round(Number(f.elements.amount.value)*100);if(!title||amount<=0)return;state.expenses.push({id:crypto.randomUUID(),title,amount,date:f.elements.date.value,category:f.elements.category.value});save();$('#expense-dialog').close();toast('已记下这笔开销');};
$('#expense-list').onclick=e=>{const b=e.target.closest('.delete-expense');if(!b||!confirm('删除这笔开销？剩余资产将同步恢复。'))return;state.expenses=state.expenses.filter(x=>x.id!==b.dataset.id);save();};
$('#export-data').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`日序备份-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-data').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=JSON.parse(await file.text());if(!validState(next))throw Error();if(confirm('导入会替换当前数据，请确保已经备份。继续？')){state=next;save();toast('备份已恢复');}}catch{toast('备份格式有误，未导入任何数据');}e.target.value='';};
render();if(storageFailed)toast('无法读取本地记录，请检查浏览器存储或导入备份。');

let progressDate=dateKey();setInterval(()=>{if(dateKey()!==progressDate){progressDate=dateKey();updateProgress();}},30000);
