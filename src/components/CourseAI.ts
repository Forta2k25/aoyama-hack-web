import {loadCourseSyllabus,chatSyllabus,type CourseSyllabus} from '../ai/syllabus'
import type {Course} from '../timetable'
import type {AIBackend,CourseContext,Message,LocalMaterial} from '../ai/types'
import {AIStore} from '../ai/store'
import {courseKey,resolveContext,sessionKey,isCourseUUID,makeContext,dayIDFor} from '../ai/identity'
import {lectureSchedule,validDate,calendarSource,japanDate,type LectureSettings,type LectureMeeting} from '../ai/calendar'
import {safeError,evidenceText,metadataText} from '../ai/format'
import {CourseChat} from './CourseChat'
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text?:string)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n}
const dateLabel=(date:string)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(date+'T00:00:00+09:00'))
export class CourseAI {
 private disposed=false;private viewTicket=0;private chat?:CourseChat;private context?:CourseContext;private settings:LectureSettings={};private legacy:Message[]=[];private legacyMaterials:LocalMaterial[]=[];private lifetime=new AbortController();private screen?:HTMLDialogElement;private returnFocusDay?:number
 private syllabus:Promise<CourseSyllabus>
 private root:HTMLElement;private course:Course;private uid:string;private backend:AIBackend;private store:AIStore
 constructor(root:HTMLElement,course:Course,uid:string,backend:AIBackend,store=new AIStore(),syllabus?:Promise<CourseSyllabus>){this.syllabus=syllabus??(backend.demo?Promise.resolve({status:'absent'}):loadCourseSyllabus(course.syllabusURL));this.root=root;this.course=course;this.uid=uid;this.backend=backend;this.store=store}
 async mount(direct=false){
  this.root.replaceChildren(node('p','','授業ごとの履歴を確認しています…'));this.root.classList.add('web-ai')
  try{
   this.context=await resolveContext(this.course,this.store,this.uid)
   this.settings=await this.store.settings(this.uid,courseKey(this.context))??{}
   // Ambiguous pre-fix histories remain read-only. Never assign them to a new course/date.
   const keys=new Set([courseKey(this.context)])
   const old=isCourseUUID(this.course.id)?this.course.id:await this.store.lookupIdentity(this.uid,this.course.id||this.course.timetableRecord||'')
   if(old)keys.add(courseKey(makeContext(this.course,old)))
   for(const key of keys){this.legacy.push(...(await this.store.messages(this.uid,key)).filter(x=>!x.sessionKey));this.legacyMaterials.push(...(await this.store.materials(this.uid,key)).filter(x=>!x.sessionKey))}
   if(direct)await this.openLatest();else await this.showList()
  }catch(e){if(!this.disposed)this.root.replaceChildren(node('p','ai-status',safeError(e)))}
 }
 /** 授業回の一覧を飛ばして、いちばん新しい回(今日以前で最後。なければ最初)のチャットを、全画面で開く。 */
 private async openLatest(){
  const meetings=lectureSchedule(this.course,this.context!,this.settings).meetings,today=japanDate()
  // meetings は新しい回が先頭。予定の回(まだ先)を飛ばして、いちばん新しい回を選ぶ。日程が出せない授業は、今日の日付で開く。
  const meeting=meetings.find(m=>!m.upcoming)??meetings[0]??{number:1,date:today,dayID:dayIDFor(today),thisWeek:true,upcoming:false}
  await this.open(meeting,true)
 }
 private async showList(){
  const ticket=++this.viewTicket
  this.chat?.dispose();this.chat=undefined;this.closeScreen()
  const context=this.context!,key=courseKey(context),[messages,materials]=await Promise.all([this.store.messages(this.uid,key),this.store.materials(this.uid,key)])
  if(this.disposed||ticket!==this.viewTicket)return
  const schedule=lectureSchedule(this.course,context,this.settings)
  const title=node('h3','ai-course-title',this.course.title),intro=node('p','ai-session-intro','資料はこの授業の共通資料庫へ、会話は授業回ごとに保存します。試験対策ではチャット内で参照範囲を広げられます。'),notice=node('p','ai-session-note',schedule.notice),list=node('div','ai-lecture-list')
  if(schedule.official){const link=node('a','ai-calendar-link','学事暦を確認 ↗');link.href=calendarSource;link.target='_blank';link.rel='noopener noreferrer';notice.append(' ',link)}
  for(const meeting of schedule.meetings){
   const thread=sessionKey({...context,dayID:meeting.dayID}),history=messages.filter(x=>x.sessionKey===thread),sources=materials.filter(x=>x.sessionKey===thread)
   const item=node('button','ai-lecture-card'),badge=node('span','ai-lecture-number',String(meeting.number)),body=node('span','ai-lecture-body'),label=node('strong','',`第${meeting.number}回授業`)
   item.type='button';item.dataset.lectureDay=String(meeting.dayID);item.setAttribute('aria-label',`第${meeting.number}回授業 ${dateLabel(meeting.date)}`)
   if(meeting.thisWeek)item.classList.add('ai-lecture-card--current')
   body.append(label,node('small','',history.length?history.at(-1)!.text.slice(0,42):sources.length?`資料 ${sources.length}件`:'まだ記録がありません'))
   const date=node('span','ai-lecture-date',dateLabel(meeting.date));if(meeting.thisWeek)date.append(node('small','','今週'+(meeting.upcoming?'・予定':'')))
   item.append(badge,body,date);item.addEventListener('click',()=>void this.open(meeting));list.append(item)
  }
  this.root.replaceChildren(title,intro,notice,this.settingsForm(),list)
  if(this.legacy.length||this.legacyMaterials.length){const archive=node('details','ai-legacy-history'),summary=node('summary','','以前の履歴（授業回未確定）');archive.append(summary,node('p','','以前の識別方法で保存された履歴です。別授業が混在する可能性があるため、新しいチャットには参照・引継ぎしません。'))
   for(const row of this.legacyMaterials){const label=node('p','',row.title);archive.append(label);if(row.remote){const read=node('button','ai-small-button','旧資料の本文を見る'),body=node('pre','ai-legacy-text');read.type='button';read.addEventListener('click',()=>{read.disabled=true;body.textContent='本文を確認しています…';void this.backend.evidence(row.remote!.sourceId,false,this.lifetime.signal).then(value=>{if(!this.disposed)body.textContent=evidenceText(value.items)+'\n'+metadataText(value.recognition)}).catch(error=>{if(!this.disposed)body.textContent=safeError(error)}).finally(()=>{read.disabled=false})});archive.append(read,body)}}
   for(const message of this.legacy){archive.append(node('p','ai-legacy-role',message.role==='user'?'あなた':'AI'),node('p','ai-legacy-text',message.text))}this.root.append(archive)}
  if(this.returnFocusDay!==undefined){this.root.querySelector<HTMLButtonElement>(`[data-lecture-day="${this.returnFocusDay}"]`)?.focus({preventScroll:true});this.returnFocusDay=undefined}
 }
 private closeScreen(){
  const screen=this.screen;this.screen=undefined
  if(screen){if(screen.open)screen.close();screen.remove();document.body.classList.remove('ai-chat-open')}
 }
 private async open(meeting:LectureMeeting,ask=false){
  if(this.disposed)return
  this.viewTicket++;this.chat?.dispose();this.closeScreen();this.returnFocusDay=meeting.dayID
  const screen=node('dialog',ask?'ai-chat-screen ai-chat-screen--ask':'ai-chat-screen'),header=node('header','ai-chat-screen-header'),titles=node('div','ai-chat-screen-titles'),actions=node('div','ai-chat-screen-actions')
  const back=node('button','ai-small-button',ask?'×':'← 授業回一覧'),heading=node('h3','ai-session-course',this.course.title),date=node('p','ai-session-title',`第${meeting.number}回授業 · ${dateLabel(meeting.date)}`),host=node('div','ai-session-chat')
  heading.id=`ai-chat-title-${crypto.randomUUID()}`;screen.setAttribute('aria-labelledby',heading.id);screen.setAttribute('aria-modal','true')
  back.type='button';if(ask)back.setAttribute('aria-label','閉じる');back.addEventListener('click',()=>{if(ask)screen.close();else void this.showList()});titles.append(heading,date);header.append(back,titles,actions);screen.append(header,host)
  this.screen=screen;this.root.replaceChildren();document.body.append(screen);screen.addEventListener('close',()=>{if(ask){this.dispose();return}if(this.screen===screen&&!this.disposed)void this.showList()})
  document.body.classList.add('ai-chat-open');screen.showModal()
  this.chat=new CourseChat(host,this.course,this.uid,this.backend,this.store,{...this.context!,dayID:meeting.dayID},actions,this.syllabus.then(reference=>chatSyllabus(reference,this.course,meeting.number)),lectureSchedule(this.course,this.context!,this.settings).meetings);await this.chat.mount()
 }
 private settingsForm(){
  const details=node('details','ai-schedule-settings'),summary=node('summary','','授業日程を調整'),form=node('form'),first=node('input'),campus=node('select'),skip=node('textarea'),status=node('p','ai-status')
  first.type='date';first.value=this.settings.firstDate??'';first.setAttribute('aria-label','初回授業日')
  for(const [value,label]of [['','未指定'],['aoyama','青山'],['sagamihara','相模原']]){const o=node('option','',label);o.value=value;campus.append(o)}campus.value=this.settings.campus??'';campus.setAttribute('aria-label','授業キャンパス')
  skip.rows=2;skip.value=(this.settings.skippedDates??[]).join('\n');skip.placeholder='2026-10-20';skip.setAttribute('aria-label','休講日（1行に1日）')
  for(const [text,input]of [['初回授業日（通常は自動）',first],['キャンパス',campus],['休講日（YYYY-MM-DD、1行に1日）',skip]] as const){const label=node('label','',text);label.append(input);form.append(label)}
  const save=node('button','ai-small-button','日程を保存');save.type='submit';form.append(status,save)
  form.addEventListener('submit',e=>{e.preventDefault();void(async()=>{const skipped=skip.value.split(/\s+/).filter(Boolean);if((first.value&&!validDate(first.value))||skipped.some(x=>!validDate(x))){status.textContent='有効な日付を入力してください。';return}save.disabled=true;try{this.settings={firstDate:first.value||undefined,campus:campus.value as LectureSettings['campus']||undefined,skippedDates:skipped};await this.store.putSettings(this.uid,courseKey(this.context!),this.settings);await this.showList()}catch(e){status.textContent=safeError(e)}finally{save.disabled=false}})()})
  details.append(summary,node('p','','変更しても保存済みチャットの日付は変わりません。日程設定と会話は、このブラウザに保存されます。'),form);return details
 }
 dispose(){this.disposed=true;this.lifetime.abort();this.chat?.dispose();this.closeScreen()}
}
