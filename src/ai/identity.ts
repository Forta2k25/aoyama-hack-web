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
