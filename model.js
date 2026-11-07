export const categories = ['餐饮美食','交通出行','购物日用','住房缴费','休闲娱乐','学习成长','医疗健康','其他'];
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function monday(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return d; }
export function addDays(date,n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
export function money(cents) { return new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(cents/100); }
export function totals(expenses,assets,now = new Date()) { const start = dateKey(monday(now)), end = dateKey(addDays(monday(now),7)), month = dateKey(now).slice(0,7); const sum = list => list.reduce((n,e)=>n+e.amount,0); return { all:sum(expenses), balance:assets===null?null:assets-sum(expenses), week:sum(expenses.filter(e=>e.date>=start&&e.date<end)), month:sum(expenses.filter(e=>e.date.startsWith(month))) }; }
export function validState(s) {
 const text=v=>typeof v==='string';
 const timestamp=v=>Number.isSafeInteger(v)&&v>=0;
 const id=v=>text(v)&&v.length>0&&v.length<=128&&!['__proto__','constructor','prototype'].includes(v);
 const time=v=>text(v)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 const validDate=v=>text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&dateKey(new Date(v+'T12:00:00'))===v;
 const deleted=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([key,at])=>id(key)&&timestamp(at));
 return !!(s&&s.version===1&&(s.assets===null||timestamp(s.assets))&&Array.isArray(s.tasks)&&Array.isArray(s.expenses)&&
  (s.sync===undefined||(s.sync&&timestamp(s.sync.assetsAt)&&deleted(s.sync.deletedTasks)&&deleted(s.sync.deletedExpenses)))&&
  s.tasks.every(t=>t&&id(t.id)&&text(t.title)&&validDate(t.date)&&text(t.note)&&(t.time===''||time(t.time))&&(t.endTime===undefined||validTimeRange(t.time,t.endTime))&&['blue','purple','amber','green'].includes(t.color)&&['pending','done','missed'].includes(t.status)&&(t.updatedAt===undefined||timestamp(t.updatedAt))&&(t.gptDetail===undefined||(t.gptDetail&&t.gptDetail.source==='gpt'&&text(t.gptDetail.text)&&t.gptDetail.text.length<=12000)))&&
  s.expenses.every(e=>e&&id(e.id)&&text(e.title)&&validDate(e.date)&&Number.isSafeInteger(e.amount)&&e.amount>0&&categories.includes(e.category)&&(e.updatedAt===undefined||timestamp(e.updatedAt))));
}

// Titles share a stable color across dates, reloads, and imported backups.
export function taskColor(title) {
  const normalized = title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('zh-CN');
  let hash=5381;
  for(const char of normalized)hash=(Math.imul(hash,33)^char.codePointAt(0))>>>0;
  const hue=Math.round((hash*0.618033988749895%1)*360)%360;
  return {background:`hsl(${hue} 66% 18%)`,edge:`hsl(${hue} 90% 69%)`,tint:`hsl(${(hue+36)%360} 64% 11%)`};
}

export function validTimeRange(start,end){const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);return time(start)&&time(end)&&end>start;}
export function swipeStatus(value){return value>=55?'done':value<=-55?'missed':'pending';}

export function isoWeek(date){
 const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
 d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
 const year=d.getUTCFullYear(),start=new Date(Date.UTC(year,0,1));
 return {year,week:Math.ceil((((d-start)/86400000)+1)/7)};
}
