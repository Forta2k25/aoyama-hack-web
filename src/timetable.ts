import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

// ── 友だち ───────────────────────────────────────────────────────────────────

export interface Friend {
  uid: string
  name: string
  handle: string
}

export async function fetchFriends(currentUID: string): Promise<Friend[]> {
  const snap = await getDocs(collection(db, 'users', currentUID, 'friends'))
  return snap.docs
    .map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        uid:    (x['friendUid']  as string) ?? '',
        name:   (x['friendName'] as string) ?? '名前なし',
        handle: (x['friendId']   as string) ?? '',
      }
    })
    .filter(f => f.uid)
}

export interface Course {
  id: string
  title: string
  room: string
  teacher: string
  credits?: number
  campus?: string
  category?: string
  syllabusURL?: string
  colorKey?: string
  firestoreDocID?: string
  academicYear?: number
  semester?: string
  meetingDay?: number
  teachingTerm?: string
  timetableRecord?: string
  /** アプリが、時間割の各コマに保存している、授業の識別子(UUID)。アプリとWebで、同じ授業として会話・資料をそろえるために使う */
  localCourseUUID?: string
}

export interface TimetableSlot {
  day: number    // 0=月 … 4=金（5=土も存在する）
  period: number // 1 始まり
  course: Course
}

const DAY_NAMES = ['月', '火', '水', '木', '金', '土']

// Firestore のドキュメントIDは "assignedCourses.{year}_{semester}"
export function currentTermDocId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const semester = month >= 4 && month <= 9 ? '前期' : '後期'
  const termYear = month >= 1 && month <= 3 ? year - 1 : year
  return `assignedCourses.${termYear}_${semester}`
}

export function termLabel(): string {
  const docId = currentTermDocId()
  const match = docId.match(/assignedCourses\.(\d+)_(.+)/)
  return match ? `${match[1]}年${match[2]}` : ''
}

export async function fetchTimetable(uid: string): Promise<TimetableSlot[]> {
  const docId = currentTermDocId()
  const ref = doc(db, 'users', uid, 'timetable', docId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return []

  const data = snap.data() as Record<string, unknown>
  const slots: TimetableSlot[] = []

  for (const [key, value] of Object.entries(data)) {
    // キー形式: "cells.d{day}p{period}" または フラットな "d{day}p{period}"
    const match = key.match(/^(?:cells\.)?d(\d+)p(\d+)$/)
    if (!match || typeof value !== 'object' || !value) continue
    const m = value as Record<string, unknown>
    slots.push({
      day: parseInt(match[1], 10),
      period: parseInt(match[2], 10),
      course: {
        id: (m['id'] as string) ?? '',
        title: (m['title'] as string) ?? '（無題）',
        room: (m['room'] as string) ?? '',
        teacher: (m['teacher'] as string) ?? '',
        credits: m['credits'] as number | undefined,
        campus: m['campus'] as string | undefined,
        category: m['category'] as string | undefined,
        syllabusURL: m['syllabusURL'] as string | undefined,
        colorKey: m['colorKey'] as string | undefined,
        firestoreDocID: m['firestoreDocID'] as string | undefined,
        academicYear: Number(docId.match(/^assignedCourses\.(\d{4})_/)?.[1]) || undefined,
        semester: docId.endsWith('_前期') ? 'spring' : 'fall',
        meetingDay: parseInt(match[1],10),
        timetableRecord: `${docId}:${key}`,
        localCourseUUID: typeof m['localCourseUUID'] === 'string' ? (m['localCourseUUID'] as string) : undefined,
      },
    })
  }

  return slots
}

// 色キー → CSS色。アプリ(SlotColor.swift)と同じ7色。コマの表示色は、アプリと同じく、色を白と半分ずつ混ぜた淡い色。
export const SLOT_COLORS = [
  { key: 'teal',   label: '水色',   css: '#7fc5d9' },
  { key: 'blue',   label: '青',     css: '#80bdff' },
  { key: 'green',  label: '緑',     css: '#99e3ac' },
  { key: 'orange', label: 'オレンジ', css: '#ffca7f' },
  { key: 'red',    label: '赤',     css: '#ff9d97' },
  { key: 'gray',   label: 'グレー', css: '#c6c6c9' },
  { key: 'purple', label: '紫',     css: '#d7a8ee' },
] as const
export const DEFAULT_SLOT_COLOR = 'green'   // アプリで、色が決まっていない授業の色
export const slotColor = (key?: string) => (SLOT_COLORS.find(c => c.key === key) ?? SLOT_COLORS.find(c => c.key === DEFAULT_SLOT_COLOR)!).css
export const dayName = (day: number) => DAY_NAMES[day] ?? ''

export interface CourseDetail {
  evalMethod?: string
  grade?: string
  term?: string
  credit?: string
  registrationNumber?: string
  syllabusURL?: string
}

function toDetail(d: Record<string, unknown>): CourseDetail {
  return {
    evalMethod: d['eval_method'] as string | undefined,
    grade: d['grade'] as string | undefined,
    term: d['term'] as string | undefined,
    credit: d['credit'] != null ? String(d['credit']) : undefined,
    registrationNumber: (d['registration_number'] ?? d['code'] ?? d['class_code']) as string | undefined,
    syllabusURL: (d['url'] ?? d['syllabusURL']) as string | undefined,
  }
}

export async function fetchCourseDetail(course: Course): Promise<CourseDetail> {
  const { doc, getDoc, collection, query, where, limit, getDocs } = await import('firebase/firestore')
  const { db } = await import('./firebase')

  // firestoreDocID が分かっている場合は直接取得
  if (course.firestoreDocID) {
    const snap = await getDoc(doc(db, 'classes', course.firestoreDocID))
    if (snap.exists()) return toDetail(snap.data() as Record<string, unknown>)
  }

  // なければ授業名＋教員名でクエリ
  if (course.title && course.teacher) {
    const q = query(
      collection(db, 'classes'),
      where('class_name', '==', course.title),
      where('teacher_name', '==', course.teacher),
      limit(1)
    )
    const snap = await getDocs(q)
    if (!snap.empty) return toDetail(snap.docs[0].data() as Record<string, unknown>)
  }

  return {}
}
