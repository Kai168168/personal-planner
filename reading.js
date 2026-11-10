function subject(title){const math=/数学|微积分|线性代数|math/i.test(title),chem=/化学|chem/i.test(title);return math===chem?null:math?'数学':'化学';}
export function readingChanges(tasks,start,end){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T12:00:00').getDate()===Number(d.slice(8));
 if(!valid(start)||!valid(end)||end<start||(Date.parse(end)-Date.parse(start))/86400000>365)throw Error('修改日期范围不正确');
 const changes=[],unmatched=[];
 for(const task of tasks){
  if(task.date<start||task.date>end||task.time<'18:00'||!/^阅读(?:[\s·｜|].*)?$/.test(task.title.trim()))continue;
  const previous=tasks.filter(t=>t.date===task.date&&t.id!==task.id&&t.endTime&&t.endTime<=task.time&&subject(t.title)).sort((a,b)=>b.endTime.localeCompare(a.endTime)||b.time.localeCompare(a.time))[0];
  if(!previous){unmatched.push(task);continue;}
  const next=subject(previous.title)==='数学'?'化学':'数学';
  changes.push({id:task.id,title:next+'学习',note:'接续'+subject(previous.title)+'，交替学习'+next+'；解题、订正并回顾重点。',date:task.date,time:task.time,endTime:task.endTime,previous:previous.title});
 }
 return {changes,unmatched};
}
