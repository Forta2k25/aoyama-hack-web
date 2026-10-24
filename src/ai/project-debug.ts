import {CourseChat} from '../components/CourseChat'
import {DemoAIBackend} from './demo'
import {AIStore} from './store'
import {dayIDFor,dateForDayID} from './identity'
import type {RemoteSource} from './types'

// Synthetic, browser-only review fixture. This module never imports Firebase or authenticates a real user.
export async function renderProjectDebug(){
 document.title='授業プロジェクト｜架空のUIデモ'
 const meetings=Array.from({length:8},(_,i)=>({number:i+1,dayID:dayIDFor('2026-08-25')+7*i,date:dateForDayID(dayIDFor('2026-08-25')+7*i),thisWeek:i===7,upcoming:false}))
 const current=meetings.at(-1)!,context={localCourseId:'00000000-0000-4000-8000-000000000022',localCourseUUID:'00000000-0000-4000-8000-000000000022',classDocId:'00004',year:2026,semester:'fall',dayID:current.dayID,courseName:'科学的方法入門（架空）',teacherName:'架空教員'}
 const sources=Array.from({length:12},(_,i)=>{const meeting=meetings[Math.floor(i*8/12)];const source:RemoteSource={sourceId:'project-demo-'+i,sourceType:'pdf',title:`第${meeting.number}回・${['観察と問い','仮説の検証','実験の計画','資料の読み方'][i%4]}（架空）`,status:'ready',courseOfferingId:'2026:00004',dayID:meeting.dayID,lectureId:'opaque-demo-'+meeting.number,activeVersion:'fixture',pipelineVersion:'pdf-auto-v1'};return {source,text:'【架空の最終Evidence】Observation → Question → Hypothesis。p.4の図に描かれた矢印のみを記述する。'}})
 const screen=document.createElement('dialog');screen.className='ai-chat-screen'
 const header=document.createElement('header');header.className='ai-chat-screen-header'
 const back=document.createElement('a');back.href='/student';back.className='ai-small-button';back.textContent='← 学生トップ'
 const titles=document.createElement('div');titles.className='ai-chat-screen-titles';const title=document.createElement('h3');title.className='ai-session-course';title.textContent=context.courseName;const subtitle=document.createElement('p');subtitle.className='ai-session-title';subtitle.textContent='授業プロジェクト / 第8回のチャット · UIデモ（外部送信なし）';titles.append(title,subtitle)
 const actions=document.createElement('div');actions.className='ai-chat-screen-actions';header.append(back,titles,actions)
 const host=document.createElement('section');host.className='ai-session-chat';screen.append(header,host);document.querySelector('#app')!.replaceChildren();document.body.append(screen);screen.showModal()
 const chat=new CourseChat(host,{id:context.localCourseUUID,title:context.courseName,teacher:'架空教員',room:''},'web-ai-course-project-debug',new DemoAIBackend(sources),new AIStore(),context,actions,undefined,meetings)
 await chat.mount();window.addEventListener('pagehide',()=>{chat.dispose();screen.remove()},{once:true})
}
