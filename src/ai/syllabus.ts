import type {Course} from '../timetable'
import {fetchAndParseSyllabus, type SyllabusContent} from '../syllabus'

// Matches the existing shared aiChat syllabus limit; never split context across user turns.
export const syllabusContextLimit = 3500
export interface CourseSyllabus {status:'ready'|'absent'|'unavailable';url?:string;content?:SyllabusContent}
export interface ChatSyllabus {status:CourseSyllabus['status'];text:string}
const clean=(value:string|undefined)=>(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim()
const clip=(value:string,max:number)=>value.length<=max?value:value.slice(0,Math.max(0,max-1)).replace(/[\uD800-\uDBFF]$/,'')+'…'
export function syllabusURL(value:string|undefined):string|undefined {
 try{const u=new URL(value??'');if(!['https:','http:'].includes(u.protocol)||u.hostname!=='syllabus.aoyama.ac.jp'||u.username||u.password||u.port)return;u.hash='';return u.href}catch{return}
}
export async function loadCourseSyllabus(value:string|undefined):Promise<CourseSyllabus>{
 const url=syllabusURL(value);if(!url)return {status:'absent'}
 try{
  const content=await fetchAndParseSyllabus(url)
  const present=content&&(content.outline?.trim()||content.objective?.trim()||content.condition?.trim()||content.lectureItems.length||content.evalItems.length||content.textbooks.length||content.refs.length||content.methods.some(x=>x.checked))
  return present?{status:'ready',url,content:content!}:{status:'unavailable',url}
 }catch{return {status:'unavailable',url}}
}
/** Deterministic excerpts of this course's actual syllabus, never invented teaching/book content. */
export function chatSyllabus(reference:CourseSyllabus,course:Course,lectureNumber?:number):ChatSyllabus {
 if(reference.status!=='ready'||!reference.content||!syllabusURL(reference.url))return {status:reference.status==='ready'?'unavailable':reference.status,text:''}
 const s=reference.content,lines=['授業シラバス（授業の背景・計画。実際の実施内容を保証するものではありません）',`授業名: ${clip(clean(course.title),100)}`]
 if(course.teacher)lines.push(`担当教員: ${clip(clean(course.teacher),80)}`)
 const years=new URL(reference.url!).searchParams.getAll('YR'),year=years.length===1&&/^\d{4}$/.test(years[0])?years[0]:undefined
 if(year)lines.push(`シラバス参照年度: ${year}`)
 if(course.academicYear&&String(course.academicYear)!==year)lines.push(`時間割年度: ${course.academicYear}（シラバス参照年度とは別）`)
 lines.push(`出典: ${clip(reference.url!,260)}`)
 const plan=s.lectureItems.map(clean).filter(Boolean),current=Number.isInteger(lectureNumber)&&lectureNumber!>0?plan.find(x=>new RegExp(`^(?:第\\s*)?${lectureNumber}(?:[.．:：、)）]|\\s|回)`).test(x)):undefined
 if(lectureNumber)lines.push(`選択した授業回: 第${lectureNumber}回`)
 if(current)lines.push(`この回の予定: ${clip(current,350)}`)
 const add=(label:string,value:string|undefined,max:number)=>{const text=clean(value);if(text)lines.push(`${label}: ${clip(text,max)}`)}
 add('講義概要',s.outline,450);add('到達目標',s.objective,300)
 if(plan.length){const limit=Math.max(12,Math.floor(1400/Math.min(plan.length,60))-1);lines.push('授業計画（長い項目は抜粋）:\n'+plan.slice(0,60).map(x=>clip(x,limit)).join('\n')+(plan.length>60?'\n以降の項目は省略':''))}
 add('成績評価',s.evalItems.map(x=>`${x.name} ${x.percent} ${x.description}`).join(' / '),260)
 add('履修条件',s.condition,130);add('授業方法',s.methods.filter(x=>x.checked).map(x=>x.name).join(' / '),100)
 add('教科書（書名・著者のみ）',s.textbooks.map(x=>`${x.title} ${x.author}`).join(' / '),160)
 add('参考書（書名・著者のみ）',s.refs.map(x=>`${x.title} ${x.author}`).join(' / '),130)
 return {status:'ready',text:clip(lines.join('\n'),syllabusContextLimit)}
}
