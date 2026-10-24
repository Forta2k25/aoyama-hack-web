import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {indexedDB} from 'fake-indexeddb'
import {loadCourseSyllabus,chatSyllabus,syllabusContextLimit,type CourseSyllabus} from '../src/ai/syllabus.ts'
import {parseSyllabusHTML} from '../src/syllabus.ts'
import {CourseAI} from '../src/components/CourseAI.ts'
import {AIController} from '../src/ai/controller.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {ChatStreamError,receiveChat} from '../src/ai/chat-stream.ts'
import {makeContext} from '../src/ai/identity.ts'
import type {ChatRequest,ChatReply} from '../src/ai/types.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/mypage'})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))}
Object.assign(globalThis,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,HTMLElement:dom.window.HTMLElement,indexedDB})
const url='https://syllabus.aoyama.ac.jp/shousai.ashx?YR=2025&FN=synthetic'
const course={id:'#####',title:'架空の調査法',teacher:'架空教員',room:'',syllabusURL:url,academicYear:2026,semester:'fall',meetingDay:2,campus:'青山',timetableRecord:'assignedCourses.2026_後期:cells.d2p1'}
const html=(tag:string)=>`<span id="CPH1_lblGaiyou">${tag}の講義概要</span><span id="CPH1_lblMokuhyou">${tag}の到達目標</span><span id="CPH1_lblJouken">予習を行う</span>${[1,2,4].map(n=>`<span id="CPH1_gvKeikaku_lblSQ_NO_${n}">${n}</span><span id="CPH1_gvKeikaku_lblKeikaku_${n}">${tag}の第${n}回予定</span>`).join('')}<table class="table-seiseki"><tr><td class="col1">1</td><td class="col2">レポート</td><td class="col3">60%</td><td class="col4">論拠と構成</td></tr></table><table id="CPH1_gvKyoukasho"><tr><td class="books-author">架空著者</td><td class="books-title">${tag}の教科書</td></tr></table>`
const reference=(tag:string):CourseSyllabus=>({status:'ready',url,content:parseSyllabusHTML(html(tag))})
const until=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await new Promise(r=>setTimeout(r,3));assert(check(),'UI did not settle')}
class Backend extends DemoAIBackend {calls:ChatRequest[]=[];interrupt=false;override async chat(request:ChatRequest,_signal?:AbortSignal,delta?:(s:string)=>void):Promise<ChatReply>{this.calls.push(structuredClone(request));if(this.interrupt){this.interrupt=false;delta?.('返信の途中');throw new ChatStreamError(Error('network'),true,request)}return {text:'参照情報付きの返信'}}}

