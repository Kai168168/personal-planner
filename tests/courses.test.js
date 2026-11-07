import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseTasks,newCourseTasks,readCourseTemplate,replacedCourseTasks} from '../courses.js';
import {validState} from '../model.js';
const template={kind:'planner-course-import',version:1,start:'2026-10-26',end:'2026-12-10',schedule:[{day:0,title:'示例课程 A',time:'09:00',endTime:'10:00',note:'教室 A'},{day:3,title:'示例课程 B',time:'14:45',endTime:'17:45',note:'实验课'}]};
test('含首尾按星期重复，不扩展到所选区间之外',()=>{const tasks=courseTasks(template);assert.equal(tasks.length,14);assert.equal(tasks[0].date,'2026-10-26');assert.equal(tasks.at(-1).date,'2026-12-10');assert.equal(tasks.at(-1).endTime,'17:45');assert.ok(validState({version:1,assets:null,tasks,expenses:[]}));assert.equal(new Set(tasks.map(t=>t.id)).size,14);assert.equal(courseTasks({...template,start:'2026-10-27',end:'2026-12-09'}).length,12);});
test('拒绝无效日期、反向区间与非法时间',()=>{assert.throws(()=>courseTasks({...template,start:'2026-02-30'}));assert.throws(()=>courseTasks({...template,start:'2026-12-11'}));assert.throws(()=>readCourseTemplate({...template,schedule:[{...template.schedule[0],endTime:'08:00'}]}));assert.throws(()=>readCourseTemplate({...template,schedule:[null]}));});
test('重复导入保留完成状态、尊重删除、手工记录去重',()=>{const tasks=courseTasks(template),existing=tasks.map(t=>({...t,status:'done'}));assert.equal(newCourseTasks(existing,tasks).length,0);assert.equal(existing[0].status,'done');assert.equal(newCourseTasks([],[tasks[0]],{[tasks[0].id]:123}).length,0);assert.equal(newCourseTasks([{...tasks[0],id:'manual'}],[tasks[0]]).length,0);assert.deepEqual(courseTasks({...template,schedule:[...template.schedule].reverse()}),tasks);});

test('替换范围仅限精确匹配的旧导入课程，不删除手动或范围外任务',()=>{
 const replacement={...template,replaceImported:[{title:'旧课',time:'10:00',endTime:'11:00',days:[1]}]};
 const old={id:'course-v1-old',title:'旧课',date:'2026-10-27',time:'10:00',endTime:'11:00'};
 const existing=[old,{...old,id:'manual'},{...old,id:'course-v1-outside',date:'2026-10-20'},{...old,id:'course-v1-other-time',time:'12:00'}];
 assert.deepEqual(replacedCourseTasks(existing,replacement),[old]);
 assert.equal(replacedCourseTasks(existing,template).length,0);
 assert.throws(()=>readCourseTemplate({...template,replaceImported:[{title:'旧课',time:'10:00',endTime:'11:00',days:[8]}]}));
});
