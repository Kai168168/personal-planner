import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getTaskDetail,readDetailPayload,planDetailUpdates,decodeDetailPayload} from '../details.js';
import {validState} from '../model.js';
import {mergeStates} from '../sync-model.js';
import {readCourseTemplate} from '../courses.js';
const task={id:'t1',title:'阅读',date:'2026-11-08',time:'19:00',endTime:'20:00',note:'短备注',color:'blue',status:'done',updatedAt:1};
const payload={kind:'planner-gpt-details',version:1,entries:[{match:{title:'阅读',start:'2026-11-08',end:'2026-11-08'},text:'详细步骤\n1. 阅读\n2. 记录'}]};
test('短备注不会自动成为长按详情，只有独立GPT字段显示',()=>{assert.equal(getTaskDetail(task),'');assert.equal(getTaskDetail({...task,gptDetail:{source:'manual',text:'不展示'}}),'');assert.match(getTaskDetail({...task,gptDetail:{source:'gpt',text:'详细内容'}}),/详细内容/);});
test('精确匹配日期标题并保留短备注、完成状态，重复更新不产生变更',()=>{const result=planDetailUpdates([task,{...task,id:'t2',date:'2026-11-09'}],payload);assert.equal(result.matched,1);assert.equal(result.changes.length,1);assert.equal(result.changes[0].id,'t1');assert.equal(result.changes[0].note,undefined);const updated={...task,gptDetail:{source:'gpt',text:result.changes[0].text},updatedAt:2};assert.equal(updated.note,'短备注');assert.equal(updated.status,'done');assert.equal(planDetailUpdates([updated],payload).changes.length,0);});
test('冲突条件、无效日期、超长文字均拒绝',()=>{assert.throws(()=>readDetailPayload({...payload,entries:[{match:{title:'阅读',start:'2026-02-30'},text:'文字'}]}));assert.throws(()=>readDetailPayload({...payload,entries:[{match:{title:'阅读'},text:'a'.repeat(12001)}]}));assert.throws(()=>planDetailUpdates([task],{...payload,entries:[payload.entries[0],{match:{id:'t1'},text:'不同内容'}]}));assert.equal(planDetailUpdates([task],{...payload,entries:[{match:{title:'没有的任务'},text:'内容'}]}).unmatched,1);});
test('备份与跨设备合并保留GPT详情，非法来源不能通过新状态校验',()=>{const state={version:1,assets:null,tasks:[task],expenses:[]};const newer={...state,tasks:[{...task,gptDetail:{source:'gpt',text:'<script>只是文本</script>'},updatedAt:2}]};assert.ok(validState(newer));assert.equal(mergeStates(state,newer).tasks[0].gptDetail.text,'<script>只是文本</script>');assert.ok(!validState({...state,tasks:[{...task,gptDetail:{source:'manual',text:'内容'}}]}));});
test('普通课表文件不会将额外字段变成GPT详情',()=>{const imported=readCourseTemplate({kind:'planner-course-import',version:1,start:'2026-11-08',end:'2026-11-09',schedule:[{day:0,title:'阅读',time:'19:00',endTime:'20:00',gptDetail:{source:'gpt',text:'不应从普通课表进入'}}]});assert.equal(imported.schedule[0].gptDetail,undefined);});

test('同名早晚训按星期与日期分别匹配，本周和区间外不变',()=>{
 const tasks=['2026-11-08','2026-11-09','2026-11-10','2026-11-16','2026-11-22','2026-11-23'].map((date,index)=>({...task,id:'day'+index,title:'晚训',date}));
 const value={kind:'planner-gpt-details',version:1,entries:[{match:{title:'晚训',start:'2026-11-09',end:'2026-11-22',weekdays:[0]},text:'周一速度课'},{match:{title:'晚训',start:'2026-11-09',end:'2026-11-22',weekdays:[1]},text:'周二力量'}]};
 const plan=planDetailUpdates(tasks,value);assert.deepEqual(plan.entryMatches,[2,1]);assert.deepEqual(plan.changes.map(p=>p.id).sort(),['day1','day2','day3']);assert.equal(plan.changes.find(p=>p.id==='day2').text,'周二力量');
 assert.throws(()=>readDetailPayload({...payload,entries:[{match:{title:'阅读',weekdays:[7]},text:'内容'}]}));
});
test('压缩与旧版链接解析结果相同，并拒绝超大解压内容',async()=>{
 const {gzipSync}=await import('node:zlib');const raw=Buffer.from(JSON.stringify(payload));const a=await decodeDetailPayload(raw.toString('base64url'));const b=await decodeDetailPayload(gzipSync(raw).toString('base64url'),true);assert.deepEqual(a,b);
 await assert.rejects(()=>decodeDetailPayload(gzipSync(Buffer.from('x'.repeat(70000))).toString('base64url'),true),/过长/);
});
