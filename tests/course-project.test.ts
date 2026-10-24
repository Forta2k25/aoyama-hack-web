import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {JSDOM} from 'jsdom'
import {indexedDB} from 'fake-indexeddb'
import {AIController} from '../src/ai/controller.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {CourseChat} from '../src/components/CourseChat.ts'
import {courseKey,sessionKey,dayIDFor} from '../src/ai/identity.ts'
import {ChatStreamError} from '../src/ai/chat-stream.ts'
import type {CourseContext,RemoteSource,ChatRequest,ChatReply,ProjectReferences} from '../src/ai/types.ts'

const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost:5178/ai-debug'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))}
const context:CourseContext={localCourseId:'00000000-0000-4000-8000-000000000011',localCourseUUID:'00000000-0000-4000-8000-000000000011',classDocId:'00004',year:2026,semester:'fall',dayID:dayIDFor('2026-10-20'),courseName:'架空の授業プロジェクト',teacherName:'架空教員'}
const course={id:context.localCourseUUID,title:context.courseName,teacher:'架空教員',room:'',academicYear:2026,firestoreDocID:'00004'}
const meetings=Array.from({length:10},(_,i)=>({number:i+1,dayID:context.dayID-7*(9-i),date:new Date((context.dayID-7*(9-i))*86400000).toISOString().slice(0,10),thisWeek:i===9,upcoming:false}))
const source=(n:number,extra:Partial<RemoteSource>={}):RemoteSource=>({sourceId:'source-'+n,sourceType:'pdf',title:'第'+n+'回の架空資料',status:'ready',courseOfferingId:'2026:00004',dayID:meetings[Math.min(n,10)-1].dayID,lectureId:'opaque-lecture-'+n,activeVersion:'active-one',...extra})
function references(r:ChatRequest,sources:RemoteSource[]):ProjectReferences{
 const included=sources.filter(s=>s.courseOfferingId==='2026:00004'&&['ready','partial_ready'].includes(s.status)&&(r.referenceScope!.mode==='course'||r.referenceScope!.dayIDs!.includes(s.dayID!)))
 return {protocol:'course-project-v1',courseOfferingId:'2026:00004',scope:r.referenceScope!,targetSources:included.length,readySources:included.length,processingSources:0,failedSources:0,partialSources:0,changedSources:0,noTextSources:0,excerpted:true,characters:100,sources:included.map(s=>({sourceId:s.sourceId,title:s.title,dayID:s.dayID,lectureId:s.lectureId,partial:s.status==='partial_ready',locators:[{pageNumber:4}],excerpted:true}))}
}
class Capture extends DemoAIBackend {
 calls:ChatRequest[]=[];rows:RemoteSource[];interrupt=false;override resolvedCourseOfferingId='2026:00004'
 constructor(rows:RemoteSource[]){super(rows.map(source=>({source,text:'保存済み最終本文:'+source.title})));this.rows=rows}
 override async list(){return structuredClone(this.rows)}
 override async chat(r:ChatRequest,_s?:AbortSignal,delta?:(s:string)=>void):Promise<ChatReply>{this.calls.push(structuredClone(r));if(this.interrupt){this.interrupt=false;delta?.('回答の途中');throw new ChatStreamError(Error('network'),true,r)}return {text:'架空の横断要約',...(r.referenceScope?{references:references(r,this.rows)}:{})}}
}
const wait=async(check:()=>boolean)=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,3));assert(check(),'operation did not settle')}

