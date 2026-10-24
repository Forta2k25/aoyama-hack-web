import test from 'node:test'
import assert from 'node:assert/strict'
import {indexedDB} from 'fake-indexeddb'
import {AIStore} from '../src/ai/store.ts'
import {AIController} from '../src/ai/controller.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {resolveContext,courseKey,sessionKey,dayIDFor} from '../src/ai/identity.ts'
import type {ChatRequest,CourseContext,RemoteSource} from '../src/ai/types.ts'
Object.assign(globalThis,{indexedDB})
const fixture=(record:string)=>({id:'#####',title:'同名の架空授業',teacher:'同名の架空教員',room:'',academicYear:2026,semester:'fall',timetableRecord:record})
class Capture extends DemoAIBackend{
 requests:ChatRequest[]=[];leaked:RemoteSource[]=[];gate?:Promise<void>
 override async chat(r:ChatRequest){this.requests.push(structuredClone(r));await this.gate;return {text:`架空の返信:${r.turns.at(-1)?.text}`}}
 override async list(){return this.leaked}
}
test('duplicate placeholder codes, titles and teachers never merge timetable records; IDs persist per owner',async()=>{
 const store=new AIStore(),uid=crypto.randomUUID(),a=fixture('assignedCourses.2026_後期:cells.d1p2'),b=fixture('assignedCourses.2026_後期:cells.d2p4')
 const ca=await resolveContext(a,store,uid),cb=await resolveContext(b,store,uid)
 assert.equal(courseKey(await resolveContext({...a,timetableRecord:a.timetableRecord.replace(':cells.',':')},store,uid)),courseKey(ca));assert.notEqual(courseKey(ca),courseKey(cb));assert.equal(courseKey(await resolveContext(a,new AIStore(),uid)),courseKey(ca));assert.notEqual(courseKey(await resolveContext(a,store,'synthetic-other')),courseKey(ca))
})
test('course + lecture date partitions saved messages, attachments, selections and outgoing AI history',async()=>{
 const store=new AIStore(),uid=crypto.randomUUID(),a=await resolveContext(fixture('term:cells.d1p2'),store,uid),b=await resolveContext(fixture('term:cells.d2p4'),store,uid),backend=new Capture()
 const ca={...a,dayID:dayIDFor('2026-10-06')},next={...a,dayID:dayIDFor('2026-10-13')}
 const c=new AIController(uid,ca,backend,store,()=>{});await c.init();const material=await c.stageNote('A第3回の資料だけ');for(let i=0;i<100&&material.state!=='processing';i++)await new Promise(r=>setTimeout(r,2));material.state='ready';material.remote!.status='ready';await store.putMaterial(material);c.selected.add(material.id);await c.send('A第3回だけの合言葉');assert.deepEqual(backend.requests[0].sourceIds,[material.remote!.sourceId]);c.dispose()
 for(const context of [b,next]){const n=new AIController(uid,context,backend,store,()=>{});await n.init();assert.equal(n.messages.length,0);assert.equal(n.materials.length,0);assert.equal(n.selected.size,0);await n.send('この回だけの質問');assert.equal(backend.requests.at(-1)!.turns.length,1);assert(!JSON.stringify(backend.requests.at(-1)).includes('合言葉'));assert.equal(backend.requests.at(-1)!.context.dayID,context.dayID);n.dispose()}
 const restored=new AIController(uid,ca,backend,store,()=>{});await restored.init();assert.equal(restored.messages.length,2);assert(restored.messages[0].text.includes('合言葉'));restored.dispose()
 assert.notEqual(sessionKey(ca),sessionKey(next))
})
test('legacy unassigned history is preserved but excluded from new threads; foreign/ambiguous remote rows are not adopted',async()=>{
 const store=new AIStore(),uid=crypto.randomUUID(),context:CourseContext={...(await resolveContext(fixture('term:d1p2'),store,uid)),dayID:20000},key=courseKey(context),backend=new Capture()
 await store.putMessage({id:crypto.randomUUID(),uid,courseKey:key,role:'user',text:'授業が混在した旧履歴',state:'done',sourceIds:[],createdAt:1})
 backend.leaked=[{sourceId:'foreign',sourceType:'note',title:'他授業',status:'ready',courseOfferingId:'local:other',lectureId:'20000'}]
 const c=new AIController(uid,context,backend,store,()=>{});await c.init();assert.equal(c.messages.length,0);assert.equal(c.materials.length,0);assert.equal((await store.messages(uid,key)).length,1);c.dispose()
})
test('late AI completion stays in its original thread and never notifies the next controller',async()=>{
 const store=new AIStore(),uid=crypto.randomUUID(),base=await resolveContext(fixture('term:d1p2'),store,uid),backend=new Capture();let finish!:()=>void;backend.gate=new Promise<void>(r=>{finish=r})
 const a=new AIController(uid,{...base,dayID:20000},backend,store,()=>{});await a.init();const request=a.send('元の回の質問');for(let i=0;i<100&&!backend.requests.length;i++)await new Promise(r=>setTimeout(r,2));a.dispose()
 const b=new AIController(uid,{...base,dayID:20007},backend,store,()=>{});await b.init();finish();await request;assert.equal(b.messages.length,0);assert.equal((await store.messages(uid,b.key,b.threadKey)).length,0);b.dispose()
})
