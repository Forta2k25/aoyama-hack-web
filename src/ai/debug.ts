import { CourseAI } from '../components/CourseAI'
import { DemoAIBackend } from './demo'
import { AIStore } from './store'
export async function renderDebug(){
  document.title='AIハック｜Webデバッグ'
  const root=document.querySelector<HTMLElement>('#app')!;root.className='ai-debug-shell'
  root.innerHTML='<header class="ai-debug-header"><a href="/">青山ハック</a><span>UIデモ・架空の返信</span><a href="/mypage#timetable" class="ai-live-link">本番の時間割・AIチャットへ →</a></header><main class="ai-debug-main"><aside class="ai-debug-course"><p class="eyebrow">2026年 後期</p><h1>授業の資料と、<br>会話する。</h1><p>授業の資料と会話を、同じ場所に。</p><div class="course-detail-tabs" role="tablist" aria-label="授業の詳細"><button type="button" role="tab" aria-selected="false" data-debug-tab="syllabus">シラバス</button><button type="button" role="tab" aria-selected="true" data-debug-tab="ai">AIハック ✦</button></div><p class="ai-debug-syllabus" hidden>架空の授業：科学的方法入門<br>教員：デバッグ用の架空教員<br>この画面はUIを確認するためのものです。</p></aside><section class="ai-debug-chat" aria-label="AIハック"></section></main>'
  const host=root.querySelector<HTMLElement>('.ai-debug-chat')!,store=new AIStore(),uid='web-ai-debug-user'
  const context={localCourseId:'00000000-0000-4000-8000-000000000001',localCourseUUID:'00000000-0000-4000-8000-000000000001',classDocId:'00004',year:2026,dayID:20741,courseName:'科学的方法入門',teacherName:'架空教員',semester:'fall'}
  const old=await store.materials(uid,'2026:00004'),backend=new DemoAIBackend(old.flatMap(x=>x.remote?[{source:x.remote,text:x.text}]:[]))
  const course=new CourseAI(host,{id:context.localCourseUUID,title:context.courseName,teacher:context.teacherName,room:'デバッグ教室',meetingDay:1,campus:'青山',firestoreDocID:'00004',academicYear:2026,semester:'fall',syllabusURL:'https://syllabus.aoyama.ac.jp/shousai.ashx?YR=2026&FN=synthetic'},uid,backend,store)
  root.querySelectorAll<HTMLButtonElement>('[data-debug-tab]').forEach(button=>button.addEventListener('click',()=>{const ai=button.dataset.debugTab==='ai';host.hidden=!ai;root.querySelector<HTMLElement>('.ai-debug-syllabus')!.hidden=ai;root.querySelectorAll<HTMLButtonElement>('[data-debug-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===button)))}))
  await course.mount();window.addEventListener('pagehide',()=>course.dispose(),{once:true})
}
