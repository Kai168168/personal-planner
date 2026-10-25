import {test} from 'node:test';
import assert from 'node:assert/strict';
import {totals,dateKey,monday,validState} from '../model.js';
test('周日属于上一周，周一为统计起点',()=>{assert.equal(dateKey(monday(new Date(2026,9,25,12))),'2026-10-19');assert.equal(dateKey(monday(new Date(2026,9,26,12))),'2026-10-26');});
test('跨月周统计、月统计和剩余资产独立计算，金额使用分',()=>{const expenses=[{date:'2026-09-30',amount:101},{date:'2026-10-01',amount:202},{date:'2026-10-04',amount:303},{date:'2026-10-05',amount:404}];assert.deepEqual(totals(expenses,10000,new Date(2026,9,4,12)),{all:1010,balance:8990,week:606,month:909});assert.equal(totals([],null).balance,null);assert.equal(totals(expenses,1).balance,-1009);});
test('导入拒绝无效日期、金额和分类',()=>{const s={version:1,assets:0,tasks:[],expenses:[{id:'1',title:'午餐',date:'2026-10-26',amount:1200,category:'餐饮美食'}]};assert.ok(validState(s));assert.ok(!validState({...s,expenses:[{...s.expenses[0],amount:-1}]}));assert.ok(!validState({...s,expenses:[{...s.expenses[0],date:'2026-02-30'}]}));assert.ok(!validState({...s,expenses:[{...s.expenses[0],category:'unknown'}]}));});
