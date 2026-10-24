import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { AIStore } from '../src/ai/store.ts'
import { syllabusYear,makeContext,courseKey,offeringId,sessionKey } from '../src/ai/identity.ts'
import { evidenceText,fileKind,metadataText,safeError } from '../src/ai/format.ts'
import { AIController,persistentSource } from '../src/ai/controller.ts'
import { validateUpload } from '../src/ai/upload.ts'
import { aiEnabled } from '../src/ai/access.ts'
import { DemoAIBackend } from '../src/ai/demo.ts'
import type { CourseContext,RemoteSource,ChatRequest,Receipt } from '../src/ai/types.ts'
Object.assign(globalThis,{indexedDB})
const context:CourseContext={localCourseId:'synthetic-course',localCourseUUID:'synthetic-course',year:2026,classDocId:'00004',semester:'fall',dayID:20000,courseName:'架空の授業',teacherName:'架空教員'}
const course={id:'synthetic-id',title:'架空授業',teacher:'架空教員',room:'',firestoreDocID:'00004',academicYear:2025,syllabusURL:'https://syllabus.aoyama.ac.jp/shousai.ashx?YR=2026&FN=sample'}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function until(check:()=>boolean){for(let i=0;i<200&&!check();i++)await sleep(5);assert(check(),'operation did not settle')}
class Backend extends DemoAIBackend {
  calls:ChatRequest[]=[];createIds:string[]=[];createInputs:any[]=[];deletions:string[]=[];failUpload=false;createWait?:Promise<void>
  override async create(data:any):Promise<Receipt>{this.createIds.push(data.clientRequestId);this.createInputs.push(data);await this.createWait;const x=await super.create(data);return data.type==='note'?x:{...x,status:'awaiting_upload',upload:{url:'https://storage.googleapis.com/fixture'}}}
  override async upload(...args:Parameters<DemoAIBackend['upload']>){if(this.failUpload)throw Error('upload unavailable');await super.upload(...args)}
  override async chat(request:ChatRequest){this.calls.push(request);return {text:'資料に基づく架空のテスト返信'}}
  override async delete(id:string){this.deletions.push(id);await super.delete(id)}
}

