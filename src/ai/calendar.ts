import type {Course} from '../timetable'
import type {CourseContext} from './types'
import {dayIDFor,dateForDayID} from './identity'
export interface LectureSettings { firstDate?:string; skippedDates?:string[]; campus?:'aoyama'|'sagamihara' }
export interface LectureMeeting {number:number;date:string;dayID:number;thisWeek:boolean;upcoming:boolean}
export const calendarSource='https://www.aoyama.ac.jp/wp-content/uploads/2025/10/aa_2026calendar_gakubu.pdf'
const day=86400000
export function japanDate(now=new Date()):string {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const value=(key:string)=>parts.find(x=>x.type===key)!.value
 return `${value('year')}-${value('month')}-${value('day')}`
}
export function validDate(value:string):boolean{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&dateForDayID(dayIDFor(value))===value}
export function meetingDay(course:Course):number|undefined {
 const value=course.meetingDay??Number(course.timetableRecord?.match(/:?(?:cells\.)?d([0-5])p\d+$/)?.[1]??NaN)
 return Number.isInteger(value)&&value>=0&&value<=5?value:undefined
}
export function lectureSchedule(course:Course,context:CourseContext,settings:LectureSettings={},today=japanDate()){
 const annual=course.teachingTerm?.includes('通年'),term=annual?'year':context.semester
 const campus=settings.campus??(/相模原/.test(course.campus??'')?'sagamihara':/青山/.test(course.campus??'')?'aoyama':undefined)
 // Enrollment calendar and syllabus/catalog identity have different sources of truth.
 // An old YR link must not suppress the current timetable's class dates.
 const year=course.academicYear
 const enrollmentYear=typeof year==='number'&&Number.isInteger(year)&&year>=1900&&year<=2200?year:undefined
 const calendarYear=enrollmentYear??context.year
 const official=calendarYear===2026&&['spring','fall','year'].includes(term??'')
 const first=settings.firstDate&&validDate(settings.firstDate)?settings.firstDate:undefined
 const weekday=first?(new Date(first+'T00:00:00Z').getUTCDay()+6)%7:meetingDay(course)
 if(weekday===undefined||weekday>5||(!official&&!first))return {meetings:[] as LectureMeeting[],notice:'初回授業日を設定すると、授業回ごとのチャットを作成できます。',provisional:true,official:false}
 const exclusions=new Set(settings.skippedDates??[])
 const start=first??(term==='fall'?'2026-09-14':'2026-04-06')
 const end=official?(term==='spring'?'2026-07-22':'2027-01-25'):dateForDayID(dayIDFor(start)+7*((annual?30:15)-1))
 const closed=new Set(['2026-05-04','2026-05-05','2026-05-06','2026-07-23','2026-09-22','2026-09-23','2026-10-30','2026-10-31','2026-11-02','2026-11-03','2026-11-23','2027-01-11','2027-01-21'])
 if(campus==='aoyama'){closed.add('2027-01-15');closed.add('2027-01-16')}
 if(campus==='sagamihara'){closed.add('2026-10-10');closed.add('2027-01-22')}
 const rows:LectureMeeting[]=[],todayID=dayIDFor(today),monday=todayID-(new Date(today+'T00:00:00Z').getUTCDay()+6)%7
 for(let id=dayIDFor(start);id<=dayIDFor(end);id++){
  const date=dateForDayID(id)
  if((new Date(id*day).getUTCDay()+6)%7!==weekday||exclusions.has(date))continue
  if(official&&(closed.has(date)||(date>='2026-07-23'&&date<='2026-09-13')||(date>='2026-12-23'&&date<='2027-01-07')))continue
  rows.push({number:rows.length+1,date,dayID:id,thisWeek:id>=monday&&id<=monday+6,upcoming:id>todayID})
 }
 const visible=rows.filter(x=>x.dayID<=monday+6)
 if(!visible.length&&rows.length)visible.push(rows[0])
 const provisional=!official||!campus
 const basis=official?(!campus?'2026年度学部学事暦から算出。キャンパス別休講と授業独自の休講は日程設定で確認してください。':'2026年度学部学事暦から算出。授業独自の休講・補講は日程設定で調整できます。'):'初回授業日から週1回として算出。休講日は日程設定で除外してください。'
 const mismatch=enrollmentYear!==undefined&&context.year!==undefined&&enrollmentYear!==context.year?`時間割の${enrollmentYear}年度に基づく日程です（シラバスの参照年度は${context.year}年度）。`:''
 return {meetings:visible.reverse(),notice:mismatch+basis,provisional,official}
}
