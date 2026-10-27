import test from 'node:test'
import assert from 'node:assert/strict'
import {indexedDB} from 'fake-indexeddb'
import {AIController} from '../src/ai/controller.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import type {ChatRequest,CourseContext,RemoteSource,SourceStatus} from '../src/ai/types.ts'
import {createRequire} from 'node:module'
import {confirmRequiredSources} from '../src/ai/chat-source-ack.ts'
Object.assign(globalThis,{indexedDB})
const context:CourseContext={localCourseId:'fixture-course',localCourseUUID:'fixture-course',classDocId:'00004',year:2026,courseName:'架空授業',teacherName:'架空教員',dayID:20741}
const source=(id:string,status:SourceStatus):RemoteSource=>({sourceId:id,sourceType:'pdf',title:'架空PDF',status,courseOfferingId:'2026:00004',lectureId:String(context.dayID),previewProgress:{completed:30,total:30}})
const until=async(check:()=>boolean)=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,10));assert(check(),'did not settle')}
class Backend extends DemoAIBackend{
 calls:ChatRequest[]=[];live=new Map<string,RemoteSource>()
 override async get(id:string){return structuredClone(this.live.get(id)!)}
 override async chat(request:ChatRequest){this.calls.push(request);return {text:'架空の回答'}}
}
test('all pending files must finish; 100% page previews cannot admit a chat before final ready; failed/deleted intent does not deadlock',async()=>{
 const a=source('synthetic-a','extracting'),b=source('synthetic-b','queued'),backend=new Backend([{source:a},{source:b}]);backend.live.set(a.sourceId,a);backend.live.set(b.sourceId,b)
 const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 try{assert.equal(c.pendingMaterialCount,0);assert.equal(c.analyzingCount,2);await assert.rejects(c.send('要約して','intro'));assert.equal(c.messages.length,0);assert.equal(backend.calls.length,0)
 const sending=c.send('両資料を要約');await until(()=>c.messages.length===2);assert.equal(backend.calls.length,0)
 a.status='ready';await (c as any).poll();assert.equal(backend.calls.length,0);b.status='partial_ready';await (c as any).poll();assert.equal(await sending,true);assert.deepEqual(new Set(backend.calls[0].sourceIds),new Set([a.sourceId,b.sourceId]))
 const row=c.materials[1];row.state='failed';assert.equal(c.pendingMaterialCount,0);row.state='processing';row.wantsDeletion=true;assert.equal(c.pendingMaterialCount,0)
 }finally{c.dispose()}
})
test('durable preparation blocks before the row exists and releases on local storage failure, without messages/provider calls',async t=>{
 const store=new AIStore(),backend=new Backend(),c=new AIController(crypto.randomUUID(),context,backend,store,()=>{});await c.init()
 let reject!:(e:Error)=>void;t.mock.method(store,'putMaterial',()=>new Promise<void>((_,r)=>{reject=r}))
 try{const staging=c.stageNote('架空の新規資料');assert.equal(c.materials.length,0);assert.equal(c.pendingMaterialCount,1);await assert.rejects(c.send('早すぎる送信'));assert.equal(backend.calls.length,0);assert.equal(c.messages.length,0)
 reject(Error('storage full'));await assert.rejects(staging);assert.equal(c.pendingMaterialCount,0);assert.equal(c.materials.length,0)
 }finally{c.dispose()}
})

test('newly attached ready source replaces one of eight old selections and is explicitly required',async()=>{
 const old=Array.from({length:8},(_,i)=>source('old-'+i,'ready')),fresh=source('fresh-image','extracting'),backend=new Backend([...old,fresh].map(source=>({source})));backend.live.set(fresh.sourceId,fresh)
 const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 try{const row=c.materials.find(x=>x.remote?.sourceId===fresh.sourceId)!;assert.equal(c.selected.size,8);fresh.status='ready';await (c as any).poll()
 assert.equal(await c.send('この新しい問題を解いて','reply',{kind:'image',count:1,ids:[row.id]}),true)
 assert.equal(backend.calls[0].sourceIds.length,8);assert.deepEqual(backend.calls[0].requiredSourceIds,['fresh-image']);assert(backend.calls[0].sourceIds.includes('fresh-image'));assert.equal(backend.calls[0].materialExpected,true)
 }finally{c.dispose()}
})
test('an attached source that fails while waiting never calls chat with old material',async()=>{
 const old=source('old-ready','ready'),fresh=source('failed-image','extracting'),backend=new Backend([{source:old},{source:fresh}]);backend.live.set(fresh.sourceId,fresh)
 const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 try{const row=c.materials.find(x=>x.remote?.sourceId===fresh.sourceId)!;const pending=c.send('この新しい問題を解いて','reply',{kind:'image',count:1,ids:[row.id]});await until(()=>c.messages.length===2)
 fresh.status='failed';await (c as any).poll();assert.equal(await pending,false);assert.equal(backend.calls.length,0);assert.match(c.error,/解析/)
 }finally{c.dispose()}
})

test('web request keeps the new image in the shared backend context and verifies its acknowledgement',{skip:!process.env.AI_CHAT_MODULE},async()=>{
 const chat=createRequire(import.meta.url)(process.env.AI_CHAT_MODULE!)
 const old=source('old-text','ready'),fresh=source('new-image','ready'),backend=new Backend([{source:old},{source:fresh}])
 let delivered=''
 backend.chat=async(request:ChatRequest)=>{
  const input=chat.validateChat(request),selected=chat.chooseContext([
   {sourceId:'old-text',chunkId:'1',text:'この問題について、等比級数を考える。'},
   {sourceId:'new-image',chunkId:'1',text:'A bowl in the shape of a hemisphere with radius 15 cm.'}
  ],new Map(),request.turns.at(-1)!.text,input.requiredSourceIds)
  delivered=selected.map((x:{text:string})=>x.text).join('\n')
  const reply={text:'fixture reply',includedRequiredSourceIds:input.requiredSourceIds};confirmRequiredSources(request,reply);return reply
 }
 const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 try{const row=c.materials.find(x=>x.remote?.sourceId===fresh.sourceId)!;assert.equal(await c.send('この新しい differentiation の問題について回答して','reply',{kind:'image',count:1,ids:[row.id]}),true);assert.match(delivered,/hemisphere/)}finally{c.dispose()}
})
