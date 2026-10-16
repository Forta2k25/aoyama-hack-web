import test from 'node:test'
import assert from 'node:assert/strict'
import {indexedDB} from 'fake-indexeddb'
import {AIController} from '../src/ai/controller.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import type {ChatRequest,CourseContext,RemoteSource,SourceStatus} from '../src/ai/types.ts'
Object.assign(globalThis,{indexedDB})
const context:CourseContext={localCourseId:'fixture-course',localCourseUUID:'fixture-course',classDocId:'00004',year:2026,courseName:'架空授業',teacherName:'架空教員',dayID:20741}
const source=(id:string,status:SourceStatus):RemoteSource=>({sourceId:id,sourceType:'pdf',title:'架空PDF',status,courseOfferingId:'2026:00004',lectureId:String(context.dayID),previewProgress:{completed:30,total:30}})
class Backend extends DemoAIBackend{
 calls:ChatRequest[]=[];live=new Map<string,RemoteSource>()
 override async get(id:string){return structuredClone(this.live.get(id)!)}
 override async chat(request:ChatRequest){this.calls.push(request);return {text:'架空の回答'}}
}
test('all pending files must finish; 100% page previews cannot admit a chat before final ready; failed/deleted intent does not deadlock',async()=>{
 const a=source('synthetic-a','extracting'),b=source('synthetic-b','queued'),backend=new Backend([{source:a},{source:b}]);backend.live.set(a.sourceId,a);backend.live.set(b.sourceId,b)
 const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 try{assert.equal(c.pendingMaterialCount,2);for(const mode of ['reply','intro'] as const)await assert.rejects(c.send('要約して',mode),/解析の完了後/);assert.equal(c.messages.length,0);assert.equal(backend.calls.length,0)
 a.status='ready';await (c as any).poll();assert.equal(c.pendingMaterialCount,1);await assert.rejects(c.send('まだ送らない'))
 b.status='indexing';await (c as any).poll();await assert.rejects(c.send('保存完了前も送らない'))
 b.status='partial_ready';await (c as any).poll();assert.equal(c.pendingMaterialCount,0);await c.send('両資料を要約');assert.deepEqual(new Set(backend.calls[0].sourceIds),new Set([a.sourceId,b.sourceId]))
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