test('year comes from YR first, then timetable; current year/code/name are never IDs',()=>{
  assert.equal(syllabusYear(course.syllabusURL),2026)
  const c=makeContext(course,'persistent-local');assert.equal(c.year,2026);assert.equal(offeringId(c),'2026:00004')
  assert.equal(makeContext({...course,syllabusURL:undefined},'local').year,2025)
  assert.equal(makeContext({...course,syllabusURL:undefined,academicYear:undefined},'local',new Date('2031-10-01')).year,undefined)
  for(const value of ['https://example.com/?YR=2026','javascript:alert(1)','https://syllabus.aoyama.ac.jp/?YR=2026&YR=2025','https://syllabus.aoyama.ac.jp/?YR=abc'])assert.equal(syllabusYear(value),undefined)
  for(const id of ['#####','1611020-0004','4','',undefined])assert.equal(offeringId(makeContext({...course,firestoreDocID:id},'local')),undefined)
})
test('same five-digit class ID is separated by year and unresolved courses by UUID',()=>{
  assert.notEqual(courseKey(context),courseKey({...context,year:2027}))
  assert.notEqual(courseKey({...context,classDocId:undefined}),courseKey({...context,classDocId:undefined,localCourseUUID:'another'}))
  assert.match(courseKey({...context,year:undefined}),/unresolved/)
})
test('persistent identities coalesce concurrent tabs and remain isolated per UID',async()=>{
  const store=new AIStore(),ids=await Promise.all(Array.from({length:12},()=>store.identity('synthetic-owner','timetable-slot')))
  assert.equal(new Set(ids).size,1);assert.notEqual(await store.identity('synthetic-other','timetable-slot'),ids[0])
})
test('material and conversation persistence separates UID and annual offering; no signed URL persisted',async()=>{
  const store=new AIStore(),backend=new Backend(),uid=crypto.randomUUID(),c=new AIController(uid,context,backend,store,()=>{})
  await c.init();const row=await c.stageNote('保存して復元する架空本文');await until(()=>row.state==='processing');row.remote!.status='ready';row.state='ready';c.selected.add(row.id);await store.putMaterial(row);await c.send('要点は？')
  const next=new AIController(uid,context,backend,store,()=>{});await next.init();assert.equal(next.messages.length,2);assert(next.materials.some(x=>x.id===row.id))
  assert.equal((await store.materials('different-owner',courseKey(context))).length,0);assert.equal((await store.messages(uid,'2027:00004')).length,0)
  const clean=persistentSource({...row.remote!,upload:{url:'https://storage.googleapis.com/never-persist-signature'}})
  assert(!JSON.stringify(clean).includes('never-persist'));c.dispose();next.dispose()
})
test('failed/interrupted file upload reuses its source receipt and never repeats a fresh create',async()=>{
  const backend=new Backend(),c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init();backend.failUpload=true
  const row=await c.stageFile(new File(['synthetic binary'],'image.png',{type:'image/png'}));await until(()=>row.state==='failed');const id=row.remote!.sourceId
  backend.failUpload=false;await c.retry(row.id);assert.equal(row.remote!.sourceId,id);assert.equal(backend.createIds.length,1);c.dispose()
})
test('analysis runs in the background: send is accepted, the answer waits for ready sources, intro still needs ready ones',async()=>{
  const backend=new Backend(),c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
  const row=await c.stageNote('架空の途中資料');await until(()=>row.state==='processing');c.selected.add(row.id)
  await assert.rejects(c.send('','intro'));assert.equal(backend.calls.length,0)
  const sending=c.send('質問');await until(()=>c.messages.length===2);assert.equal(backend.calls.length,0)
  row.state='ready';row.remote!.status='ready';assert.equal(await sending,true);assert.equal(backend.calls.length,1);assert(backend.calls[0].sourceIds.includes(row.remote!.sourceId));c.dispose()
})
test('deleting while create is in flight captures the receipt and deletes before upload',async()=>{
  const backend=new Backend();let release!:()=>void;backend.createWait=new Promise<void>(resolve=>{release=resolve})
  const c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
  const row=await c.stageFile(new File(['x'],'photo.png',{type:'image/png'}));await until(()=>backend.createIds.length===1)
  await c.delete(row.id);assert.equal(row.wantsDeletion,true);release();await until(()=>!c.materials.some(x=>x.id===row.id));assert.equal(backend.deletions.length,1);c.dispose()
})
test('selected Qwen finalText and page/time locators survive chunk presentation without OCR concatenation',()=>{
  const chunks=[{chunkId:'0001-0000',text:'Observation → Question',method:'multimodal_ai',unitIndex:0,locator:{pageNumber:4,startChar:0,endChar:22}},{chunkId:'0001-0001',text:'Question → Hypothesis',method:'multimodal_ai',unitIndex:0,locator:{pageNumber:4,startChar:14,endChar:35}},{chunkId:'0002-0000',text:'別のページ',method:'native_text',unitIndex:1,locator:{pageNumber:5}}]
  const result=evidenceText(chunks);assert(result.includes('[p.4]'));assert(result.includes('[p.5]'));assert.equal((result.match(/Question/g)??[]).length,1);assert(!result.includes('OCR probe'))
  assert.match(evidenceText([{chunkId:'a',text:'録音本文',method:'groq_asr',locator:{startSeconds:15,endSeconds:30}}]),/15秒〜30秒/)
})
test('file validation is conservative and does not send unsupported browser webm as m4a',()=>{
  assert.equal(fileKind(new File(['x'],'note.pdf',{type:'application/pdf'})),'pdf');assert.equal(fileKind(new File(['x'],'voice.m4a')),'audio')
  for(const ext of ['wav','mp3','webm'])assert.throws(()=>fileKind(new File(['x'],`voice.${ext}`,{type:`audio/${ext}`})),/m4a/);assert.throws(()=>fileKind(new File(['x'],'page.html',{type:'text/html'})))
})
test('upload targets bind to exact production bucket and current owner; credential headers rejected',()=>{
  const base='https://storage.googleapis.com/forta-aogaku.firebasestorage.app/ai-inputs/aogaku-ai/synthetic-owner/source/original'
  assert.doesNotThrow(()=>validateUpload({url:base,headers:{'Content-Type':'image/png'}},'synthetic-owner'))
  for(const url of [base.replace('https:','http:'),base.replace('storage.googleapis.com','storage.googleapis.com.evil.test'),base.replace('synthetic-owner','other-owner'),base.replace('/ai-inputs/','/avatars/'),base.replace('forta-aogaku.','forta-aogaku-dev.')])assert.throws(()=>validateUpload({url},'synthetic-owner'))
  assert.throws(()=>validateUpload({url:base,headers:{Authorization:'never-forward-tokens'}},'synthetic-owner'))
})
test('production hosts stay hidden even in preview build; false flag disables all hosts',()=>{
  for(const host of ['www.aoyamahack.com','aoyamahack.com','aoyama-hack-web.vercel.app'])assert.equal(aiEnabled(true,host),false)
  assert.equal(aiEnabled(true,'localhost'),true);assert.equal(aiEnabled(false,'localhost'),false)
})
test('audio pricing never invents tokens; missing measurements remain unknown',()=>{
  assert.match(metadataText({method:'groq_asr',audioDurationSeconds:120}),/token課金ではない/)
  assert.match(metadataText({totalTokens:5}),/未取得/);assert(!metadataText().includes('$0'))
})