test('cloud dayIDs restore the whole course library even with opaque lecture IDs; default chat remains current-session-only',async()=>{
 const rows=Array.from({length:12},(_,i)=>source(i+1));const backend=new Capture([...rows,source(90,{courseOfferingId:'2025:00004'}),source(91,{courseOfferingId:'2026:00005'}),source(92,{dayID:undefined})]);const store=new AIStore(),uid=crypto.randomUUID(),c=new AIController(uid,context,backend,store,()=>{});await c.init()
 assert.equal(c.projectMaterials.length,12);assert.equal(c.materials.length,3);assert.equal(c.messages.length,0);assert.equal(c.selected.size,3)
 await c.send('今回の資料を説明して');assert(!backend.calls[0].referenceScope);assert.deepEqual(new Set(backend.calls[0].sourceIds),new Set(rows.slice(9).map(s=>s.sourceId)))
 assert.equal((await store.materials(uid,courseKey(context))).length,12);assert.equal((await store.messages(uid,courseKey(context),sessionKey(context))).length,2);c.dispose()
})
test('project and range requests cover more than eight materials while never borrowing another lecture chat history',async()=>{
 const rows=Array.from({length:12},(_,i)=>source(i+1)),backend=new Capture(rows),store=new AIStore(),uid=crypto.randomUUID();
 const old={...context,dayID:meetings[0].dayID};await store.putMessage({id:crypto.randomUUID(),uid,courseKey:courseKey(context),sessionKey:sessionKey(old),role:'user',text:'第1回だけの非共有会話',sourceIds:[],state:'done',createdAt:1})
 const c=new AIController(uid,context,backend,store,()=>{});await c.init();c.setReferenceScope('course');assert.equal(c.scopedMaterials.length,12);await c.send('全授業回の試験対策をして')
 assert.deepEqual(backend.calls[0].sourceIds,[]);assert.equal(backend.calls[0].referenceScope!.mode,'course');assert.equal(backend.calls[0].turns.length,1);assert(!JSON.stringify(backend.calls[0]).includes('非共有会話'));assert.equal(c.messages.at(-1)!.references!.sources.length,12);assert.equal(c.messages.at(-1)!.sourceIds.length,12)
 c.setReferenceScope('lectures',meetings.slice(0,7).map(m=>m.dayID));await c.send('指定した回までをまとめて');assert.equal(c.messages.at(-1)!.references!.sources.length,7);assert.equal(backend.calls[1].referenceScope!.dayIDs!.length,7)
 c.dispose();const restored=new AIController(uid,context,backend,new AIStore(),()=>{});await restored.init();assert.equal(restored.referenceMode,'lecture');assert.equal(restored.messages.at(-1)!.references!.sources.length,7);assert.equal((await store.messages(uid,courseKey(context),sessionKey(old))).length,1);restored.dispose()
})
test('new uploads stay single cloud sources and automatically join the library without copying another lecture',async()=>{
 const backend=new Capture([]),store=new AIStore(),uid=crypto.randomUUID(),c=new AIController(uid,context,backend,store,()=>{});await c.init();const note=await c.stageNote('新しく送った架空メモ');await wait(()=>!!note.remote);assert.equal(c.projectMaterials.filter(m=>m.id===note.id).length,1);c.dispose()
 const next=new AIController(uid,{...context,dayID:context.dayID+7},backend,store,()=>{});await next.init();assert.equal(next.materials.length,0);assert.equal(next.projectMaterials.length,1);assert.equal(next.messages.length,0);assert.equal((await store.materials(uid,courseKey(context))).length,1);next.dispose()
})
test('unsupported backend cannot silently fall back, and manual continuation freezes its original project scope',async()=>{
 const backend=new Capture([source(1)]);Object.defineProperty(backend,'projectContextProtocol',{value:undefined});const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init();assert.throws(()=>c.setReferenceScope('course'),/backend/);assert.equal(backend.calls.length,0);c.dispose()
 const resumable=new Capture([source(1)]),r=new AIController(crypto.randomUUID(),context,resumable,new AIStore(),()=>{});await r.init();r.setReferenceScope('lectures',[meetings[0].dayID]);resumable.interrupt=true;await r.send('前半のまとめ');const message=r.messages.at(-1)!;assert(message.canResume);r.setReferenceScope('course');await r.resume(message.id);assert.deepEqual(resumable.calls[0].referenceScope,resumable.calls[1].referenceScope);r.dispose()
})
test('lecture range UI, shared library drawer and persisted citations remain connected to the actual sent request',async()=>{
 const backend=new Capture(Array.from({length:12},(_,i)=>source(i+1))),root=document.getElementById('root')!,view=new CourseChat(root,course,crypto.randomUUID(),backend,new AIStore(),context,undefined,undefined,meetings);await view.mount()
 const select=root.querySelector<HTMLSelectElement>('[aria-label="資料の参照範囲"]')!;assert.equal(select.value,'lecture');assert.equal(root.querySelector('.ai-materials-toggle')!.textContent,'資料 (12)');assert(root.querySelector('.ai-materials-panel-header')!.textContent!.includes('この授業の資料庫'))
 select.value='lectures';select.dispatchEvent(new dom.window.Event('change'));const to=root.querySelector<HTMLSelectElement>('[aria-label="参照する最後の授業回"]')!;to.value=String(meetings[6].dayID);to.dispatchEvent(new dom.window.Event('change'))
 assert(root.querySelector('.ai-attachment-status')!.textContent!.includes('指定範囲外'));assert.equal(root.querySelector('.ai-attachment-dismiss')!.textContent,'表示を閉じる')
 root.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='第7回までで試験対策して';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await wait(()=>!!root.querySelector('.ai-project-references'))
 assert.equal(backend.calls[0].referenceScope!.dayIDs!.length,7);assert.equal(root.querySelector('.ai-project-references summary')!.textContent,'参照資料 7件 · 指定した授業回');assert(root.querySelector('.ai-project-references')!.textContent!.includes('第7回'));assert(!root.querySelector('.ai-project-references')!.textContent!.includes('第8回'))
 root.querySelector<HTMLButtonElement>('.ai-materials-toggle')!.click();const first=root.querySelector<HTMLButtonElement>('.ai-material-actions button')!;first.click();await wait(()=>root.querySelector('.ai-evidence-body')!.textContent!.includes('保存済み最終本文'));view.dispose()
})

