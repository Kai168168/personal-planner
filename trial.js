import {readCourseTemplate,courseTasks,newCourseTasks} from './courses.js?v=13';
export function readTrial(value){
 if(value?.kind!=='planner-trial-import'||value.version!==1||!Array.isArray(value.schedule)||!value.schedule.length||value.schedule.length>140)throw Error('试行计划格式不正确');
 const days=(Date.parse(value.end)-Date.parse(value.start))/86400000;
 if(!Number.isFinite(days)||days<0||days>13)throw Error('试行计划最多14天');
 const schedule=value.schedule.map(item=>{
  const clean=readCourseTemplate({kind:'planner-course-import',version:1,start:value.start,end:value.end,schedule:[item]}).schedule[0];
  if(item.detail!==undefined&&(typeof item.detail!=='string'||item.detail.length>12000))throw Error('训练详情格式不正确');
  return {...clean,...(item.detail?{detail:item.detail}:{})};
 });
 if(new TextEncoder().encode(JSON.stringify(value)).length>65536)throw Error('试行计划过长');
 return {kind:value.kind,version:1,start:value.start,end:value.end,schedule};
}
const signature=task=>[task.date,task.title.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),task.time,task.endTime||''].join('|');
export function planTrial(existing,value,deleted={}){
 const trial=readTrial(value),candidates=trial.schedule.flatMap(item=>courseTasks({kind:'planner-course-import',version:1,start:trial.start,end:trial.end,schedule:[item]}).map(task=>({...task,...(item.detail?{gptDetail:{source:'gpt',text:item.detail}}:{})}))),additions=newCourseTasks(existing,candidates,deleted),updates=[];
 for(const task of existing){const incoming=candidates.find(c=>signature(c)===signature(task));if(incoming?.gptDetail&&(task.gptDetail?.source!=='gpt'||task.gptDetail?.text!==incoming.gptDetail.text))updates.push({...task,gptDetail:incoming.gptDetail});}
 const all=[...existing,...additions],conflicts=[];
 for(const task of additions){const other=all.find(t=>t.id!==task.id&&t.date===task.date&&t.time<task.endTime&&t.endTime>task.time);if(other)conflicts.push({task,other});}
 return {trial,candidates,additions,updates,conflicts};
}
