import {dateKey,addDays,validTimeRange} from './model.js?v=5';
function parseDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('请选择有效日期');
 const date=new Date(value+'T12:00:00');
 if(Number.isNaN(date.valueOf())||dateKey(date)!==value)throw Error('请选择有效日期');
 return date;
}
export function readCourseTemplate(value){
 if(!value||value.kind!=='planner-course-import'||value.version!==1||!Array.isArray(value.schedule)||!value.schedule.length||value.schedule.length>70)throw Error('课表文件格式不正确');
 const start=parseDate(value.start),end=parseDate(value.end);
 if(end<start)throw Error('结束日期不能早于开始日期');
 if(end>addDays(start,365))throw Error('一次最多导入一年内的课程');
 const schedule=value.schedule.map(c=>{
  if(!c||!Number.isInteger(c.day)||c.day<0||c.day>6||typeof c.title!=='string'||!c.title.trim()||c.title.length>100||!validTimeRange(c.time,c.endTime)||(c.note!==undefined&&(typeof c.note!=='string'||c.note.length>300)))throw Error('课程名称、星期或时间区间不正确');
  return {day:c.day,title:c.title.trim(),time:c.time,endTime:c.endTime,note:c.note||''};
 });
 return {kind:'planner-course-import',version:1,start:value.start,end:value.end,schedule};
}
function signature(t){return [t.date,t.title.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),t.time,t.endTime||''].join('|');}
function courseId(task){let hash=2166136261;for(const char of signature(task))hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;return `course-v1-${task.date}-${hash.toString(16)}`;}
export function courseTasks(value){
 const template=readCourseTemplate(value),tasks=[],end=parseDate(template.end);
 for(let date=parseDate(template.start);date<=end;date=addDays(date,1)){
  const weekday=(date.getDay()+6)%7,dayKey=dateKey(date);
  for(const course of template.schedule){if(course.day!==weekday)continue;const {day,...fields}=course,task={...fields,date:dayKey,color:'blue',status:'pending'};tasks.push({...task,id:courseId(task)});}
 }
 return tasks;
}
export function newCourseTasks(existing,candidates,deleted={}){
 const ids=new Set(existing.map(t=>t.id)),seen=new Set(existing.map(signature));
 return candidates.filter(t=>{const key=signature(t);if(ids.has(t.id)||Object.prototype.hasOwnProperty.call(deleted,t.id)||seen.has(key))return false;ids.add(t.id);seen.add(key);return true;});
}