test('actual parser and loader retain syllabus fields using the existing proxy, once',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async(input:unknown,options:any)=>{calls++;assert.equal(String(input),'/api/syllabus?url='+encodeURIComponent(url));assert(options.signal instanceof AbortSignal);return new Response(html('A'))})
 const ref=await loadCourseSyllabus(url);assert.equal(calls,1);assert.equal(ref.status,'ready')
 const value=chatSyllabus(ref,course,4).text
 for(const part of ['Aの講義概要','Aの到達目標','この回の予定: 4. Aの第4回予定','レポート 60% 論拠と構成','Aの教科書','架空著者','シラバス参照年度: 2025','時間割年度: 2026'])assert(value.includes(part),part)
 assert(!value.includes('この回の予定: 2.'));assert.equal(chatSyllabus(ref,course,3).text.includes('この回の予定:'),false,'missing row is never guessed from array position')
})
test('custom/missing/invalid syllabus URLs make no request and contribute no context',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not fetch')})
 for(const value of [undefined,'','https://example.test/','https://syllabus.aoyama.ac.jp.evil.test/','https://syllabus.aoyama.ac.jp@evil.test/','https://user:password@syllabus.aoyama.ac.jp/','javascript:alert(1)']){
  const ref=await loadCourseSyllabus(value);assert.equal(ref.status,'absent');assert.equal(chatSyllabus(ref,course,4).text,'')
 }
 assert.equal(calls,0)
})
test('network errors and empty/unrecognized HTML remain unavailable rather than invented context',async t=>{
 for(const result of ['error','empty','login','bad-status']){
  const mocked=t.mock.method(globalThis,'fetch',async()=>{if(result==='error')throw Error('unavailable');return new Response(result==='login'?'<h1>ログイン</h1>':'',{status:result==='bad-status'?503:200})})
  const ref=await loadCourseSyllabus(url);assert.equal(ref.status,'unavailable');assert.equal(chatSyllabus(ref,course,4).text,'');mocked.mock.restore()
 }
})
test('a stalled syllabus fetch times out and permits chat without context',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 t.mock.method(globalThis,'fetch',async(_input:unknown,options:any)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})))
 const pending=loadCourseSyllabus(url);t.mock.timers.tick(12000);assert.equal((await pending).status,'unavailable')
})
test('long syllabi stay within the deployed contract and prioritize the selected lecture',()=>{
 const ref=reference('A');ref.content!.outline='概要'.repeat(5000);ref.content!.lectureItems=Array.from({length:60},(_,i)=>`${i+1}. ${'長い説明😀'.repeat(100)}`)
 const value=chatSyllabus(ref,course,25).text;assert(value.length<=syllabusContextLimit);assert(value.includes('この回の予定: 25.'));assert(value.includes('60.'));assert(!/[\uD800-\uDBFF]$/.test(value));assert(value.includes('授業計画'))
})
test('an early chat waits for its syllabus, reuses it across lectures and sends the selected meeting',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 let fetches=0;let resolve!:(r:Response)=>void;const response=new Promise<Response>(r=>{resolve=r});t.mock.method(globalThis,'fetch',async()=>{fetches++;return response})
 const root=document.getElementById('root')!,backend=new Backend(),view=new CourseAI(root,course,crypto.randomUUID(),backend,undefined,loadCourseSyllabus(url))
 await view.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await until(()=>!!document.querySelector('.ai-send'));assert(document.querySelector<HTMLButtonElement>('.ai-send')!.disabled);assert.match(document.body.textContent!,/シラバスを確認/)
 resolve(new Response(html('A')));await until(()=>!!document.querySelector('.ai-send:not([disabled])'))
 const ask=async()=>{document.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='この回の予定は？';document.querySelector('dialog form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await until(()=>backend.calls.length>0&&!document.querySelector('.ai-send[disabled]'))}
 await ask();assert.match(backend.calls[0].syllabus!,/この回の予定: 4\. Aの第4回予定/)
 ;[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(x=>x.closest('.ai-chat-screen-header'))!.click();await until(()=>!!root.querySelector('.ai-lecture-card'));root.querySelectorAll<HTMLButtonElement>('.ai-lecture-card')[1].click();await until(()=>!!document.querySelector('.ai-send:not([disabled])'))
 await ask();assert(!backend.calls[1].syllabus!.includes('この回の予定:'),'missing third lecture not guessed');assert(backend.calls[1].syllabus!.includes('選択した授業回: 第3回'));assert.notEqual(backend.calls[0].context.dayID,backend.calls[1].context.dayID);assert.equal(fetches,1);view.dispose()
})
test('late course A syllabus cannot overwrite course B or send A context from B',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 let resolve!:(r:CourseSyllabus)=>void;const pending=new Promise<CourseSyllabus>(r=>{resolve=r}),root=document.getElementById('root')!,backend=new Backend()
 const a=new CourseAI(root,course,crypto.randomUUID(),backend,undefined,pending);await a.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await until(()=>!!document.querySelector('.ai-send'));a.dispose()
 const bCourse={...course,title:'別授業B',timetableRecord:'assignedCourses.2026_後期:cells.d2p2'},b=new CourseAI(root,bCourse,crypto.randomUUID(),backend,undefined,Promise.resolve(reference('B')));await b.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await until(()=>!!document.querySelector('.ai-send:not([disabled])'));resolve(reference('A'))
 document.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='予定は？';document.querySelector('dialog form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await until(()=>backend.calls.length===1);assert(backend.calls[0].syllabus!.includes('Bの講義概要'));assert(!backend.calls[0].syllabus!.includes('Aの'));assert(!document.body.textContent!.includes('架空の調査法'));b.dispose()
})
test('unavailable syllabus does not block chat and shows an honest notice',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 const backend=new Backend(),root=document.getElementById('root')!,view=new CourseAI(root,course,crypto.randomUUID(),backend,undefined,Promise.resolve({status:'unavailable',url}));await view.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await until(()=>!!document.querySelector('.ai-send:not([disabled])'));assert.match(document.body.textContent!,/今回は含めません/)
 document.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='こんにちは';document.querySelector('dialog form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await until(()=>backend.calls.length===1);assert(!('syllabus' in backend.calls[0]));view.dispose()
})
test('syllabus is included for reply, intro and manual continuation without becoming a material',async()=>{
 const backend=new Backend(),uid=crypto.randomUUID(),context=makeContext(course,crypto.randomUUID()),text=chatSyllabus(reference('A'),course,4).text,c=new AIController(uid,context,backend,new AIStore(),()=>{},text);await c.init();backend.interrupt=true;await c.send('授業の目標は？');assert.equal(c.messages.at(-1)!.canResume,true);await c.resume(c.messages.at(-1)!.id)
 assert.equal(backend.calls[0].syllabus,text);assert.equal(backend.calls[1].syllabus,text);assert.equal(backend.calls[1].generationId,backend.calls[0].generationId)
 const sourceId=crypto.randomUUID();c.materials.push({id:sourceId,uid,courseKey:c.key,context,clientRequestId:crypto.randomUUID(),type:'note',title:'架空資料',mime:'text/plain',size:1,state:'ready',createdAt:Date.now(),remote:{sourceId,sourceType:'note',title:'架空資料',status:'ready',courseOfferingId:'local:'+context.localCourseUUID}});c.selected.add(sourceId);await c.send('','intro');assert.equal(backend.calls[2].syllabus,text);assert.deepEqual(backend.calls[2].sourceIds,[sourceId]);assert.equal(c.materials.length,1);c.dispose()
 const no=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await no.init();await no.send('独自授業です');assert(!('syllabus' in backend.calls.at(-1)!));no.dispose()
})
test('callable transport preserves the syllabus field on supported reconnects',async()=>{
 const syllabus=chatSyllabus(reference('A'),course,4).text,request:ChatRequest={context:makeContext(course,crypto.randomUUID()),sourceIds:[],turns:[{role:'user',text:'予定は？'}],mode:'reply',syllabus};let n=0
 const result=await receiveChat(request,new AbortController().signal,()=>{},()=>{},async r=>{n++;assert.equal(r.syllabus,syllabus);return {stream:(async function*(){yield {protocol:'chat-resume-v1',delta:'途中'};if(n===1)throw new TypeError('network')})(),data:n===1?new Promise(()=>{}):Promise.resolve({text:'完成'})}},{sleep:async()=>{}})
 assert.equal(result.text,'完成');assert.equal(n,2)
})


test('demo mode does not start a university request unless an explicit synthetic reference is supplied',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')});let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('no demo networking')})
 const view=new CourseAI(document.getElementById('root')!,course,crypto.randomUUID(),new Backend());await view.mount();assert.equal(calls,0);view.dispose()
})
