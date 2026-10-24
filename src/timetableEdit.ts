// 時間割の編集(授業の追加・色の変更・削除)。アプリと同じ保存の形(users/{uid}/timetable/{学期} の "cells.d{曜日}p{時限}")で、1コマだけを書く。
// アプリの TimetableRemoteStore.upsert / delete と同じ中身にして、アプリが、そのまま読めるようにする。
import { doc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from './firebase'
import { SLOT_COLORS, DEFAULT_SLOT_COLOR, currentTermDocId, type Course } from './timetable'
export { SLOT_COLORS, DEFAULT_SLOT_COLOR, currentTermDocId }

export const cellKey = (day: number, period: number) => `cells.d${day}p${period}`

/** アプリの slotHash と同じ。コマの中身が変わったかを、アプリが見分けるのに使う。 */
export function cellHash(course: Course, colorKey?: string): string {
  return [course.id, course.title, course.room, course.teacher, course.credits === undefined ? '' : String(course.credits),
    course.campus ?? '', course.category ?? '', course.syllabusURL ?? '', colorKey ?? '', course.localCourseUUID ?? '', course.firestoreDocID ?? ''].join('|')
}

/** アプリの encodeCourseMap と同じ(値が無い項目は、入れない)。 */
export function cellMap(course: Course, colorKey?: string): Record<string, unknown> {
  const map: Record<string, unknown> = { id: course.id, title: course.title, room: course.room, teacher: course.teacher }
  if (course.credits !== undefined) map.credits = course.credits
  if (course.campus) map.campus = course.campus
  if (course.category) map.category = course.category
  if (course.syllabusURL) map.syllabusURL = course.syllabusURL
  if (course.firestoreDocID) map.firestoreDocID = course.firestoreDocID
  if (course.localCourseUUID) map.localCourseUUID = course.localCourseUUID
  if (colorKey) map.colorKey = colorKey
  map.h = cellHash(course, colorKey)
  return map
}

/** 保存する1回分の中身。"cells.d1p2" は、ドットを含む、ひとつの項目名(アプリと同じ)。 */
export function upsertPayload(day: number, period: number, course: Course, colorKey?: string, stamp: unknown = serverTimestamp()): Record<string, unknown> {
  const key = cellKey(day, period)
  return { [key]: cellMap(course, colorKey), [`${key}.u`]: stamp, updatedAt: stamp }
}
export function deletePayload(day: number, period: number, stamp: unknown = serverTimestamp(), erase: unknown = deleteField()): Record<string, unknown> {
  const key = cellKey(day, period)
  return { [key]: erase, [`${key}.u`]: erase, updatedAt: stamp }
}

const termRef = (uid: string, termDocId: string) => doc(db, 'users', uid, 'timetable', termDocId)

/** 授業をコマに入れる。授業の識別子(localCourseUUID)が無ければ、新しく作る(アプリが授業を追加するときと同じ)。 */
export async function saveCourseToSlot(uid: string, termDocId: string, day: number, period: number, course: Course, colorKey?: string) {
  const withId = { ...course, localCourseUUID: course.localCourseUUID ?? crypto.randomUUID().toLowerCase() }
  await setDoc(termRef(uid, termDocId), upsertPayload(day, period, withId, colorKey), { merge: true })
}
/** 色だけを変える。授業の識別子が無い古いコマには、作らない(AIの会話・資料の紐付けが、変わってしまうため)。 */
export async function setSlotColor(uid: string, termDocId: string, day: number, period: number, course: Course, colorKey: string) {
  await setDoc(termRef(uid, termDocId), upsertPayload(day, period, course, colorKey), { merge: true })
}
export async function deleteSlot(uid: string, termDocId: string, day: number, period: number) {
  await setDoc(termRef(uid, termDocId), deletePayload(day, period), { merge: true })
}
