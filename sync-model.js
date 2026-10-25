import {validState} from './model.js?v=5';

export function syncMeta(state) {
  state.sync ||= {assetsAt:0,deletedTasks:{},deletedExpenses:{}};
  return state.sync;
}
function stable(record) { return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a],[b])=>a.localeCompare(b)))); }
function mergeDeleted(a={},b={}) {
  const result={...a};
  for(const [id,at] of Object.entries(b))result[id]=Math.max(result[id]||0,at);
  return result;
}
function mergeRecords(a,b,deleted) {
  const records=new Map();
  for(const record of [...a,...b]) {
    const prev=records.get(record.id), at=record.updatedAt||0, old=prev?.updatedAt||0;
    if(!prev||at>old||(at===old&&stable(record)>stable(prev)))records.set(record.id,record);
  }
  return [...records.values()].filter(r=>!(r.id in deleted)||(r.updatedAt||0)>deleted[r.id]).sort((a,b)=>a.id.localeCompare(b.id));
}
export function mergeStates(a,b) {
  if(!validState(a)||!validState(b))throw Error('同步数据格式错误，本地记录未被替换');
  const am=syncMeta(structuredClone(a)),bm=syncMeta(structuredClone(b));
  const deletedTasks=mergeDeleted(am.deletedTasks,bm.deletedTasks),deletedExpenses=mergeDeleted(am.deletedExpenses,bm.deletedExpenses);
  const assets=am.assetsAt>bm.assetsAt?a.assets:bm.assetsAt>am.assetsAt?b.assets:a.assets===null?b.assets:b.assets===null?a.assets:Math.max(a.assets,b.assets);
  return {version:1,assets,tasks:mergeRecords(a.tasks,b.tasks,deletedTasks),expenses:mergeRecords(a.expenses,b.expenses,deletedExpenses),sync:{assetsAt:Math.max(am.assetsAt,bm.assetsAt),deletedTasks,deletedExpenses}};
}

function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,canonical(value)]));
 return value;
}
export function sameState(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
