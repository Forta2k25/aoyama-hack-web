import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { indexedDB } from 'fake-indexeddb'
import { DemoAIBackend } from '../src/ai/demo.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="tab-panel-timetable"><div id="mypage-layout"><aside id="course-side-panel"><div id="course-side-body"></div></aside></div></div><div id="course-modal" hidden><div id="course-modal-body"></div></div>',{url:'http://localhost/mypage'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,indexedDB,__WEB_AI_PREVIEW_BUILD__:true})
Object.defineProperty(dom.window,'innerWidth',{value:1100,configurable:true});dom.window.scrollTo=()=>{}
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))}
const syllabusValues=new Map<string,Promise<any>>(),syllabusCalls:string[]=[],chatCalls:any[]=[]
const resolves=new Map<string,(value:unknown)=>void>()
mock.module('../src/timetable.ts',{namedExports:{fetchTimetable:async()=>[],fetchCourseDetail:(course:any)=>new Promise(resolve=>resolves.set(course.id,resolve)),fetchFriends:async()=>[],termLabel:()=>'',slotColor:()=>'',dayName:()=>''}})
mock.module('../src/syllabus.ts',{namedExports:{fetchAndParseSyllabus:async(url:string)=>{syllabusCalls.push(url);return syllabusValues.get(url)??null}}})
mock.module('../src/components/SyllabusSearch.ts',{namedExports:{syllabusSearchMarkup:()=>'',initSyllabusSearch:()=>{}}})
mock.module('../src/auth.ts',{namedExports:{getUser:()=>({uid:'synthetic-panel-owner'})}})
mock.module('../src/ai/backend.ts',{namedExports:{FirebaseAIBackend:class extends DemoAIBackend{constructor(_uid:string){super()}override async chat(request:any){chatCalls.push(request);return {text:'授業の参照情報を確認しました'}}}}})
const {openCourseModal,closeCourseModal}=await import('../src/components/MyPage.ts')
const c=(id:string)=>({id,title:`授業${id}`,teacher:'架空教員',room:'',firestoreDocID:'00004',academicYear:2026})
const flush=()=>new Promise(r=>setTimeout(r,20))
test('late syllabus A response never replaces selected course B or its AI panel',async()=>{
 openCourseModal(c('A'));openCourseModal(c('B'));resolves.get('B')!({});await flush();resolves.get('A')!({});await flush()
 const root=document.getElementById('course-side-body')!;assert(root.textContent!.includes('授業B'));assert(!root.textContent!.includes('授業A'))
 assert.equal(root.querySelectorAll('[role=tab]').length,2)
 root.querySelectorAll<HTMLButtonElement>('[role=tab]')[1].click();await flush();assert(root.querySelector('.web-ai'));assert(root.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!.textContent!.includes('AIチャット'))
 closeCourseModal();assert(!document.getElementById('course-side-panel')!.classList.contains('is-open'));assert.equal(document.getElementById('course-side-body')!.textContent,'')
})
test('friend course detail keeps syllabus only; shared backend is never opened on that path',async()=>{
 openCourseModal(c('friend'),false);resolves.get('friend')!({});await flush();assert.equal(document.querySelectorAll('#course-side-body [role=tab]').length,0);assert(!document.querySelector('#course-side-body .web-ai'));closeCourseModal()
})

test('mobile course uses the existing modal rather than the desktop aside',async()=>{
 Object.defineProperty(dom.window,'innerWidth',{value:390,configurable:true});openCourseModal(c('mobile'));resolves.get('mobile')!({});await flush()
 const modal=document.getElementById('course-modal')!;assert.equal(modal.hidden,false);assert.equal(modal.querySelectorAll('[role=tab]').length,2)
 modal.querySelectorAll<HTMLButtonElement>('[role=tab]')[1].click();await flush();assert(modal.querySelector('.web-ai'));closeCourseModal();assert(modal.hidden);assert.equal(document.getElementById('course-modal-body')!.textContent,'')
})

test('switching a lecture may replace its clicked button without being mistaken for an outside click',async()=>{
 Object.defineProperty(dom.window,'innerWidth',{value:1100,configurable:true});openCourseModal(c('replace'));resolves.get('replace')!({});await new Promise(r=>setTimeout(r,130))
 const root=document.getElementById('course-side-body')!,button=document.createElement('button');button.textContent='第4回授業';root.append(button);button.addEventListener('click',()=>root.replaceChildren(document.createElement('p')));button.click()
 assert(document.getElementById('course-side-panel')!.classList.contains('is-open'));closeCourseModal()
})


test('syllabus shown in MyPage reaches the actual lecture chat even if AI is opened before retrieval',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 Object.defineProperty(dom.window,'innerWidth',{value:1100,configurable:true})
 const url='https://syllabus.aoyama.ac.jp/shousai.ashx?YR=2025&FN=synthetic-panel';let release!:(value:any)=>void;syllabusValues.set(url,new Promise(resolve=>{release=resolve}))
 openCourseModal({...c('with-syllabus'),syllabusURL:url,semester:'fall',meetingDay:2,campus:'青山'});resolves.get('with-syllabus')!({})
 const root=document.getElementById('course-side-body')!;root.querySelectorAll<HTMLButtonElement>('[role=tab]')[1].click();await flush();await flush()
 root.querySelector<HTMLButtonElement>('.ai-lecture-card')!.click();await flush();assert(document.querySelector<HTMLButtonElement>('dialog .ai-send')!.disabled)
 release({outline:'この授業だけの講義概要',objective:'この授業の達成目標',lectureItems:['1. 導入','4. 面接調査の分析'],evalItems:[],methods:[],textbooks:[],refs:[]})
 for(let i=0;i<30&&!document.querySelector('dialog .ai-send:not([disabled])');i++)await flush()
 assert(document.querySelector('dialog .ai-send:not([disabled])'));assert(root.textContent!.includes('この授業だけの講義概要'),'display keeps the same syllabus')
 document.querySelector<HTMLTextAreaElement>('dialog .ai-composer-input')!.value='今日の予定は？';document.querySelector('dialog form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));for(let i=0;i<30&&!chatCalls.length;i++)await flush()
 assert.equal(chatCalls.length,1);assert(chatCalls[0].syllabus.includes('この授業だけの講義概要'));assert(chatCalls[0].syllabus.includes('この回の予定: 4. 面接調査の分析'));assert.equal(syllabusCalls.filter(x=>x===url).length,1);closeCourseModal()
})
