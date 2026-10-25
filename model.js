export const categories = ['餐饮美食','交通出行','购物日用','住房缴费','休闲娱乐','学习成长','医疗健康','其他'];
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function monday(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return d; }
export function addDays(date,n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
export function money(cents) { return new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(cents/100); }
export function totals(expenses,assets,now = new Date()) { const start = dateKey(monday(now)), end = dateKey(addDays(monday(now),7)), month = dateKey(now).slice(0,7); const sum = list => list.reduce((n,e)=>n+e.amount,0); return { all:sum(expenses), balance:assets===null?null:assets-sum(expenses), week:sum(expenses.filter(e=>e.date>=start&&e.date<end)), month:sum(expenses.filter(e=>e.date.startsWith(month))) }; }
export function validState(s) { const validDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v+'T12:00:00').getDate()===Number(v.slice(8)); const text=v=>typeof v==='string'; return s && s.version===1 && (s.assets===null || Number.isSafeInteger(s.assets)&&s.assets>=0) && Array.isArray(s.tasks) && Array.isArray(s.expenses) && s.tasks.every(t=>text(t.id)&&text(t.title)&&validDate(t.date)&&text(t.note)&&text(t.time)&&['blue','purple','amber','green'].includes(t.color)&&['pending','done','missed'].includes(t.status)) && s.expenses.every(e=>text(e.id)&&text(e.title)&&validDate(e.date)&&Number.isSafeInteger(e.amount)&&e.amount>0&&categories.includes(e.category)); }

// Titles share a stable color across dates, reloads, and imported backups.
export function taskColor(title) {
  const normalized = title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('zh-CN');
  let hash = 2166136261;
  for (const char of normalized) { hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0; }
  const hue = hash % 360;
  return { background: `hsl(${hue} 42% 13%)`, edge: `hsl(${hue} 62% 57%)` };
}
