// Detailed notes are populated by a dedicated GPT-import flow, never the ordinary task form.
export function getTaskDetail(task){
 const value=task?.gptDetail;
 return value?.source==='gpt'&&typeof value.text==='string'&&value.text.length<=12000?value.text.trim():'';
}
function normalized(title){return title.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
function dateValid(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00').getDate()===Number(value.slice(8));}
export function readDetailPayload(value){
 if(!value||value.kind!=='planner-gpt-details'||value.version!==1||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>40)throw Error('详细备注导入格式不正确');
 if(new TextEncoder().encode(JSON.stringify(value)).length>65536)throw Error('详细备注内容过长，请分批更新');
 const entries=value.entries.map(entry=>{
  const match=entry?.match;
  if(!match||(!match.id&&!match.title)||typeof entry.text!=='string'||entry.text.length>12000)throw Error('任务匹配条件或详细备注不正确');
  const clean={};
  for(const field of ['id','title'])if(match[field]!==undefined){if(typeof match[field]!=='string'||!match[field].trim()||match[field].length>128)throw Error('任务名称或编号不正确');clean[field]=match[field].trim();}
  for(const field of ['start','end'])if(match[field]!==undefined){if(!dateValid(match[field]))throw Error('备注匹配日期不正确');clean[field]=match[field];}
  if(clean.start&&clean.end&&clean.end<clean.start)throw Error('结束日期不能早于开始日期');
  if(match.weekdays!==undefined){if(!Array.isArray(match.weekdays)||!match.weekdays.length||match.weekdays.length>7||match.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('星期匹配条件不正确');clean.weekdays=[...new Set(match.weekdays)];}
  if(entry.label!==undefined&&(typeof entry.label!=='string'||entry.label.length>100))throw Error('详情标题不正确');
  for(const field of ['time','endTime'])if(match[field]!==undefined){if(typeof match[field]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(match[field]))throw Error('备注匹配时间不正确');clean[field]=match[field];}
  if(entry.note!==undefined&&(typeof entry.note!=='string'||entry.note.length>300))throw Error('短备注不能超过300字');
  return {match:clean,text:entry.text,...(entry.label!==undefined?{label:entry.label}:{}),...(entry.note!==undefined?{note:entry.note}:{})};
 });
 return {kind:'planner-gpt-details',version:1,entries};
}
export function planDetailUpdates(tasks,value){
 const payload=readDetailPayload(value),changes=new Map(),matched=new Set(),entryMatches=[];let unmatched=0;
 for(const entry of payload.entries){
  const m=entry.match,targets=tasks.filter(task=>(!m.id||task.id===m.id)&&(!m.title||normalized(task.title)===normalized(m.title))&&(!m.start||task.date>=m.start)&&(!m.end||task.date<=m.end)&&(!m.time||task.time===m.time)&&(!m.endTime||task.endTime===m.endTime)&&(!m.weekdays||m.weekdays.includes((new Date(task.date+'T12:00:00').getDay()+6)%7)));
  entryMatches.push(targets.length);if(!targets.length)unmatched++;
  for(const task of targets){
   const patch={id:task.id,text:entry.text,...(entry.note!==undefined?{note:entry.note}:{})};
   const prev=changes.get(task.id);
   if(prev&&JSON.stringify(prev)!==JSON.stringify(patch))throw Error('同一任务匹配到不同说明，请缩小匹配范围');
   matched.add(task.id);changes.set(task.id,patch);
  }
 }
 return {matched:matched.size,unmatched,entryMatches,changes:[...changes.values()].filter(patch=>{
  const task=tasks.find(t=>t.id===patch.id);
  return task.gptDetail?.source!=='gpt'||task.gptDetail.text!==patch.text||(patch.note!==undefined&&task.note!==patch.note);
 })};
}

export async function decodeDetailPayload(encoded,compressed=false){
 if(typeof encoded!=='string'||encoded.length>90000)throw Error('详情更新链接过长');
 const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
 let data=bytes;
 if(compressed){
  if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持此压缩链接，请使用较新的 Safari 或 Chrome');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>65536){await reader.cancel();throw Error('详情内容过长，请分批更新');}chunks.push(value);}}finally{reader.releaseLock();}
  data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 }
 if(data.length>65536)throw Error('详情内容过长，请分批更新');
 return readDetailPayload(JSON.parse(new TextDecoder().decode(data)));
}