test('actual shared backend selector → Gemini request → Web reply metadata → saved lecture history/UI', {skip:!process.env.AI_PROJECT_BACKEND_MODULE},async()=>{
 const require=createRequire(import.meta.url),modulePath=process.env.AI_PROJECT_BACKEND_MODULE!,shared=require(modulePath),chat=require(modulePath.replace(/courseProject\.js$/,'chat.js'));
 const rows=Array.from({length:12},(_,i)=>source(i+1));const root=document.getElementById('root')!;let prompt='';
 class Bridge extends Capture {override async chat(r:ChatRequest):Promise<ChatReply>{this.calls.push(structuredClone(r));const input=chat.validateChat(r);const result=await shared.projectContext('synthetic-owner','2026:00004',input.referenceScope,r.turns.at(-1)!.text,12000,{
  listSources:async()=>({items:this.rows.map(s=>({...s,ownerUserId:'synthetic-owner',activeRun:s.activeVersion}))}),listChunks:async(s:any)=>({items:[{chunkId:'one',text:s.title+'の選択route最終本文 Observation → Question。',locator:{pageNumber:4},method:'multimodal_ai'}]}),reread:async()=>this.rows.map(s=>({...s,ownerUserId:'synthetic-owner',activeRun:s.activeVersion}))})
  const messages=chat.buildMessages(input,result.context,result.references);prompt=messages.find((m:any)=>m.role==='user'&&m.content.includes('<資料>')).content
  const answer=await chat.geminiChat('mock-only',messages,async()=>({ok:true,status:200,json:async()=>({modelVersion:chat.CHAT.model,candidates:[{finishReason:'STOP',content:{parts:[{text:'各回の資料に共通する流れは Observation → Question です（各資料 p.4）。'}]}}],usageMetadata:{promptTokenCount:200, candidatesTokenCount:30,totalTokenCount:230}})}));return {...answer,references:result.references}
 }}
 const store=new AIStore(),uid=crypto.randomUUID(),backend=new Bridge(rows),view=new CourseChat(root,course,uid,backend,store,context,undefined,undefined,meetings);await view.mount();const select=root.querySelector<HTMLSelectElement>('[aria-label="資料の参照範囲"]')!;select.value='course';select.dispatchEvent(new dom.window.Event('change'));root.querySelector<HTMLTextAreaElement>('textarea')!.value='全授業の資料を使って概念を整理して';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await wait(()=>!!root.querySelector('.ai-project-references'))
 for(const s of rows)assert(prompt.includes(s.title));assert(prompt.includes('[p.4]'));assert(prompt.includes('Observation → Question'));assert.equal(root.querySelector('.ai-project-references summary')!.textContent,'参照資料 12件 · この授業の全資料');const saved=await store.messages(uid,courseKey(context),sessionKey(context));assert.equal(saved.at(-1)!.references!.sources.length,12);assert.equal(saved.at(-1)!.recognition!.totalTokens,230);view.dispose()
})
