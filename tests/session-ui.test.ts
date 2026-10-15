import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {indexedDB} from 'fake-indexeddb'
import {CourseAI} from '../src/components/CourseAI.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {AIStore} from '../src/ai/store.ts'
import type {ChatRequest} from '../src/ai/types.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/mypage'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
class Backend extends DemoAIBackend{requests:ChatRequest[]=[];override async chat(r:ChatRequest){this.requests.push(r);return {text:'この授業回だけの返信'}}}
const flush=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await new Promise(r=>setTimeout(r,3));assert(check(),'UI did not settle')}
test('lecture cards open separate conversations, preserve return/reload, and isolate a second course with the same placeholder',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 const root=document.getElementById('root')!,uid=crypto.randomUUID(),backend=new Backend(),store=new AIStore(),course={id:'#####',title:'架空の火曜授業A',teacher:'架空教員',room:'',academicYear:2026,semester:'fall',meetingDay:1,campus:'青山',timetableRecord:'assignedCourses.2026_後期:cells.d1p2'}
 const view=new CourseAI(root,course,uid,backend,store);await view.mount();assert.equal(root.querySelectorAll('.ai-lecture-card').length,4);assert.match(root.textContent!,/10\/13/)
 root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush(()=>!!root.querySelector('textarea:not([disabled])'))
 root.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='第4回だけの質問';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush(()=>root.textContent!.includes('この授業回だけの返信'))
 const back=()=>[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent==='← 授業回一覧')!.click()
 back();await flush(()=>!!root.querySelector('.ai-lecture-card'));root.querySelectorAll<HTMLButtonElement>('.ai-lecture-card')[1].click();await flush(()=>!!root.querySelector('textarea:not([disabled])'));assert(!root.textContent!.includes('第4回だけの質問'));assert(!root.textContent!.includes('この授業回だけの返信'))
 back();await flush(()=>!!root.querySelector('.ai-lecture-card'));root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush(()=>root.textContent!.includes('第4回だけの質問'));view.dispose()
 const other=new CourseAI(root,{...course,title:'架空の授業B',timetableRecord:'assignedCourses.2026_後期:cells.d1p3'},uid,backend,store);await other.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush(()=>!!root.querySelector('textarea:not([disabled])'));assert(!root.textContent!.includes('第4回だけの質問'));other.dispose()
 assert.equal(backend.requests.length,1);assert.equal(backend.requests[0].context.dayID,Math.floor(Date.parse('2026-10-13')/86400000))
 const restored=new CourseAI(root,course,uid,backend,new AIStore());await restored.mount();root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush(()=>root.textContent!.includes('第4回だけの質問'));restored.dispose()
})

test('a 2026 timetable with a 2025 syllabus link still renders dated cards without rewriting the chat offering year',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 const root=document.getElementById('root')!,backend=new Backend(),course={id:'#####',title:'架空の水曜授業',teacher:'架空教員',room:'',academicYear:2026,semester:'fall',meetingDay:2,campus:'青山',timetableRecord:'assignedCourses.2026_後期:cells.d2p1',syllabusURL:'https://syllabus.aoyama.ac.jp/shousai.ashx?YR=2025&FN=synthetic'}
 const view=new CourseAI(root,course,crypto.randomUUID(),backend);await view.mount();assert.equal(root.querySelectorAll('.ai-lecture-card').length,4);assert.match(root.textContent!,/10\/14/);assert.match(root.textContent!,/時間割の2026年度/)
 root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush(()=>!!root.querySelector('textarea:not([disabled])'));root.querySelector<HTMLTextAreaElement>('.ai-composer-input')!.value='この授業回のテスト';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush(()=>root.textContent!.includes('この授業回だけの返信'))
 assert.equal(backend.requests[0].context.year,2025);assert.equal(backend.requests[0].context.dayID,Math.floor(Date.parse('2026-10-14')/86400000));view.dispose()
})
