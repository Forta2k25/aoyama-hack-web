import type { Course } from '../timetable'
import type { CourseContext } from './types'

export function syllabusYear(value?: string): number | undefined {
  if (!value) return
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'syllabus.aoyama.ac.jp') return
    const years = url.searchParams.getAll('YR')
    if (years.length !== 1 || !/^\d{4}$/.test(years[0])) return
    const year = Number(years[0]); if (year >= 1900 && year <= 2200) return year
  } catch { /* Missing/ambiguous year stays unresolved, never infer the current year. */ }
}
export function offeringId(context: CourseContext): string | undefined {
  return context.year && /^\d{5}$/.test(context.classDocId ?? '') ? `${context.year}:${context.classDocId}` : undefined
}
export function courseKey(context: CourseContext): string {
  return offeringId(context) ?? `local:${context.year ?? 'unresolved'}:${context.localCourseUUID}`
}
export function makeContext(course: Course, localCourseUUID: string, date = new Date()): CourseContext {
  const year = syllabusYear(course.syllabusURL) ?? course.academicYear
  return { localCourseId: localCourseUUID, localCourseUUID,
    classDocId: /^\d{5}$/.test(course.firestoreDocID ?? '') ? course.firestoreDocID : undefined,
    year, semester: course.semester, syllabusUrl: course.syllabusURL,
    courseName: course.title, teacherName: course.teacher,
    dayID: Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000) }
}

export const isCourseUUID=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
export function identityRecord(course:Course):string {
  // A timetable record is not a placeholder code or a title. It includes year, term and slot.
  if(course.timetableRecord)return JSON.stringify(['timetable-record-v2',course.timetableRecord.replace(/:cells\.(d[0-5]p\d+)$/,':$1')])
  if(isCourseUUID(course.id))return JSON.stringify(['course-uuid-v2',course.id])
  const canonical=offeringId(makeContext(course,''))
  if(canonical)return JSON.stringify(['offering-v2',canonical])
  throw Error('WEB_授業を区別できる時間割レコードがありません。時間割から開き直してください。')
}
export const sessionKey=(context:CourseContext)=>JSON.stringify(['lecture-v2',courseKey(context),context.dayID])
export const dayIDFor=(date:string)=>Math.floor(Date.parse(date+'T00:00:00Z')/86400000)
export const dateForDayID=(id:number)=>new Date(id*86400000).toISOString().slice(0,10)

export async function resolveContext(course:Course,store:{identity(uid:string,record:string):Promise<string>},uid:string):Promise<CourseContext>{
 // アプリが時間割に保存した授業の識別子があれば、それをそのまま使う(アプリと同じ授業として、会話・資料がそろう)
 const appUUID=course.localCourseUUID&&isCourseUUID(course.localCourseUUID)?course.localCourseUUID.toLowerCase():undefined
 if(appUUID)return makeContext(course,appUUID)
 const uuid=await store.identity(uid,identityRecord(course))
 return makeContext(course,uuid)
}
