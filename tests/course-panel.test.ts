import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { indexedDB } from 'fake-indexeddb'
import { DemoAIBackend } from '../src/ai/demo.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="tab-panel-timetable"><div id="mypage-layout"><aside id="course-side-panel"><div id="course-side-body"></div></aside></div></div><div id="course-modal" hidden><div id="course-modal-body"></div></div>',{url:'http://localhost/mypage'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,indexedDB,__WEB_AI_PREVIEW_BUILD__:true})
Object.defineProperty(dom.window,'innerWidth',{value:1100,configurable:true});dom.window.scrollTo=()=>{}
const resolves=new Map<string,(value:unknown)=>void>()
mock.module('../src/timetable.ts',{namedExports:{fetchTimetable:async()=>[],fetchCourseDetail:(course:any)=>new Promise(resolve=>resolves.set(course.id,resolve)),fetchFriends:async()=>[],termLabel:()=>'',slotColor:()=>'',dayName:()=>''}})
mock.module('../src/syllabus.ts',{namedExports:{fetchAndParseSyllabus:async()=>null}})
mock.module('../src/components/SyllabusSearch.ts',{namedExports:{syllabusSearchMarkup:()=>'',initSyllabusSearch:()=>{}}})
mock.module('../src/auth.ts',{namedExports:{getUser:()=>({uid:'synthetic-panel-owner'})}})
mock.module('../src/ai/backend.ts',{namedExports:{FirebaseAIBackend:class extends DemoAIBackend{constructor(_uid:string){super()}}}})
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