test('two rapid chat submits admit at most one request, including during IndexedDB save',async()=>{
 const backend=new Backend(),c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init()
 const first=c.send('同時送信テスト');await assert.rejects(c.send('二重送信'));await first;assert.equal(backend.calls.length,1);c.dispose()
})
test('legacy OCR overlap is removed within a unit but repeated text on another page survives',()=>{
 const rows=[{chunkId:'1',text:'保存済みOCRの重なり',method:'vision_ocr',locator:{pageNumber:1}},{chunkId:'2',text:'重なりと続き',method:'vision_ocr',locator:{pageNumber:1}},{chunkId:'3',text:'保存済みOCRの重なり',method:'vision_ocr',locator:{pageNumber:2}}]
 const text=evidenceText(rows);assert(text.includes('保存済みOCRの重なりと続き'));assert.equal((text.match(/保存済みOCR/g)??[]).length,2)
})

test('failure diagnostics expose only bounded error codes, never URLs or arbitrary error messages',()=>{
 assert.match(safeError({details:{code:'INVALID_MIME'}}),/INVALID_MIME/)
 for(const code of ['https://example.test/private','private-value-123456789','x'.repeat(100)])assert(!safeError({details:{code}}).includes(code))
 assert(!safeError(Error('private response')).includes('private response'))
})

test('resuming a durable m4a keeps its measured duration and sends integer seconds with the same request ID',async()=>{
 const store=new AIStore(),backend=new Backend(),uid=crypto.randomUUID(),id=crypto.randomUUID(),requestId=crypto.randomUUID()
 await store.putMaterial({id,uid,courseKey:courseKey(context),sessionKey:sessionKey(context),context,clientRequestId:requestId,type:'audio',title:'synthetic.m4a',mime:'audio/mp4',size:3,file:new Blob(['aac']),durationSeconds:8.04,state:'failed',createdAt:Date.now()})
 const c=new AIController(uid,context,backend,store,()=>{});await c.init();await c.retry(id)
 assert.equal(backend.createInputs[0].durationSeconds,9);assert.equal(backend.createInputs[0].clientRequestId,requestId);assert.equal(backend.createInputs[0].type,'audio');assert.equal(backend.createInputs[0].mime,'audio/mp4')
 assert.equal((await store.materials(uid,courseKey(context)))[0].durationSeconds,8.04);c.dispose()
})
